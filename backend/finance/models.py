from django.db import models
import uuid


class Account(models.Model):
    id = models.CharField("ID", max_length=255, primary_key=True)
    name = models.CharField("Аты-жөні", max_length=80)
    email = models.EmailField("Email", max_length=254, unique=True)
    phone = models.CharField("Телефон", max_length=16, unique=True, null=True, blank=True)
    email_verified_at = models.DateTimeField("Email расталған уақыты", null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField("Тіркелген уақыты")

    class Meta:
        db_table = "users"
        verbose_name = "сайт қолданушысы"
        verbose_name_plural = "Сайт қолданушылары"

    def __str__(self):
        return f"{self.name} ({self.email})"


class LoginSession(models.Model):
    token_hash = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    expires_at = models.BigIntegerField()

    class Meta:
        db_table = "sessions"


class EmailChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purpose = models.CharField(max_length=8)
    email = models.EmailField(max_length=254)
    code_hash = models.CharField(max_length=64)
    user = models.ForeignKey(Account, null=True, blank=True, on_delete=models.CASCADE)
    pending_name = models.CharField(max_length=80, blank=True)
    pending_phone = models.CharField(max_length=16, blank=True)
    pending_password_hash = models.CharField(max_length=255, blank=True)
    password_fingerprint = models.CharField(max_length=64, blank=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "email_challenges"


class Card(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE, verbose_name="Қолданушы")
    bank_name = models.CharField("Банк немесе карта атауы", max_length=50)
    last4 = models.CharField("Соңғы 4 сан", max_length=4)
    created_at = models.DateTimeField("Қосылған уақыты")

    class Meta:
        db_table = "cards"
        verbose_name = "карта"
        verbose_name_plural = "Карталар"

    def __str__(self):
        return f"{self.bank_name} •••• {self.last4}"


class Transaction(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE, verbose_name="Қолданушы")
    card = models.ForeignKey(Card, db_column="card_id", null=True, blank=True, on_delete=models.SET_NULL, verbose_name="Карта")
    merchant = models.CharField("Атауы", max_length=80)
    category = models.CharField("Санат", max_length=40)
    amount = models.PositiveIntegerField("Сома, ₸")
    type = models.CharField("Түрі", max_length=7)
    tx_date = models.DateField("Күні")
    created_at = models.DateTimeField("Енгізілген уақыты")

    class Meta:
        db_table = "transactions"
        verbose_name = "операция"
        verbose_name_plural = "Операциялар"

    def __str__(self):
        return f"{self.merchant} — {self.amount} ₸"


class Subscription(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE, verbose_name="Қолданушы")
    merchant = models.CharField("Сервис", max_length=80)
    monthly_amount = models.PositiveIntegerField("Айлық төлем, ₸")
    next_payment = models.DateField("Келесі төлем")
    status = models.CharField("Күйі", max_length=9)
    created_at = models.DateTimeField("Қосылған уақыты")

    class Meta:
        db_table = "subscriptions"
        verbose_name = "жазылым"
        verbose_name_plural = "Жазылымдар"

    def __str__(self):
        return self.merchant


class Budget(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE, verbose_name="Қолданушы")
    category = models.CharField("Санат", max_length=40)
    monthly_limit = models.PositiveIntegerField("Айлық лимит, ₸")
    updated_at = models.DateTimeField("Жаңартылған уақыты", auto_now=True)

    class Meta:
        db_table = "budgets"
        verbose_name = "бюджет"
        verbose_name_plural = "Бюджеттер"
        constraints = [models.UniqueConstraint(fields=["user", "category"], name="unique_budget_user_category")]

    def __str__(self):
        return f"{self.category} — {self.monthly_limit} ₸"
