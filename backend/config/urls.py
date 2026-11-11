from django.urls import path
from django.http import JsonResponse
from django.contrib import admin
from finance import views


def api_index(request):
    return JsonResponse({
        "status": "ok",
        "message": "Теңгерім Django API жұмыс істеп тұр",
        "endpoints": ["/api/auth", "/api/profile", "/api/finance", "/api/analytics", "/api/budgets"],
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", api_index),
    path("api/auth", views.auth_view),
    path("api/password-reset", views.password_reset_view),
    path("api/password-reset/confirm", views.password_reset_confirm_view),
    path("api/email-verification", views.email_verification_view),
    path("api/profile", views.profile_view),
    path("api/finance", views.finance_view),
    path("api/analytics", views.analytics_view),
    path("api/budgets", views.budgets_view),
]
