from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Send a test message to DJANGO_EMAIL_USER using the configured email backend."

    def handle(self, *args, **options):
        recipient = settings.EMAIL_HOST_USER
        if not recipient:
            raise CommandError("DJANGO_EMAIL_USER is not set")
        try:
            sent = send_mail(
                "Tengerim SMTP test",
                "Gmail email delivery is configured.",
                settings.DEFAULT_FROM_EMAIL,
                [recipient],
                fail_silently=False,
            )
        except Exception as exc:
            raise CommandError(f"Email delivery failed: {exc}") from exc
        if sent != 1:
            raise CommandError("Email backend did not accept the test message")
        self.stdout.write(self.style.SUCCESS("Test email accepted by the configured backend."))
