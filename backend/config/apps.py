from django.contrib.admin.apps import AdminConfig
from django.contrib.auth.apps import AuthConfig


class BerekeAdminConfig(AdminConfig):
    default_site = "config.admin_site.BerekeAdminSite"


class BerekeAuthConfig(AuthConfig):
    verbose_name = "Әкімшілер"

    def ready(self):
        super().ready()
        # Runtime-only names: they do not change the migration state of the auth app.
        from django.contrib.auth.models import Group, User
        User._meta.verbose_name, User._meta.verbose_name_plural = "әкімші", "Әкімшілер"
        Group._meta.verbose_name, Group._meta.verbose_name_plural = "топ", "Топтар"
