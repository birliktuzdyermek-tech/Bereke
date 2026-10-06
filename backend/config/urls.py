from django.urls import path
from django.http import JsonResponse
from finance import views


def api_index(request):
    return JsonResponse({
        "status": "ok",
        "message": "Bereke Django API жұмыс істеп тұр",
        "endpoints": ["/api/auth", "/api/profile", "/api/finance", "/api/budgets"],
    })


urlpatterns = [
    path("", api_index),
    path("api/auth", views.auth_view),
    path("api/password-reset", views.password_reset_view),
    path("api/password-reset/confirm", views.password_reset_confirm_view),
    path("api/email-verification", views.email_verification_view),
    path("api/profile", views.profile_view),
    path("api/finance", views.finance_view),
    path("api/budgets", views.budgets_view),
]
