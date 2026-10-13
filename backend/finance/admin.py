from django import forms
from django.conf import settings
from django.contrib import admin
from django.utils import timezone

from .models import Account, Budget, Card, Subscription, Transaction


admin.site.site_header = "Теңгерім әкімшілігі"
admin.site.site_title = "Теңгерім әкімшілігі"
admin.site.index_title = "Сайт әкімшілігі"
admin.site.site_url = settings.FRONTEND_URL


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "email_verified", "created_at")
    search_fields = ("name", "email", "phone")
    list_filter = ("email_verified_at", "created_at")
    fields = ("id", "name", "email", "phone", "email_verified_at", "created_at")
    readonly_fields = ("id", "email_verified_at", "created_at")

    @admin.display(boolean=True, description="Email расталды")
    def email_verified(self, obj):
        return bool(obj.email_verified_at)

    def has_add_permission(self, request):
        return False  # Registration creates accounts with hashed passwords.

    def has_delete_permission(self, request, obj=None):
        return False  # Deleting an account would cascade to all finance records.

    def save_model(self, request, obj, form, change):
        if change and "email" in form.changed_data:
            obj.email_verified_at = None
        super().save_model(request, obj, form, change)


class CreatedAtAdmin(admin.ModelAdmin):
    readonly_fields = ("created_at",)
    list_select_related = ("user",)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_at = timezone.now()
        super().save_model(request, obj, form, change)


class CardAdminForm(forms.ModelForm):
    class Meta:
        model = Card
        fields = "__all__"

    def clean_last4(self):
        value = self.cleaned_data["last4"]
        if len(value) != 4 or not value.isascii() or not value.isdigit():
            raise forms.ValidationError("Картаның соңғы төрт санын енгізіңіз.")
        return value


@admin.register(Card)
class CardAdmin(CreatedAtAdmin):
    form = CardAdminForm
    list_display = ("bank_name", "last4", "user", "created_at")
    search_fields = ("bank_name", "user__name", "user__email")
    fields = ("user", "bank_name", "last4", "created_at")


class TransactionAdminForm(forms.ModelForm):
    type = forms.ChoiceField(choices=(("income", "Кіріс"), ("expense", "Шығыс")))

    class Meta:
        model = Transaction
        fields = "__all__"

    def clean(self):
        data = super().clean()
        user, card = data.get("user"), data.get("card")
        if user and card and card.user_id != user.pk:
            self.add_error("card", "Карта осы қолданушыға тиесілі болуы керек.")
        amount = data.get("amount")
        if amount is not None and not 1 <= amount <= 1_000_000_000:
            self.add_error("amount", "Сома 1 мен 1 000 000 000 аралығында болуы керек.")
        return data


@admin.register(Transaction)
class TransactionAdmin(CreatedAtAdmin):
    form = TransactionAdminForm
    list_display = ("merchant", "user", "category", "amount", "type", "tx_date")
    list_filter = ("type", "category", "tx_date")
    search_fields = ("merchant", "category", "user__name", "user__email")
    date_hierarchy = "tx_date"
    fields = ("user", "card", "merchant", "category", "amount", "type", "tx_date", "created_at")


class SubscriptionAdminForm(forms.ModelForm):
    status = forms.ChoiceField(choices=(("active", "Белсенді"), ("cancelled", "Тоқтатылды")))

    class Meta:
        model = Subscription
        fields = "__all__"

    def clean_monthly_amount(self):
        amount = self.cleaned_data["monthly_amount"]
        if not 1 <= amount <= 1_000_000_000:
            raise forms.ValidationError("Сома 1 мен 1 000 000 000 аралығында болуы керек.")
        return amount


@admin.register(Subscription)
class SubscriptionAdmin(CreatedAtAdmin):
    form = SubscriptionAdminForm
    list_display = ("merchant", "user", "monthly_amount", "next_payment", "status")
    list_filter = ("status", "next_payment")
    search_fields = ("merchant", "user__name", "user__email")
    fields = ("user", "merchant", "monthly_amount", "next_payment", "status", "created_at")


class BudgetAdminForm(forms.ModelForm):
    class Meta:
        model = Budget
        fields = "__all__"

    def clean_monthly_limit(self):
        amount = self.cleaned_data["monthly_limit"]
        if not 1 <= amount <= 1_000_000_000:
            raise forms.ValidationError("Лимит 1 мен 1 000 000 000 аралығында болуы керек.")
        return amount


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    form = BudgetAdminForm
    list_display = ("category", "user", "monthly_limit", "updated_at")
    list_filter = ("category",)
    list_select_related = ("user",)
    search_fields = ("category", "user__name", "user__email")
    readonly_fields = ("updated_at",)
    fields = ("user", "category", "monthly_limit", "updated_at")
