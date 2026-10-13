import hashlib
import hmac
import json
import secrets
import time
import uuid
import binascii
import re
import logging
from urllib.parse import quote
from datetime import date, datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone as django_timezone

from .models import Account, Budget, Card, LoginSession, Subscription, Transaction

SESSION_COOKIE = "bereke_session"
SESSION_AGE = 30 * 24 * 60 * 60
logger = logging.getLogger(__name__)


def fail(message, status=400):
    return JsonResponse({"error": message}, status=status)


def body_of(request):
    try:
        value = json.loads(request.body)
        return value if isinstance(value, dict) else None
    except (ValueError, UnicodeDecodeError):
        return None


def current_user(request):
    token = request.COOKIES.get(SESSION_COOKIE, "")
    if not token or len(token) > 128:
        return None
    digest = hashlib.sha256(token.encode()).hexdigest()
    session = LoginSession.objects.select_related("user").filter(token_hash=digest, expires_at__gt=int(time.time() * 1000)).first()
    return session.user if session else None


def public_user(user):
    return {"name": user.name, "email": user.email, "phone": user.phone,
            "emailVerified": bool(user.email_verified_at), "provider": "local"}


def rate_limited(namespace, value, limit, seconds):
    key = "bereke:" + namespace + ":" + hashlib.sha256(value.encode()).hexdigest()
    if cache.add(key, 1, timeout=seconds):
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, timeout=seconds)
        return False


def send_account_email(user, purpose):
    if purpose == "verify":
        token = signing.dumps({"uid": user.pk, "email": user.email}, salt="bereke-email-verification")
        link = f"{settings.FRONTEND_URL}/verify-email?token={quote(token, safe='')}"
        subject = "Теңгерім: email мекенжайыңызды растаңыз"
        message = f"Email мекенжайыңызды растау үшін сілтемені ашыңыз (24 сағат жарамды):\n{link}\n"
    else:
        fingerprint = hashlib.sha256(user.password_hash.encode()).hexdigest()
        token = signing.dumps({"uid": user.pk, "fingerprint": fingerprint}, salt="bereke-password-reset")
        link = f"{settings.FRONTEND_URL}/reset-password?token={quote(token, safe='')}"
        subject = "Теңгерім: құпиясөзді қалпына келтіру"
        message = f"Құпиясөзді өзгерту үшін сілтемені ашыңыз (30 минут жарамды):\n{link}\nЕгер бұл сұрауды өзіңіз жібермесеңіз, хатты елемеңіз.\n"
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        return True
    except Exception:
        logger.exception("Account email delivery failed")
        return False


def reset_user_from_token(token):
    try:
        payload = signing.loads(token, salt="bereke-password-reset", max_age=30 * 60)
        if not isinstance(payload, dict):
            return None
        user = Account.objects.filter(pk=payload.get("uid")).first()
        if user and hmac.compare_digest(hashlib.sha256(user.password_hash.encode()).hexdigest(), str(payload.get("fingerprint", ""))):
            return user
    except (signing.BadSignature, signing.SignatureExpired, TypeError, ValueError):
        pass
    return None


def normalize_phone(value):
    if not isinstance(value, str):
        return None
    phone = re.sub(r"[\s()\-]", "", value)
    if re.fullmatch(r"8\d{10}", phone):
        phone = "+7" + phone[1:]
    elif re.fullmatch(r"7\d{10}", phone):
        phone = "+" + phone
    return phone if re.fullmatch(r"\+[1-9]\d{7,14}", phone) else None


def password_problem(password):
    if len(password) < 8:
        return "Құпиясөз қабылданбайды: кемінде 8 таңба қажет."
    if not any(char.isalpha() for char in password):
        return "Құпиясөз тым оңай: әріп қосыңыз."
    if not any(char in "0123456789" for char in password):
        return "Құпиясөз тым оңай: сан қосыңыз."
    if not any(not char.isalnum() and not char.isspace() for char in password):
        return "Құпиясөз тым оңай: арнайы таңба қосыңыз."
    return None


def check_legacy_password(password, stored):
    try:
        algorithm, iterations, salt, digest = stored.split(":")
        if algorithm != "pbkdf2" or iterations != "210000":
            return False
        import base64
        result = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), 210000)
        return hmac.compare_digest(result, base64.b64decode(digest))
    except (ValueError, TypeError, binascii.Error):
        return False


@ensure_csrf_cookie
def auth_view(request):
    if request.method == "GET":
        user = current_user(request)
        return JsonResponse({"user": public_user(user) if user else None})
    if request.method == "DELETE":
        token = request.COOKIES.get(SESSION_COOKIE)
        if token:
            LoginSession.objects.filter(token_hash=hashlib.sha256(token.encode()).hexdigest()).delete()
        response = JsonResponse({"ok": True})
        response.delete_cookie(SESSION_COOKIE, path="/", samesite="Lax")
        return response
    if request.method != "POST":
        return fail("Белгісіз әрекет", 405)
    body = body_of(request)
    if body is None:
        return fail("Сұрау пішімі қате")
    action = body.get("action")
    if action not in ("register", "login"):
        return fail("Белгісіз әрекет")
    identifier = body.get("identifier", body.get("email", ""))
    email = body.get("email", "")
    phone_value = body.get("phone", "")
    password = body.get("password", "")
    name = body.get("name", "")
    if not isinstance(email, str) or not isinstance(identifier, str) or not isinstance(password, str) or not isinstance(name, str):
        return fail("Деректер пішімі қате")
    email = email.strip().lower()
    name = name.strip()
    if not password or len(password) > 128:
        return fail("Құпиясөзді тексеріңіз")
    if action == "register":
        try:
            validate_email(email)
        except ValidationError:
            return fail("Email мекенжайын дұрыс енгізіңіз")
        phone = normalize_phone(phone_value)
        if not phone:
            return fail("Телефон нөмірін халықаралық пішімде енгізіңіз, мысалы +77001234567")
        if len(email) > 254 or not 2 <= len(name) <= 80:
            return fail("Атыңызды дұрыс енгізіңіз")
        if problem := password_problem(password):
            return fail(problem)
        if Account.objects.filter(email__iexact=email).exists():
            return fail("Бұл email бұрын тіркелген", 409)
        if Account.objects.filter(phone=phone).exists():
            return fail("Бұл телефон бұрын тіркелген", 409)
        try:
            user = Account.objects.create(id=str(uuid.uuid4()), name=name, email=email, phone=phone,
                                          password_hash=make_password(password), created_at=datetime.now(timezone.utc))
        except IntegrityError:
            return fail("Email немесе телефон бұрын тіркелген", 409)
        send_account_email(user, "verify")
    else:
        identifier = identifier.strip().lower()
        if rate_limited("login", f"{request.META.get('REMOTE_ADDR', '')}:{identifier}", 10, 15 * 60):
            return fail("Кіру әрекеттері тым көп. 15 минуттан кейін қайталаңыз.", 429)
        if "@" in identifier:
            user = Account.objects.filter(email__iexact=identifier).first()
        else:
            phone = normalize_phone(identifier)
            user = Account.objects.filter(phone=phone).first() if phone else None
        if not user or not (check_password(password, user.password_hash) or check_legacy_password(password, user.password_hash)):
            return fail("Email, телефон немесе құпиясөз қате", 401)
        if user.password_hash.startswith("pbkdf2:"):
            user.password_hash = make_password(password)
            user.save(update_fields=["password_hash"])
    token = secrets.token_urlsafe(32)
    LoginSession.objects.create(token_hash=hashlib.sha256(token.encode()).hexdigest(), user=user,
                                expires_at=int(time.time() * 1000) + SESSION_AGE * 1000)
    response = JsonResponse({"user": public_user(user)}, status=201 if action == "register" else 200)
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_AGE, httponly=True,
                        secure=not settings.DEBUG, samesite="Lax", path="/")
    return response


def password_reset_view(request):
    if request.method != "POST":
        return fail("Белгісіз әрекет", 405)
    body = body_of(request)
    email = body.get("email") if body else None
    if not isinstance(email, str):
        return fail("Email енгізіңіз")
    email = email.strip().lower()
    allowed = len(email) <= 254 and not rate_limited("reset-ip", request.META.get("REMOTE_ADDR", ""), 10, 60 * 60)
    allowed = allowed and not rate_limited("reset-account", email, 3, 60 * 60)
    if allowed:
        user = Account.objects.filter(email__iexact=email).first()
        if user:
            send_account_email(user, "reset")
    return JsonResponse({"ok": True})


def password_reset_confirm_view(request):
    if request.method not in ("GET", "POST"):
        return fail("Белгісіз әрекет", 405)
    body = body_of(request) if request.method == "POST" else None
    token = (body or {}).get("token") if body is not None else request.GET.get("token")
    if not isinstance(token, str) or not 0 < len(token) <= 4096:
        return fail("Сілтеме жарамсыз немесе мерзімі өтті", 400)
    if request.method == "GET":
        return JsonResponse({"valid": bool(reset_user_from_token(token))})
    password = body.get("password") if body else None
    if not isinstance(password, str) or len(password) > 128:
        return fail("Құпиясөз 8–128 таңбадан тұруы керек")
    if problem := password_problem(password):
        return fail(problem)
    with transaction.atomic():
        user = reset_user_from_token(token)
        if not user:
            return fail("Сілтеме жарамсыз немесе мерзімі өтті", 400)
        user = Account.objects.select_for_update().get(pk=user.pk)
        if reset_user_from_token(token) is None:
            return fail("Сілтеме жарамсыз немесе мерзімі өтті", 400)
        user.password_hash = make_password(password)
        user.save(update_fields=["password_hash"])
        LoginSession.objects.filter(user=user).delete()
    return JsonResponse({"ok": True})


def email_verification_view(request):
    if request.method != "POST":
        return fail("Белгісіз әрекет", 405)
    body = body_of(request) or {}
    token = body.get("token")
    if token is not None:
        if not isinstance(token, str) or not 0 < len(token) <= 4096:
            return fail("Сілтеме жарамсыз немесе мерзімі өтті", 400)
        try:
            payload = signing.loads(token, salt="bereke-email-verification", max_age=24 * 60 * 60)
            user = Account.objects.filter(pk=payload.get("uid"), email__iexact=payload.get("email")).first() if isinstance(payload, dict) else None
        except (signing.BadSignature, signing.SignatureExpired, TypeError, ValueError):
            user = None
        if not user:
            return fail("Сілтеме жарамсыз немесе мерзімі өтті", 400)
        if not user.email_verified_at:
            user.email_verified_at = django_timezone.now()
            user.save(update_fields=["email_verified_at"])
        return JsonResponse({"ok": True, "user": public_user(user)})
    user = current_user(request)
    if not user:
        return fail("Кіру қажет", 401)
    if not user.email_verified_at and not rate_limited("verify-account", str(user.pk), 3, 60 * 60):
        send_account_email(user, "verify")
    return JsonResponse({"ok": True})


def profile_view(request):
    if request.method != "PATCH":
        return fail("Белгісіз әрекет", 405)
    user = current_user(request)
    if not user:
        return fail("Кіру қажет", 401)
    body = body_of(request)
    name = body.get("name") if body else None
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80:
        return fail("Аты 2–80 таңбадан тұруы керек")
    user.name = name.strip()
    user.save(update_fields=["name"])
    return JsonResponse({"user": public_user(user)})


def as_date(value):
    try:
        if not isinstance(value, str) or len(value) != 10:
            return None
        parsed = date.fromisoformat(value)
        return parsed if parsed.isoformat() == value else None
    except ValueError:
        return None


def as_amount(value):
    try:
        if isinstance(value, bool) or value is None or str(int(value)) != str(value):
            return None
        number = int(value)
        return number if 1 <= number <= 1_000_000_000 else None
    except (ValueError, TypeError, OverflowError):
        return None


def clean(value, maximum=80):
    return value.strip()[:maximum] if isinstance(value, str) else ""


def card_json(card):
    return {"id": card.id, "userId": card.user_id, "bankName": card.bank_name, "last4": card.last4, "createdAt": card.created_at.isoformat()}


def tx_json(item):
    return {"id": item.id, "userId": item.user_id, "cardId": item.card_id, "merchant": item.merchant,
            "category": item.category, "amount": item.amount, "type": item.type,
            "txDate": item.tx_date.isoformat(), "createdAt": item.created_at.isoformat()}


def sub_json(item):
    return {"id": item.id, "userId": item.user_id, "merchant": item.merchant, "monthlyAmount": item.monthly_amount,
            "nextPayment": item.next_payment.isoformat(), "status": item.status, "createdAt": item.created_at.isoformat()}


def budgets_for_user(user):
    today = django_timezone.localdate()
    start = today.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    spent = dict(Transaction.objects.filter(user=user, type="expense", tx_date__gte=start, tx_date__lt=end)
                 .values("category").annotate(total=Sum("amount")).values_list("category", "total"))
    return [{"id": budget.id, "category": budget.category, "monthlyLimit": budget.monthly_limit,
             "spent": spent.get(budget.category, 0), "updatedAt": budget.updated_at.isoformat()}
            for budget in Budget.objects.filter(user=user).order_by("category")]


def budgets_view(request):
    user = current_user(request)
    if not user:
        return fail("Кіру қажет", 401)
    if request.method == "GET":
        return JsonResponse({"budgets": budgets_for_user(user)})
    if request.method == "DELETE":
        try:
            item_id = int(request.GET.get("id", ""))
        except ValueError:
            return fail("Бюджет қате таңдалған")
        deleted, _ = Budget.objects.filter(id=item_id, user=user).delete()
        return JsonResponse({"ok": True}) if deleted else fail("Бюджет табылмады", 404)
    if request.method != "POST":
        return fail("Белгісіз әрекет", 405)
    body = body_of(request)
    if body is None:
        return fail("Сұрау пішімі қате")
    category = body.get("category")
    limit = as_amount(body.get("monthlyLimit"))
    if not isinstance(category, str) or not category.strip() or len(category.strip()) > 40 or not limit:
        return fail("Санат пен айлық лимитті тексеріңіз")
    category = category.strip()
    budget, created = Budget.objects.update_or_create(
        user=user, category=category, defaults={"monthly_limit": limit})
    return JsonResponse({"item": {"id": budget.id, "category": category, "monthlyLimit": limit}}, status=201 if created else 200)


@ensure_csrf_cookie
def finance_view(request):
    user = current_user(request)
    if not user:
        return fail("Кіру қажет", 401)
    if request.method == "GET":
        return JsonResponse({"user": public_user(user),
            "transactions": [tx_json(item) for item in Transaction.objects.filter(user=user).order_by("-tx_date", "-id")[:500]],
            "subscriptions": [sub_json(item) for item in Subscription.objects.filter(user=user).order_by("-id")[:100]],
            "cards": [card_json(item) for item in Card.objects.filter(user=user).order_by("-id")[:50]],
            "budgets": budgets_for_user(user)})
    if request.method == "DELETE":
        try:
            item_id = int(request.GET.get("id", ""))
        except ValueError:
            return fail("Операция қате таңдалған")
        deleted, _ = Transaction.objects.filter(id=item_id, user=user).delete()
        return JsonResponse({"ok": True}) if deleted else fail("Операция табылмады", 404)
    body = body_of(request)
    if body is None:
        return fail("Сұрау пішімі қате")
    if request.method == "PATCH":
        try:
            item_id = int(body.get("id"))
        except (ValueError, TypeError):
            return fail("Деректер қате")
        if body.get("kind") == "transaction":
            item = Transaction.objects.filter(id=item_id, user=user).first()
            if not item:
                return fail("Операция табылмады", 404)
            merchant, category = clean(body.get("merchant")), clean(body.get("category"), 40)
            amount, tx_date = as_amount(body.get("amount")), as_date(body.get("txDate"))
            tx_type = body.get("type")
            if not merchant or not category or not amount or not tx_date or tx_type not in ("income", "expense"):
                return fail("Операция деректерін тексеріңіз")
            card = None
            if body.get("cardId") not in (None, ""):
                try:
                    card = Card.objects.filter(id=int(body["cardId"]), user=user).first()
                except (ValueError, TypeError):
                    pass
                if not card:
                    return fail("Карта табылмады", 404)
            item.merchant = merchant
            item.category = category
            item.amount = amount
            item.type = tx_type
            item.tx_date = tx_date
            item.card = card
            item.save(update_fields=["merchant", "category", "amount", "type", "tx_date", "card"])
            return JsonResponse({"item": tx_json(item)})
        status = body.get("status")
        if status not in ("active", "cancelled"):
            return fail("Деректер қате")
        item = Subscription.objects.filter(id=item_id, user=user).first()
        if not item:
            return fail("Жазылым табылмады", 404)
        item.status = status
        item.save(update_fields=["status"])
        return JsonResponse({"item": sub_json(item)})
    if request.method != "POST":
        return fail("Белгісіз әрекет", 405)
    kind = body.get("kind")
    now = datetime.now(timezone.utc)
    if kind == "transaction":
        merchant, category = clean(body.get("merchant")), clean(body.get("category"), 40)
        amount, tx_date = as_amount(body.get("amount")), as_date(body.get("txDate"))
        tx_type = body.get("type")
        if not merchant or not category or not amount or not tx_date or tx_type not in ("income", "expense"):
            return fail("Операция деректерін тексеріңіз")
        card = None
        if body.get("cardId") not in (None, ""):
            try:
                card = Card.objects.filter(id=int(body["cardId"]), user=user).first()
            except (ValueError, TypeError):
                pass
            if not card:
                return fail("Карта табылмады", 404)
        item = Transaction.objects.create(user=user, card=card, merchant=merchant, category=category,
                                          amount=amount, type=tx_type, tx_date=tx_date, created_at=now)
        return JsonResponse({"item": tx_json(item)}, status=201)
    if kind == "subscription":
        merchant = clean(body.get("merchant"))
        amount, payment = as_amount(body.get("monthlyAmount")), as_date(body.get("nextPayment"))
        if not merchant or not amount or not payment:
            return fail("Жазылым деректерін тексеріңіз")
        item = Subscription.objects.create(user=user, merchant=merchant, monthly_amount=amount,
                                           next_payment=payment, status="active", created_at=now)
        return JsonResponse({"item": sub_json(item)}, status=201)
    if kind == "card":
        bank, last4 = clean(body.get("bankName"), 50), clean(body.get("last4"), 4)
        if not bank or len(last4) != 4 or not last4.isascii() or not last4.isdigit():
            return fail("Банк атауы мен соңғы 4 санды енгізіңіз")
        item = Card.objects.create(user=user, bank_name=bank, last4=last4, created_at=now)
        return JsonResponse({"item": card_json(item)}, status=201)
    if kind == "seed":
        with transaction.atomic():
            if Transaction.objects.filter(user=user).exists():
                return fail("Үлгі тек бос кабинетке қосылады")
            sample = [("Жалақы", "Жалақы", 480000, "income", 2),
                      ("Magnum", "Азық-түлік", 28500, "expense", 1),
                      ("Такси", "Көлік", 6800, "expense", 3),
                      ("Кафе", "Тамақтану", 12500, "expense", 5),
                      ("Дәріхана", "Денсаулық", 9400, "expense", 7),
                      ("Фриланс", "Қосымша табыс", 85000, "income", 12),
                      ("Кино", "Ойын-сауық", 7900, "expense", 14)]
            for merchant, category, amount, tx_type, days in sample:
                Transaction.objects.create(user=user, merchant=merchant, category=category,
                                           amount=amount, type=tx_type, tx_date=(now - timedelta(days=days)).date(), created_at=now)
            for merchant, amount in (("YouTube Premium", 2690), ("Spotify", 2390)):
                Subscription.objects.create(user=user, merchant=merchant, monthly_amount=amount,
                                            next_payment=now.date(), status="active", created_at=now)
        return JsonResponse({"ok": True}, status=201)
    return fail("Белгісіз әрекет")
