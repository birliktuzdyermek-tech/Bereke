from django.http import HttpResponse


class AdminLoginThrottle:
    """Limits password guessing on the Django admin login: 10 POSTs per 15 minutes from one address."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and request.path.rstrip("/").endswith("/admin/login"):
            from finance.views import client_ip, rate_limited  # imported late: the views need the apps to be ready
            if rate_limited("admin-login", client_ip(request), 10, 15 * 60):
                return HttpResponse("Тым көп әрекет. Он бес минуттан кейін қайталаңыз.", status=429, content_type="text/plain; charset=utf-8")
        return self.get_response(request)
