import json
import os
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

from .insights import build_insights
from .models import Account, Budget, Card, CancellationRequest, EmailChallenge, IgnoredSubscription, Insight, Subscription, Transaction


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
        for label in ("Сайт қолданушылары", "Операциялар", "Карталар", "Жазылымдар", "Бюджеттер", "Басқару тақтасы"):
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

    def test_seed_recurring_adds_example_payments_once_for_this_user_only(self):
        post = lambda client: client.post("/api/finance", data=json.dumps({"kind": "seed_recurring"}), content_type="application/json")
        self.assertEqual(post(self.client).status_code, 201)
        rows = Transaction.objects.filter(user=self.user, merchant__in=("Netflix", "Yandex Plus")).order_by("merchant", "tx_date")
        self.assertEqual(rows.count(), 6)
        netflix = [row.tx_date for row in rows if row.merchant == "Netflix"]
        self.assertTrue(all(25 <= (b - a).days <= 35 for a, b in zip(netflix, netflix[1:])))
        self.assertEqual(post(self.client).status_code, 400)
        self.assertEqual(Transaction.objects.filter(user=self.user, merchant="Netflix").count(), 3)
        self.assertFalse(Transaction.objects.exclude(user=self.user).exists())

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


class EnsureAdminTests(TestCase):
    """The admin user is created from the environment on every start, without touching an existing password."""
    def run_command(self, **env):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        with patch.dict(os.environ, {k: v for k, v in env.items()}, clear=False):
            call_command("ensure_admin", stdout=out)
        return out.getvalue()

    def setUp(self):
        for name in ("DJANGO_SUPERUSER_USERNAME", "DJANGO_SUPERUSER_PASSWORD", "DJANGO_SUPERUSER_EMAIL", "DJANGO_ADMIN_RESET_PASSWORD"):
            os.environ.pop(name, None)
        self.users = get_user_model()

    def test_creates_the_admin_with_a_working_login(self):
        output = self.run_command(DJANGO_SUPERUSER_PASSWORD="long-enough-password-1")
        user = self.users.objects.get(username="admin")
        self.assertTrue(user.is_staff and user.is_superuser and user.check_password("long-enough-password-1"))
        self.assertNotIn("long-enough-password-1", output)
        self.assertTrue(self.client.login(username="admin", password="long-enough-password-1"))
        self.assertEqual(self.client.get("/admin/").status_code, 200)

    def test_without_a_password_nothing_is_created(self):
        self.assertIn("not set", self.run_command())
        self.assertFalse(self.users.objects.filter(username="admin").exists())

    def test_a_short_password_is_refused(self):
        self.assertIn("at least 12", self.run_command(DJANGO_SUPERUSER_PASSWORD="short"))
        self.assertFalse(self.users.objects.filter(username="admin").exists())

    def test_existing_password_is_kept_unless_reset_is_requested(self):
        self.run_command(DJANGO_SUPERUSER_PASSWORD="first-long-password-1")
        self.run_command(DJANGO_SUPERUSER_PASSWORD="second-long-password-2")
        self.assertTrue(self.users.objects.get(username="admin").check_password("first-long-password-1"))
        self.run_command(DJANGO_SUPERUSER_PASSWORD="second-long-password-2", DJANGO_ADMIN_RESET_PASSWORD="1")
        self.assertTrue(self.users.objects.get(username="admin").check_password("second-long-password-2"))

    def test_a_demoted_admin_gets_access_back_and_the_username_is_configurable(self):
        self.users.objects.create_user("admin", "a@example.com", "old-password-123456", is_staff=False)
        self.run_command(DJANGO_SUPERUSER_PASSWORD="first-long-password-1")
        user = self.users.objects.get(username="admin")
        self.assertTrue(user.is_staff and user.is_superuser)
        self.assertTrue(user.check_password("old-password-123456"))
        self.run_command(DJANGO_SUPERUSER_USERNAME="owner", DJANGO_SUPERUSER_PASSWORD="owner-long-password-1")
        self.assertTrue(self.users.objects.filter(username="owner", is_superuser=True).exists())


class AdminDesignTests(TestCase):
    """The admin home shows a summary of the site data, finance sections come first, lists use Kazakh labels."""
    def setUp(self):
        self.admin_user = get_user_model().objects.create_superuser(username="site-admin", email="a@example.com", password="test-password-123")
        self.client.force_login(self.admin_user)
        self.account = Account.objects.create(id="design-1", name="Айгерім", email="aigerim@example.com", phone="+77001230001",
                                              password_hash="x", created_at=timezone.now(), email_verified_at=timezone.now())
        today = timezone.localdate()
        for kind, amount, merchant in (("income", 480000, "Жалақы"), ("expense", 28500, "Magnum"), ("expense", 6800, "Такси")):
            Transaction.objects.create(user=self.account, merchant=merchant, category="Азық-түлік", amount=amount, type=kind, tx_date=today, created_at=timezone.now())

    def test_dashboard_numbers_and_recent_lists(self):
        response = self.client.get("/admin/")
        dash = response.context["dashboard"]
        self.assertEqual(dash["accounts"]["total"], 1)
        self.assertEqual(dash["accounts"]["verified"], 1)
        self.assertEqual((dash["month_income"], dash["month_expense"], dash["month_balance"]), ("480 000 ₸", "35 300 ₸", "444 700 ₸"))
        self.assertEqual(len(dash["recent_transactions"]), 3)
        for text in ("480 000 ₸", "Айгерім", "Magnum", "Соңғы операциялар", "Соңғы тіркелгендер"):
            self.assertContains(response, text)

    def test_finance_sections_come_before_admin_users(self):
        apps = [app["app_label"] for app in self.client.get("/admin/").context["app_list"]]
        self.assertEqual(apps[:2], ["finance", "auth"])
        models = [m["object_name"] for m in self.client.get("/admin/").context["app_list"][0]["models"]]
        self.assertEqual(models, ["Account", "Transaction", "Card", "Subscription", "CancellationRequest", "Budget", "Insight", "IgnoredSubscription"])

    def test_transaction_list_shows_badges_signed_amounts_and_kazakh_filters(self):
        response = self.client.get("/admin/finance/transaction/")
        self.assertContains(response, "badge-in")
        self.assertContains(response, "badge-out")
        self.assertContains(response, "+480 000")
        self.assertContains(response, "−28 500")
        self.assertContains(response, "Түрі")
        self.assertNotContains(response, ">income<")
        filtered = self.client.get("/admin/finance/transaction/?type=income")
        self.assertContains(filtered, "Жалақы")
        self.assertNotContains(filtered, "Magnum")

    def test_other_lists_and_forms_render(self):
        for path in ("/admin/finance/account/", "/admin/finance/card/", "/admin/finance/subscription/", "/admin/finance/budget/",
                     "/admin/finance/transaction/add/", f"/admin/finance/account/{self.account.pk}/change/"):
            self.assertEqual(self.client.get(path).status_code, 200, path)
        self.assertContains(self.client.get("/admin/finance/account/?verified=yes"), "Айгерім")
        self.assertNotContains(self.client.get("/admin/finance/account/?verified=no"), "Айгерім")

    def test_branding_and_login_page(self):
        self.client.logout()
        login = self.client.get("/admin/login/")
        self.assertContains(login, "bereke-admin.css")
        self.assertContains(login, "Теңгерім")
        home = self.client.force_login(self.admin_user) or self.client.get("/admin/")
        self.assertContains(home, "Сайтқа өту")
        self.assertContains(home, "logo-mark.svg")


def login_client(email, phone):
    client = Client()
    response = client.post("/api/auth", data=json.dumps({"action": "register", "name": "Test User", "email": email,
        "phone": phone, "password": "secure-password-123"}), content_type="application/json")
    confirm_last_code(client, response.json()["challengeId"])
    return client, Account.objects.get(email=email)


class CancellationRequestTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client, self.user = login_client("owner@example.com", "+77001230011")
        self.other, self.other_user = login_client("other@example.com", "+77001230012")
        self.sub = Subscription.objects.create(user=self.user, merchant="Netflix", monthly_amount=3990,
                                               next_payment=timezone.localdate(), status="active", created_at=timezone.now())

    def post(self, client, body):
        return client.post("/api/finance", data=json.dumps(body), content_type="application/json")

    def patch(self, client, body):
        return client.patch("/api/finance", data=json.dumps(body), content_type="application/json")

    def test_request_is_saved_but_does_not_cancel_anything(self):
        response = self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["item"]["status"], "requested")
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, "active")  # the app cannot stop a real payment
        listed = self.client.get("/api/finance").json()["cancellations"]
        self.assertEqual([(row["subscriptionId"], row["status"]) for row in listed], [(self.sub.id, "requested")])

    def test_request_only_for_own_active_subscription_and_only_once(self):
        self.assertEqual(self.post(self.other, {"kind": "cancellation", "subscriptionId": self.sub.id}).status_code, 404)
        self.assertEqual(self.post(self.client, {"kind": "cancellation", "subscriptionId": "abc"}).status_code, 400)
        self.assertEqual(self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id}).status_code, 201)
        self.assertEqual(self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id}).status_code, 400)
        self.assertEqual(CancellationRequest.objects.count(), 1)
        self.assertEqual(self.other.get("/api/finance").json()["cancellations"], [])
        stopped = Subscription.objects.create(user=self.user, merchant="Old", monthly_amount=1000, next_payment=timezone.localdate(),
                                              status="cancelled", created_at=timezone.now())
        self.assertEqual(self.post(self.client, {"kind": "cancellation", "subscriptionId": stopped.id}).status_code, 400)

    def test_status_changes_follow_the_allowed_flow(self):
        item_id = self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id}).json()["item"]["id"]
        self.assertEqual(self.patch(self.other, {"kind": "cancellation", "id": item_id, "status": "completed"}).status_code, 404)
        self.assertEqual(self.patch(self.client, {"kind": "cancellation", "id": item_id, "status": "bogus"}).status_code, 400)
        done = self.patch(self.client, {"kind": "cancellation", "id": item_id, "status": "completed"})
        self.assertEqual((done.status_code, done.json()["item"]["status"], done.json()["subscription"]["status"]), (200, "completed", "cancelled"))
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, "cancelled")
        self.assertEqual(self.patch(self.client, {"kind": "cancellation", "id": item_id, "status": "withdrawn"}).status_code, 400)

    def test_withdrawn_request_leaves_subscription_active_and_allows_a_new_request(self):
        item_id = self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id}).json()["item"]["id"]
        self.assertEqual(self.patch(self.client, {"kind": "cancellation", "id": item_id, "status": "withdrawn"}).status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, "active")
        self.assertEqual(self.post(self.client, {"kind": "cancellation", "subscriptionId": self.sub.id}).status_code, 201)


class InsightRuleTests(TestCase):
    """Same cases as lib/insights.test.ts."""
    def stats(self, **changes):
        base = {"months": 3, "from": "2026-09-01", "to": "2026-11-30", "income": 0, "expense": 0, "balance": 0,
                "previous": {"income": 0, "expense": 0}, "categories": []}
        base.update(changes)
        return base

    def codes(self, stats, subs=0):
        return [tip["ruleCode"] for tip in build_insights(stats, subs)]

    def test_nothing_to_say_without_data(self):
        self.assertEqual(self.codes(self.stats()), [])

    def test_category_share_threshold_is_forty_percent(self):
        below = self.stats(expense=1000, income=5000, balance=4000, categories=[{"category": "Көлік", "total": 399}])
        at = self.stats(expense=1000, income=5000, balance=4000, categories=[{"category": "Көлік", "total": 400}])
        self.assertEqual(self.codes(below), [])
        tips = build_insights(at, 0)
        self.assertEqual([tip["ruleCode"] for tip in tips], ["category_share"])
        self.assertIn("40%", tips[0]["message"])
        self.assertIn("2026-09-01 — 2026-11-30", tips[0]["basis"])
        self.assertEqual((tips[0]["periodStart"], tips[0]["periodEnd"]), ("2026-09-01", "2026-11-30"))

    def test_growth_needs_a_previous_period_and_twenty_percent(self):
        grown = self.stats(expense=1200, income=9000, balance=7800, previous={"income": 0, "expense": 1000})
        self.assertEqual(self.codes(grown), ["expense_growth"])
        self.assertEqual(self.codes(self.stats(expense=1199, income=9000, balance=7801, previous={"income": 0, "expense": 1000})), [])
        self.assertEqual(self.codes(self.stats(expense=5000, income=9000, balance=4000, previous={"income": 0, "expense": 0})), [])

    def test_subscription_load_uses_average_monthly_expense(self):
        stats = self.stats(months=3, expense=30000, income=900000, balance=870000)  # average 10 000 / month
        self.assertEqual(self.codes(stats, 1000), ["subscription_load"])  # exactly 10 %
        self.assertEqual(self.codes(stats, 999), [])
        self.assertEqual(self.codes(stats, 0), [])

    def test_low_savings_below_ten_percent_of_income(self):
        self.assertEqual(self.codes(self.stats(income=1000, expense=901, balance=99)), ["low_savings"])
        self.assertEqual(self.codes(self.stats(income=1000, expense=900, balance=100)), [])
        tips = build_insights(self.stats(income=1000, expense=1500, balance=-500), 0)
        self.assertIn("0%", tips[0]["message"])
        self.assertEqual(self.codes(self.stats(income=0, expense=100, balance=-100)), [])


class InsightsApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client, self.user = login_client("tips@example.com", "+77001230021")
        self.other, self.other_user = login_client("tips2@example.com", "+77001230022")
        today = timezone.localdate()
        for amount, kind, category in ((100000, "income", "Жалақы"), (60000, "expense", "Тұрғын үй"), (35000, "expense", "Азық-түлік"), (3000, "expense", "Көлік")):
            Transaction.objects.create(user=self.user, merchant="x", category=category, amount=amount, type=kind, tx_date=today, created_at=timezone.now())
        Transaction.objects.create(user=self.other_user, merchant="x", category="Көлік", amount=999999, type="expense", tx_date=today, created_at=timezone.now())

    def test_requires_login_and_a_valid_period(self):
        self.assertEqual(Client().get("/api/insights?months=3").status_code, 401)
        self.assertEqual(self.client.get("/api/insights?months=5").status_code, 400)

    def test_tips_are_saved_once_with_period_and_creation_time(self):
        first = self.client.get("/api/insights?months=1").json()
        codes = [item["ruleCode"] for item in first["items"]]
        self.assertIn("category_share", codes)  # 60 000 of 98 000 = 61 %
        self.assertIn("low_savings", codes)     # 2 000 left of 100 000
        share = next(item for item in first["items"] if item["ruleCode"] == "category_share")
        self.assertIn("«Тұрғын үй»", share["message"])
        self.assertTrue(share["createdAt"] and share["periodStart"] <= share["periodEnd"])
        second = self.client.get("/api/insights?months=1").json()
        self.assertEqual(Insight.objects.filter(user=self.user).count(), len(codes))
        self.assertEqual([item["createdAt"] for item in second["items"]], [item["createdAt"] for item in first["items"]])

    def test_tips_use_only_the_owners_data(self):
        self.client.get("/api/insights?months=1")
        self.assertEqual(Insight.objects.filter(user=self.other_user).count(), 0)
        other_tips = self.other.get("/api/insights?months=1").json()["items"]
        self.assertTrue(all("Тұрғын" not in item["message"] for item in other_tips))
        self.assertEqual(Insight.objects.filter(user=self.user).exclude(user=self.user).count(), 0)


class ClosedGapsTests(TestCase):
    """Category/type check, card status, server-side ignore list and the admin login throttle."""
    def setUp(self):
        cache.clear()
        self.client, self.user = login_client("gaps@example.com", "+77001230031")
        self.other, self.other_user = login_client("gaps2@example.com", "+77001230032")

    def send(self, client, method, body):
        return getattr(client, method)("/api/finance", data=json.dumps(body), content_type="application/json")

    def tx(self, **changes):
        body = {"kind": "transaction", "merchant": "Test", "category": "Азық-түлік", "amount": 1000, "type": "expense",
                "txDate": timezone.localdate().isoformat(), "cardId": None}
        body.update(changes)
        return body

    def test_category_must_match_the_transaction_type(self):
        self.assertEqual(self.send(self.client, "post", self.tx()).status_code, 201)
        self.assertEqual(self.send(self.client, "post", self.tx(type="income", category="Жалақы")).status_code, 201)
        self.assertEqual(self.send(self.client, "post", self.tx(type="income", category="Көлік")).status_code, 400)
        self.assertEqual(self.send(self.client, "post", self.tx(type="expense", category="Жалақы")).status_code, 400)
        self.assertEqual(self.send(self.client, "post", self.tx(category="Ойлап тапқан санат")).status_code, 400)
        item = Transaction.objects.filter(user=self.user).first()
        edit = self.tx(id=item.id, type="income", category="Көлік")
        self.assertEqual(self.send(self.client, "patch", edit).status_code, 400)
        item.refresh_from_db()
        self.assertEqual((item.type, item.category), ("expense", "Азық-түлік"))

    def test_card_status_can_be_changed_by_the_owner_only(self):
        card = Card.objects.create(user=self.user, bank_name="Test", last4="1234", created_at=timezone.now())
        self.assertEqual(self.client.get("/api/finance").json()["cards"][0]["status"], "active")
        self.assertEqual(self.send(self.other, "patch", {"kind": "card", "id": card.id, "status": "inactive"}).status_code, 404)
        self.assertEqual(self.send(self.client, "patch", {"kind": "card", "id": card.id, "status": "bogus"}).status_code, 400)
        response = self.send(self.client, "patch", {"kind": "card", "id": card.id, "status": "inactive"})
        self.assertEqual((response.status_code, response.json()["item"]["status"]), (200, "inactive"))
        card.refresh_from_db()
        self.assertEqual(card.status, "inactive")

    def test_ignored_sellers_are_stored_per_user_and_can_be_restored(self):
        self.assertEqual(self.send(self.client, "post", {"kind": "ignore_subscription", "key": "Netflix"}).status_code, 201)
        self.assertEqual(self.send(self.client, "post", {"kind": "ignore_subscription", "key": "netflix"}).status_code, 201)
        self.assertEqual(IgnoredSubscription.objects.filter(user=self.user).count(), 1)
        self.assertEqual(self.client.get("/api/finance").json()["ignoredSubscriptions"], ["netflix"])
        self.assertEqual(self.other.get("/api/finance").json()["ignoredSubscriptions"], [])
        self.assertEqual(self.send(self.client, "post", {"kind": "ignore_subscription", "key": "  "}).status_code, 400)
        self.assertEqual(self.send(self.other, "post", {"kind": "unignore_subscription", "key": "netflix"}).status_code, 200)
        self.assertEqual(IgnoredSubscription.objects.filter(user=self.user).count(), 1)  # someone else's restore changes nothing
        self.assertEqual(self.send(self.client, "post", {"kind": "unignore_subscription", "key": "netflix"}).status_code, 200)
        self.assertEqual(self.client.get("/api/finance").json()["ignoredSubscriptions"], [])

    def test_admin_login_attempts_are_limited(self):
        statuses = [Client().post("/admin/login/", {"username": "nobody", "password": "wrong"}).status_code for _ in range(12)]
        self.assertEqual(statuses[:10].count(429), 0)
        self.assertEqual(statuses[10:], [429, 429])


class SecurityScenarioTests(TestCase):
    """Negative scenarios of the 14th lesson: injection, XSS payloads, foreign ids, CSRF, sessions, password storage."""
    def setUp(self):
        cache.clear()
        self.client, self.user = login_client("sec@example.com", "+77001230041")
        self.other, self.other_user = login_client("sec2@example.com", "+77001230042")

    def post(self, client, body):
        return client.post("/api/finance", data=json.dumps(body), content_type="application/json")

    def tx(self, **changes):
        body = {"kind": "transaction", "merchant": "Test", "category": "Азық-түлік", "amount": 1000, "type": "expense",
                "txDate": timezone.localdate().isoformat(), "cardId": None}
        body.update(changes)
        return body

    def test_sql_injection_text_is_stored_as_plain_text(self):
        payload = "x'); DROP TABLE transactions; --"
        self.assertEqual(self.post(self.client, self.tx(merchant=payload)).status_code, 201)
        self.assertEqual(Transaction.objects.filter(user=self.user, merchant=payload).count(), 1)
        self.assertEqual(self.client.get("/api/analytics?months=3' OR '1'='1").status_code, 400)
        self.assertEqual(self.client.get("/api/finance?id=1 OR 1=1").status_code, 200)
        self.assertEqual(self.client.delete("/api/finance?id=1 OR 1=1").status_code, 400)
        self.assertTrue(Transaction.objects.filter(user=self.user).exists())

    def test_html_payload_comes_back_as_json_text_with_nosniff(self):
        payload = "<script>alert(1)</script>"
        self.post(self.client, self.tx(merchant=payload))
        response = self.client.get("/api/finance")
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.json()["transactions"][0]["merchant"], payload)  # escaped later by React when rendered

    def test_foreign_user_id_in_the_body_is_ignored(self):
        response = self.post(self.client, self.tx(userId=self.other_user.id, user_id=self.other_user.id))
        self.assertEqual(response.status_code, 201)
        item = Transaction.objects.get(id=response.json()["item"]["id"])
        self.assertEqual(item.user_id, self.user.id)
        self.assertEqual(Transaction.objects.filter(user=self.other_user).count(), 0)

    def test_other_users_records_cannot_be_read_changed_or_deleted(self):
        item = Transaction.objects.create(user=self.user, merchant="Mine", category="Көлік", amount=500, type="expense",
                                          tx_date=timezone.localdate(), created_at=timezone.now())
        self.assertEqual(self.other.get("/api/finance").json()["transactions"], [])
        self.assertEqual(self.other.delete(f"/api/finance?id={item.id}").status_code, 404)
        change = self.tx(id=item.id, merchant="Hacked")
        self.assertEqual(self.other.patch("/api/finance", data=json.dumps(change), content_type="application/json").status_code, 404)
        item.refresh_from_db()
        self.assertEqual(item.merchant, "Mine")

    def test_unauthenticated_requests_are_rejected_everywhere(self):
        anonymous = Client()
        for path in ("/api/finance", "/api/analytics?months=3", "/api/insights?months=3", "/api/budgets"):
            self.assertEqual(anonymous.get(path).status_code, 401, path)
        self.assertEqual(anonymous.post("/api/finance", data=json.dumps(self.tx()), content_type="application/json").status_code, 401)
        self.assertEqual(anonymous.patch("/api/profile", data=json.dumps({"name": "Hacker"}), content_type="application/json").status_code, 401)

    def test_post_without_csrf_token_is_refused(self):
        strict = Client(enforce_csrf_checks=True)
        strict.cookies.update(self.client.cookies)  # same signed-in session, but CSRF is now enforced
        token = strict.get("/api/auth").cookies["csrftoken"].value
        body = json.dumps(self.tx())
        self.assertEqual(strict.post("/api/finance", data=body, content_type="application/json").status_code, 403)
        self.assertEqual(strict.post("/api/finance", data=body, content_type="application/json", HTTP_X_CSRFTOKEN="wrong-token").status_code, 403)
        self.assertEqual(strict.post("/api/finance", data=body, content_type="application/json", HTTP_X_CSRFTOKEN=token).status_code, 201)
        self.assertEqual(strict.delete("/api/auth").status_code, 403)

    def test_logout_ends_the_session_and_the_old_cookie_stops_working(self):
        old_cookie = self.client.cookies["bereke_session"].value
        self.assertEqual(self.client.get("/api/finance").status_code, 200)
        self.assertEqual(self.client.delete("/api/auth").status_code, 200)
        self.assertEqual(self.client.get("/api/finance").status_code, 401)
        replay = Client()
        replay.cookies["bereke_session"] = old_cookie
        self.assertEqual(replay.get("/api/finance").status_code, 401)

    def test_password_is_stored_as_a_hash_and_never_returned(self):
        self.assertNotIn("secure-password-123", self.user.password_hash)
        self.assertTrue(self.user.password_hash.startswith(("pbkdf2_", "argon2", "bcrypt")))
        self.assertNotIn("password", json.dumps(self.client.get("/api/auth").json()).lower())
        self.assertNotIn("hash", json.dumps(self.client.get("/api/finance").json()).lower())
