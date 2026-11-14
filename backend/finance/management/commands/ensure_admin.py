import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

MIN_PASSWORD_LENGTH = 12


class Command(BaseCommand):
    help = (
        "Create the Django admin user from DJANGO_SUPERUSER_USERNAME (default admin) and "
        "DJANGO_SUPERUSER_PASSWORD. Runs on every start, never fails the boot, and never prints the password. "
        "An existing user keeps its password unless DJANGO_ADMIN_RESET_PASSWORD=1."
    )

    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin").strip() or "admin"
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "").strip()
        reset = os.environ.get("DJANGO_ADMIN_RESET_PASSWORD") == "1"
        if not password:
            self.stdout.write("ensure_admin: DJANGO_SUPERUSER_PASSWORD is not set, no admin user created.")
            return
        if len(password) < MIN_PASSWORD_LENGTH:
            self.stdout.write(self.style.WARNING(
                f"ensure_admin: the password must have at least {MIN_PASSWORD_LENGTH} characters, nothing changed."))
            return
        users = get_user_model()
        try:
            user = users.objects.filter(**{users.USERNAME_FIELD: username}).first()
            if user is None:
                users.objects.create_superuser(username, email, password)
                self.stdout.write(f"ensure_admin: created the admin user '{username}'.")
                return
            changed = []
            if not (user.is_staff and user.is_superuser and user.is_active):
                user.is_staff = user.is_superuser = user.is_active = True
                changed.append("access")
            if reset:
                user.set_password(password)
                changed.append("password")
            if email and user.email != email:
                user.email = email
                changed.append("email")
            if changed:
                user.save()
            self.stdout.write(f"ensure_admin: '{username}' exists" + (f", updated {', '.join(changed)}." if changed else ", left unchanged."))
        except Exception as error:  # a failure here must not stop the site from starting
            self.stdout.write(self.style.WARNING(f"ensure_admin: skipped ({type(error).__name__})."))
