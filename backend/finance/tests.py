import json
from datetime import date, timedelta, timezone as dt_timezone
import re
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test import Client
from django.test.utils import override_settings
from django.utils import timezone

from .models import Account, Budget, Card, EmailChallenge, Transaction


def confirm_last_code(client, challenge_id):
    code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
    return client.post("/api/auth", data=json.dumps({"action": "verify-code", "challengeId": challenge_id, "code": code}), content_type="application/json")


class AdminTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create(
            id="admin-test-account", name="Bereke User", email="user@example.com",
            phone="+77001234567", password_hash="private-test-hash",
            created_at=timezone.now(),
        )

    def test_admin_requires_staff_login_and_shows_finance_models(self):
        response = self.client.get("/admin/")
        self.assertRedirects(response, "/admin/login/?next=/admin/")

        administrator = get_user_model().objects.create_superuser(
            username="site-admin", email="admin@example.com", password="test-password-123"
        )
        self.client.force_login(administrator)
        response = self.client.get("/admin/")
        self.assertEqual(response.status_code, 200)
        for label in ("Accounts", "Cards", "Transactions", "Subscriptions", "Budgets"):
            self.assertContains(response, label)

        change_response = self.client.get(f"/admin/finance/account/{self.account.pk}/change/")
        self.assertEqual(change_response.status_code, 200)
        self.assertNotContains(change_response, "private-test-hash")

    def test_admin_can_add_finance_record(self):
        administrator = get_user_model().objects.create_superuser(
            username="site-admin", email="admin@example.com", password="test-password-123"
        )
        self.client.force_login(administrator)
        response = self.client.post("/admin/finance/transaction/add/", {
            "user": self.account.pk,
            "card": "",
            "merchant": "Test shop",
            "category": "Shopping",
            "amount": "2500",
            "type": "expense",
            "tx_date": timezone.localdate().isoformat(),
            "_save": "Save",
        })
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Transaction.objects.filter(user=self.account, merchant="Test shop", amount=2500).exists())


@override_settings(LOCAL_EMAIL_AUTH_BYPASS=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class LocalEmailBypassTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_register_and_login_require_password_but_no_email_code(self):
        registration = self.client.post("/api/auth", data=json.dumps({
            "action": "register", "name": "Local User", "email": "local@example.com",
            "phone": "+77001234567", "password": "secure-password-123",
        }), content_type="application/json")
        self.assertEqual(registration.status_code, 201)
        self.assertEqual(registration.json()["user"]["email"], "local@example.com")
        self.assertEqual(len(mail.outbox), 0)

        self.client.delete("/api/auth")
        wrong = self.client.post("/api/auth", data=json.dumps({
            "action": "login", "identifier": "local@example.com", "password": "wrong-password",
        }), content_type="application/json")
        self.assertEqual(wrong.status_code, 401)
        self.assertIsNone(self.client.get("/api/auth").json()["user"])

        login = self.client.post("/api/auth", data=json.dumps({
            "action": "login", "identifier": "local@example.com", "password": "secure-password-123",
        }), content_type="application/json")
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["email"], "local@example.com")
        self.assertEqual(len(mail.outbox), 0)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PhoneAuthenticationTests(TestCase):
    def setUp(self):
        cache.clear()

    def post_auth(self, body):
        return self.client.post("/api/auth", data=json.dumps(body), content_type="application/json")

    def test_register_and_sign_in_by_phone_or_email(self):
        registration = self.post_auth({
            "action": "register", "name": "Test User", "email": "test@example.com",
            "phone": "8 (700) 123-45-67", "password": "secure-password-123",
        })
        self.assertEqual(registration.status_code, 200)
        self.assertIsNone(self.client.get("/api/auth").json()["user"])
        self.assertFalse(Account.objects.filter(email="test@example.com").exists())
        registration = confirm_last_code(self.client, registration.json()["challengeId"])
        self.assertEqual(registration.status_code, 201)
        self.assertEqual(registration.json()["user"]["phone"], "+77001234567")
        self.assertEqual(Account.objects.get(email="test@example.com").phone, "+77001234567")

        duplicate_email = self.post_auth({
            "action": "register", "name": "Other User", "email": "test@example.com",
            "phone": "+77001234568", "password": "secure-password-123",
        })
        self.assertEqual(duplicate_email.status_code, 409)
        self.assertEqual(duplicate_email.json()["error"], "Бұл email бұрын тіркелген")

        duplicate = self.post_auth({
            "action": "register", "name": "Other User", "email": "other@example.com",
            "phone": "+77001234567", "password": "secure-password-123",
        })
        self.assertEqual(duplicate.status_code, 409)

        self.client.delete("/api/auth")
        phone_login = self.post_auth({"action": "login", "identifier": "+7 700 123 45 67", "password": "secure-password-123"})
        self.assertIsNone(self.client.get("/api/auth").json()["user"])
        phone_login = confirm_last_code(self.client, phone_login.json()["challengeId"])
        self.assertEqual(phone_login.status_code, 200)
        self.client.delete("/api/auth")
        email_login = self.post_auth({"action": "login", "identifier": "test@example.com", "password": "secure-password-123"})
        email_login = confirm_last_code(self.client, email_login.json()["challengeId"])
        self.assertEqual(email_login.status_code, 200)

    def test_wrong_code_expires_after_five_attempts(self):
        response = self.post_auth({"action": "register", "name": "Test User", "email": "test@example.com",
            "phone": "+77001234567", "password": "secure-password-123"})
        challenge_id = response.json()["challengeId"]
        correct = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        wrong = "000000" if correct != "000000" else "111111"
        for _ in range(5):
            attempt = self.post_auth({"action": "verify-code", "challengeId": challenge_id, "code": wrong})
            self.assertEqual(attempt.status_code, 400)
        self.assertEqual(self.post_auth({"action": "verify-code", "challengeId": challenge_id, "code": correct}).status_code, 400)
        self.assertFalse(Account.objects.exists())

    def test_expired_code_and_delivery_failure(self):
        response = self.post_auth({"action": "register", "name": "Test User", "email": "test@example.com",
            "phone": "+77001234567", "password": "secure-password-123"})
        EmailChallenge.objects.filter(pk=response.json()["challengeId"]).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(confirm_last_code(self.client, response.json()["challengeId"]).status_code, 400)
        self.assertFalse(Account.objects.exists())
        with patch("finance.views.send_mail", side_effect=OSError("SMTP unavailable")):
            failed = self.post_auth({"action": "register", "name": "Another User", "email": "other@example.com",
                "phone": "+77001234568", "password": "secure-password-123"})
        self.assertEqual(failed.status_code, 503)
        self.assertFalse(EmailChallenge.objects.filter(email="other@example.com").exists())

    def test_registration_rejects_invalid_phone(self):
        response = self.post_auth({
            "action": "register", "name": "Test User", "email": "test@example.com",
            "phone": "123", "password": "secure-password-123",
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Account.objects.exists())

    def test_registration_rejects_simple_passwords(self):
        for password in ("short1!", "12345678!", "password!", "password123"):
            response = self.post_auth({
                "action": "register", "name": "Test User", "email": "test@example.com",
                "phone": "+77001234567", "password": password,
            })
            self.assertEqual(response.status_code, 400)
            self.assertIn("Құпиясөз", response.json()["error"])
        self.assertFalse(Account.objects.exists())


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AccountRecoveryTests(TestCase):
    def setUp(self):
        cache.clear()
        registration = self.client.post("/api/auth", data=json.dumps({
            "action": "register", "name": "Test User", "email": "recover@example.com",
            "phone": "+77001234567", "password": "original-password-123",
        }), content_type="application/json")
        confirm_last_code(self.client, registration.json()["challengeId"])

    def token_from_last_email(self):
        link = next(line for line in mail.outbox[-1].body.splitlines() if line.startswith("http"))
        return parse_qs(urlparse(link).query)["token"][0]

    def test_email_verification_and_resend(self):
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(Account.objects.get(email="recover@example.com").email_verified_at)
        Account.objects.filter(email="recover@example.com").update(email_verified_at=None)
        response = self.client.post("/api/email-verification", data="{}", content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        token = self.token_from_last_email()
        confirmed = self.client.post("/api/email-verification", data=json.dumps({"token": token}), content_type="application/json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertTrue(confirmed.json()["user"]["emailVerified"])
        self.assertTrue(Account.objects.get(email="recover@example.com").email_verified_at)

    def test_password_reset_invalidates_old_password_and_session(self):
        unknown = self.client.post("/api/password-reset", data=json.dumps({"email": "unknown@example.com"}), content_type="application/json")
        self.assertEqual(unknown.json(), {"ok": True})
        self.assertEqual(len(mail.outbox), 1)
        response = self.client.post("/api/password-reset", data=json.dumps({"email": "recover@example.com"}), content_type="application/json")
        self.assertEqual(response.json(), {"ok": True})
        token = self.token_from_last_email()
        self.assertTrue(self.client.get("/api/password-reset/confirm", {"token": token}).json()["valid"])
        weak = self.client.post("/api/password-reset/confirm", data=json.dumps({"token": token, "password": "password123"}), content_type="application/json")
        self.assertEqual(weak.status_code, 400)
        self.assertTrue(self.client.get("/api/password-reset/confirm", {"token": token}).json()["valid"])
        changed = self.client.post("/api/password-reset/confirm", data=json.dumps({"token": token, "password": "replacement-password-456"}), content_type="application/json")
        self.assertEqual(changed.status_code, 200)
        self.assertIsNone(self.client.get("/api/auth").json()["user"])
        self.assertFalse(self.client.get("/api/password-reset/confirm", {"token": token}).json()["valid"])
        old_login = self.client.post("/api/auth", data=json.dumps({"action": "login", "identifier": "recover@example.com", "password": "original-password-123"}), content_type="application/json")
        self.assertEqual(old_login.status_code, 401)
        new_login = self.client.post("/api/auth", data=json.dumps({"action": "login", "identifier": "recover@example.com", "password": "replacement-password-456"}), content_type="application/json")
        new_login = confirm_last_code(self.client, new_login.json()["challengeId"])
        self.assertEqual(new_login.status_code, 200)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class BudgetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.other = Client()
        for client, email, phone in ((self.client, "first@example.com", "+77001234567"),
                                     (self.other, "second@example.com", "+77001234568")):
            response = client.post("/api/auth", data=json.dumps({
                "action": "register", "name": "Test User", "email": email,
                "phone": phone, "password": "secure-password-123",
            }), content_type="application/json")
            self.assertEqual(confirm_last_code(client, response.json()["challengeId"]).status_code, 201)

    def post_budget(self, client, category, limit):
        return client.post("/api/budgets", data=json.dumps({"category": category, "monthlyLimit": limit}),
                           content_type="application/json")

    def test_current_month_spending_and_ownership(self):
        created = self.post_budget(self.client, "Азық-түлік", 30000)
        self.assertEqual(created.status_code, 201)
        budget_id = created.json()["item"]["id"]
        user = Account.objects.get(email="first@example.com")
        other = Account.objects.get(email="second@example.com")
        today = timezone.localdate()
        previous_month = today.replace(day=1) - timedelta(days=1)
        for owner, amount, kind, day in ((user, 12000, "expense", today),
                                         (user, 8000, "expense", today),
                                         (user, 9000, "income", today),
                                         (user, 4000, "expense", previous_month),
                                         (other, 3000, "expense", today)):
            Transaction.objects.create(user=owner, merchant="Example", category="Азық-түлік",
                                       amount=amount, type=kind, tx_date=day, created_at=timezone.now())
        data = self.client.get("/api/finance").json()
        self.assertEqual(data["budgets"][0]["spent"], 20000)
        self.assertEqual(self.other.get("/api/budgets").json()["budgets"], [])
        self.assertEqual(self.other.delete(f"/api/budgets?id={budget_id}").status_code, 404)
        updated = self.post_budget(self.client, "Азық-түлік", 25000)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(Budget.objects.filter(user=user).count(), 1)
        self.assertEqual(self.client.get("/api/budgets").json()["budgets"][0]["monthlyLimit"], 25000)
        self.assertEqual(self.client.delete(f"/api/budgets?id={budget_id}").status_code, 200)
        self.assertFalse(Budget.objects.filter(user=user).exists())

    def test_limit_validation(self):
        for limit in (0, -1, 1.5, "many", 1_000_000_001):
            self.assertEqual(self.post_budget(self.client, "Көлік", limit).status_code, 400)
        self.assertEqual(self.post_budget(self.client, "", 1000).status_code, 400)
        self.assertFalse(Budget.objects.exists())


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class TransactionEditingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.other_client = Client()
        for email, phone, client in (("first@example.com", "+77001234567", self.client),
                                     ("second@example.com", "+77001234568", self.other_client)):
            response = client.post("/api/auth", data=json.dumps({"action": "register", "name": "Test User",
                "email": email, "phone": phone, "password": "secure-password-123"}), content_type="application/json")
            confirm_last_code(client, response.json()["challengeId"])
        self.user = Account.objects.get(email="first@example.com")
        self.item = Transaction.objects.create(user=self.user, merchant="Old", category="Азық-түлік",
            amount=1000, type="expense", tx_date=timezone.localdate(), created_at=timezone.now())
        Budget.objects.create(user=self.user, category="Азық-түлік", monthly_limit=5000)
        Budget.objects.create(user=self.user, category="Көлік", monthly_limit=5000)

    def patch_item(self, client, **changes):
        body = {"kind": "transaction", "id": self.item.id, "merchant": "Taxi", "category": "Көлік",
                "amount": 2200, "type": "expense", "txDate": timezone.localdate().isoformat(), "cardId": None}
        body.update(changes)
        return client.patch("/api/finance", data=json.dumps(body), content_type="application/json")

    def test_edit_updates_budget_totals(self):
        card = Card.objects.create(user=self.user, bank_name="Test", last4="1234", created_at=timezone.now())
        response = self.patch_item(self.client, cardId=card.id)
        self.assertEqual(response.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual((self.item.merchant, self.item.category, self.item.amount, self.item.card_id), ("Taxi", "Көлік", 2200, card.id))
        budgets = {item["category"]: item["spent"] for item in self.client.get("/api/finance").json()["budgets"]}
        self.assertEqual(budgets, {"Азық-түлік": 0, "Көлік": 2200})

    def test_edit_rejects_other_users_and_invalid_fields(self):
        self.assertEqual(self.patch_item(self.other_client).status_code, 404)
        self.assertEqual(self.patch_item(self.client, amount=-1).status_code, 400)
        self.assertEqual(self.patch_item(self.client, txDate="2026-02-30").status_code, 400)
        self.item.refresh_from_db()
        self.assertEqual(self.item.amount, 1000)
        self.assertEqual(self.item.category, "Азық-түлік")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", BEREKE_PROXY_SECRET="test-proxy-secret")
class ClientIpTests(TestCase):
    def setUp(self):
        cache.clear()

    def reset(self, ip, secret="test-proxy-secret", email="nobody@example.com"):
        return self.client.post("/api/password-reset", data=json.dumps({"email": email}),
            content_type="application/json", HTTP_X_BEREKE_CLIENT_IP=ip, HTTP_X_BEREKE_PROXY_SECRET=secret)

    def test_forwarded_ip_is_trusted_only_with_secret(self):
        from .views import client_ip
        from django.test import RequestFactory
        factory = RequestFactory()
        good = factory.get("/", HTTP_X_BEREKE_CLIENT_IP="203.0.113.7", HTTP_X_BEREKE_PROXY_SECRET="test-proxy-secret")
        bad = factory.get("/", HTTP_X_BEREKE_CLIENT_IP="203.0.113.7", HTTP_X_BEREKE_PROXY_SECRET="wrong")
        junk = factory.get("/", HTTP_X_BEREKE_CLIENT_IP="not-an-ip", HTTP_X_BEREKE_PROXY_SECRET="test-proxy-secret")
        self.assertEqual(client_ip(good), "203.0.113.7")
        self.assertEqual(client_ip(bad), "127.0.0.1")
        self.assertEqual(client_ip(junk), "127.0.0.1")

    def test_ip_limit_is_per_visitor_not_shared(self):
        for n in range(10):
            self.reset("198.51.100.1", email=f"a{n}@example.com")
        from .views import rate_limited
        # visitor A used up the reset-ip budget, visitor B still has a full one
        self.assertTrue(rate_limited("reset-ip", "198.51.100.1", 10, 3600))
        self.assertFalse(rate_limited("reset-ip", "198.51.100.2", 10, 3600))


class RateLimitWindowTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_uses_database_cache(self):
        from django.core.cache import caches
        from django.core.cache.backends.db import DatabaseCache
        self.assertIsInstance(caches["default"], DatabaseCache)

    def test_window_does_not_slide_on_each_attempt(self):
        from .views import rate_limited
        import time
        start = time.time()
        with patch("finance.views.time.time", return_value=start):
            for _ in range(3):
                self.assertFalse(rate_limited("t", "x", 3, 3600))
            self.assertTrue(rate_limited("t", "x", 3, 3600))
        # 50 minutes later the hour-long window is still closed
        with patch("finance.views.time.time", return_value=start + 3000):
            self.assertTrue(rate_limited("t", "x", 3, 3600))
        # after the window ends the counter starts over
        with patch("finance.views.time.time", return_value=start + 3601):
            self.assertFalse(rate_limited("t", "x", 3, 3600))

    def test_cache_entry_keeps_full_ttl(self):
        from .views import rate_limited
        from django.db import connection
        for _ in range(3):
            rate_limited("ttl", "y", 10, 3600)
        with connection.cursor() as cur:
            cur.execute("SELECT expires FROM bereke_cache")
            expires = cur.fetchone()[0]
        if timezone.is_naive(expires):
            expires = timezone.make_aware(expires, dt_timezone.utc)
        self.assertGreater(expires, timezone.now() + timedelta(minutes=50))


class SecurityHeaderTests(TestCase):
    def test_admin_cannot_be_framed(self):
        response = self.client.get("/admin/login/")
        self.assertEqual(response["X-Frame-Options"], "DENY")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AnalyticsTests(TestCase):
    """Period totals come from one SQL scope: current user + calendar-month date range."""
    TODAY = date(2026, 11, 15)
    # (owner, date, type, category, amount): boundary days sit exactly on window edges
    FIXTURE = [
        ("a", date(2026, 12, 1), "income", "Жалақы", 7000),     # next month: in no window
        ("a", date(2026, 11, 30), "income", "Жалақы", 1000),    # last day of current month: inside
        ("a", date(2026, 11, 1), "expense", "Азық-түлік", 200),  # first day of 1-month window
        ("a", date(2026, 10, 31), "expense", "Көлік", 300),      # one day before the 1-month window
        ("a", date(2026, 9, 1), "expense", "Азық-түлік", 400),   # first day of 3-month window
        ("a", date(2026, 8, 31), "expense", "Көлік", 500),       # one day before the 3-month window
        ("a", date(2026, 6, 1), "income", "Жалақы", 2000),       # first day of 6-month window
        ("a", date(2026, 5, 31), "expense", "Тұрғын үй", 600),   # one day before the 6-month window
        ("a", date(2025, 12, 1), "expense", "Көлік", 700),       # first day of 12-month window
        ("a", date(2025, 11, 30), "income", "Жалақы", 800),      # one day before the 12-month window
        ("b", date(2026, 11, 10), "expense", "Азық-түлік", 9999),  # another user: never counted
    ]

    def setUp(self):
        cache.clear()
        self.other = Client()
        for client, email, phone in ((self.client, "first@example.com", "+77001234567"),
                                     (self.other, "second@example.com", "+77001234568")):
            response = client.post("/api/auth", data=json.dumps({
                "action": "register", "name": "Test User", "email": email,
                "phone": phone, "password": "secure-password-123",
            }), content_type="application/json")
            self.assertEqual(confirm_last_code(client, response.json()["challengeId"]).status_code, 201)
        owners = {"a": Account.objects.get(email="first@example.com"), "b": Account.objects.get(email="second@example.com")}
        for owner, day, kind, category, amount in self.FIXTURE:
            Transaction.objects.create(user=owners[owner], merchant="Example", category=category, amount=amount,
                                       type=kind, tx_date=day, created_at=timezone.now())

    def get(self, months, client=None):
        with patch("finance.views.django_timezone.localdate", return_value=self.TODAY):
            return (client or self.client).get(f"/api/analytics?months={months}")

    def test_totals_categories_and_monthly_series_per_period(self):
        expected = {
            1: dict(income=1000, expense=200, balance=800, categories=[("Азық-түлік", 200)], previous=(0, 300),
                    monthly=[("2026-11", 1000, 200, 800)], start="2026-11-01"),
            3: dict(income=1000, expense=900, balance=100, categories=[("Азық-түлік", 600), ("Көлік", 300)], previous=(2000, 500),
                    monthly=[("2026-09", 0, 400, -400), ("2026-10", 0, 300, -700), ("2026-11", 1000, 200, 100)], start="2026-09-01"),
            6: dict(income=3000, expense=1400, balance=1600, categories=[("Көлік", 800), ("Азық-түлік", 600)], previous=(0, 1300),
                    monthly=None, start="2026-06-01"),
            12: dict(income=3000, expense=2700, balance=300, categories=[("Көлік", 1500), ("Азық-түлік", 600), ("Тұрғын үй", 600)], previous=(800, 0),
                     monthly=None, start="2025-12-01"),
        }
        for months, want in expected.items():
            body = self.get(months).json()
            self.assertEqual((body["income"], body["expense"], body["balance"]), (want["income"], want["expense"], want["balance"]), months)
            self.assertEqual([(c["category"], c["total"]) for c in body["categories"]], want["categories"], months)
            self.assertEqual((body["previous"]["income"], body["previous"]["expense"]), want["previous"], months)
            self.assertEqual((body["from"], body["to"]), (want["start"], "2026-11-30"), months)
            self.assertEqual(len(body["monthly"]), months)
            if want["monthly"]:
                self.assertEqual([(m["month"], m["income"], m["expense"], m["balance"]) for m in body["monthly"]], want["monthly"], months)

    def test_chart_and_numbers_share_one_dataset(self):
        for months in (1, 3, 6, 12):
            body = self.get(months).json()
            self.assertEqual(sum(m["income"] for m in body["monthly"]), body["income"])
            self.assertEqual(sum(m["expense"] for m in body["monthly"]), body["expense"])
            self.assertEqual(sum(c["total"] for c in body["categories"]), body["expense"])
            self.assertEqual(body["balance"], body["income"] - body["expense"])
            self.assertEqual(body["monthly"][-1]["balance"], body["balance"])  # chart line ends at the period balance

    def test_empty_account_returns_zero_state(self):
        newcomer = Client()
        response = newcomer.post("/api/auth", data=json.dumps({"action": "register", "name": "Empty", "email": "empty@example.com",
            "phone": "+77001234569", "password": "secure-password-123"}), content_type="application/json")
        confirm_last_code(newcomer, response.json()["challengeId"])
        for months in (1, 3, 6, 12):
            body = self.get(months, newcomer).json()
            self.assertEqual((body["income"], body["expense"], body["balance"], body["transactionCount"]), (0, 0, 0, 0))
            self.assertEqual(body["categories"], [])
            self.assertEqual(len(body["monthly"]), months)
            self.assertTrue(all(m["income"] == m["expense"] == m["balance"] == 0 for m in body["monthly"]))

    def test_other_users_data_is_never_counted(self):
        body = self.get(12, self.other).json()
        self.assertEqual((body["income"], body["expense"], body["transactionCount"]), (0, 9999, 1))

    def test_rejects_anonymous_and_invalid_period(self):
        self.assertEqual(Client().get("/api/analytics?months=3").status_code, 401)
        for bad in ("0", "2", "13", "abc", ""):
            self.assertEqual(self.get(bad).status_code, 400, bad)

    def test_window_wraps_year_boundaries(self):
        from .views import period_bounds
        self.assertEqual(period_bounds(3, date(2026, 1, 15)), (date(2025, 11, 1), date(2026, 2, 1)))
        self.assertEqual(period_bounds(1, date(2026, 12, 31)), (date(2026, 12, 1), date(2027, 1, 1)))
        self.assertEqual(period_bounds(12, date(2026, 2, 28)), (date(2025, 3, 1), date(2026, 3, 1)))
