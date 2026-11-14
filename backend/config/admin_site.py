from datetime import timedelta

from django.contrib import admin
from django.db.models import Count, Q, Sum
from django.utils import timezone


def money(value):
    return f"{int(value or 0):,}".replace(",", " ") + " ₸"


class BerekeAdminSite(admin.AdminSite):
    """Admin site in the look of the product: finance data first, a summary on the home page."""
    site_header = "Теңгерім"
    site_title = "Теңгерім әкімшілігі"
    index_title = "Басқару тақтасы"
    APP_ORDER = {"finance": 0, "auth": 1}
    MODEL_ORDER = ("account", "transaction", "card", "subscription", "budget")

    def get_app_list(self, request, app_label=None):
        apps = super().get_app_list(request, app_label)
        apps.sort(key=lambda app: self.APP_ORDER.get(app["app_label"], 9))
        for app in apps:
            if app["app_label"] == "finance":
                app["models"].sort(key=lambda m: self.MODEL_ORDER.index(m["object_name"].lower()) if m["object_name"].lower() in self.MODEL_ORDER else 9)
        return apps

    def dashboard(self):
        from finance.models import Account, Budget, Subscription, Transaction  # imported late: apps must be ready
        now = timezone.now()
        month_start = timezone.localdate().replace(day=1)
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        month = Transaction.objects.filter(tx_date__gte=month_start, tx_date__lt=next_month).aggregate(
            income=Sum("amount", filter=Q(type="income")), expense=Sum("amount", filter=Q(type="expense")), count=Count("id"))
        accounts = Account.objects.aggregate(total=Count("id"), verified=Count("id", filter=Q(email_verified_at__isnull=False)),
                                             week=Count("id", filter=Q(created_at__gte=now - timedelta(days=7))))
        subscriptions = Subscription.objects.filter(status="active").aggregate(count=Count("id"), total=Sum("monthly_amount"))
        recent = [{"obj": tx, "income": tx.type == "income", "amount": money(tx.amount)}
                  for tx in Transaction.objects.select_related("user").order_by("-created_at", "-id")[:5]]
        return {
            "accounts": accounts, "month_count": month["count"], "month_income": money(month["income"]), "month_expense": money(month["expense"]),
            "month_balance": money((month["income"] or 0) - (month["expense"] or 0)), "balance_negative": (month["income"] or 0) < (month["expense"] or 0),
            "subscriptions": subscriptions["count"], "subscriptions_total": money(subscriptions["total"]), "budgets": Budget.objects.count(),
            "recent_accounts": Account.objects.order_by("-created_at")[:5], "recent_transactions": recent, "month_label": month_start.strftime("%m.%Y"),
        }

    def index(self, request, extra_context=None):
        extra = dict(extra_context or {})
        extra["dashboard"] = self.dashboard()
        return super().index(request, extra)
