from django.db import models


class Account(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    name = models.CharField(max_length=80)
    email = models.EmailField(max_length=254, unique=True)
    phone = models.CharField(max_length=16, unique=True, null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.name} ({self.email})"


class LoginSession(models.Model):
    token_hash = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    expires_at = models.BigIntegerField()

    class Meta:
        db_table = "sessions"


class Card(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    bank_name = models.CharField(max_length=50)
    last4 = models.CharField(max_length=4)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "cards"

    def __str__(self):
        return f"{self.bank_name} •••• {self.last4}"


class Transaction(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    card = models.ForeignKey(Card, db_column="card_id", null=True, blank=True, on_delete=models.SET_NULL)
    merchant = models.CharField(max_length=80)
    category = models.CharField(max_length=40)
    amount = models.PositiveIntegerField()
    type = models.CharField(max_length=7)
    tx_date = models.DateField()
    created_at = models.DateTimeField()

    class Meta:
        db_table = "transactions"

    def __str__(self):
        return f"{self.merchant} — {self.amount} ₸"


class Subscription(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    merchant = models.CharField(max_length=80)
    monthly_amount = models.PositiveIntegerField()
    next_payment = models.DateField()
    status = models.CharField(max_length=9)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "subscriptions"

    def __str__(self):
        return self.merchant


class Budget(models.Model):
    user = models.ForeignKey(Account, db_column="user_id", on_delete=models.CASCADE)
    category = models.CharField(max_length=40)
    monthly_limit = models.PositiveIntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "budgets"
        constraints = [models.UniqueConstraint(fields=["user", "category"], name="unique_budget_user_category")]

    def __str__(self):
        return f"{self.category} — {self.monthly_limit} ₸"
