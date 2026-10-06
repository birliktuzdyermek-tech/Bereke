import sqlite3
import hashlib
from datetime import date, datetime, timezone
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from finance.models import Account, Card, LoginSession, Subscription, Transaction


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class Command(BaseCommand):
    help = "Import all local D1 accounts, sessions and finance rows into Django. Safe to run again."

    def add_arguments(self, parser):
        parser.add_argument("source", type=Path, help="Path to the local D1 .sqlite file")

    def handle(self, *args, **options):
        source = options["source"].resolve()
        if not source.is_file():
            raise CommandError(f"Source database not found: {source}")
        connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            names = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            expected = {"users", "sessions", "cards", "transactions", "subscriptions"}
            if not expected.issubset(names):
                raise CommandError(f"Missing D1 tables: {', '.join(sorted(expected - names))}")
            rows = {name: [dict(row) for row in connection.execute(f"SELECT * FROM {name}")] for name in expected}
        finally:
            connection.close()

        now = datetime.now(timezone.utc)
        with transaction.atomic():
            for row in rows["users"]:
                Account.objects.get_or_create(id=row["id"], defaults={
                    "name": row["name"], "email": row["email"], "password_hash": row["password_hash"],
                    "created_at": timestamp(row["created_at"]),
                })
            owner_ids = {row["user_id"] for name in ("cards", "transactions", "subscriptions") for row in rows[name]}
            for owner_id in owner_ids:
                if not Account.objects.filter(id=owner_id).exists():
                    imported_email = f"imported-{hashlib.sha256(owner_id.encode()).hexdigest()[:32]}@invalid.local"
                    Account.objects.create(id=owner_id, name="Imported platform user",
                                           email=imported_email, password_hash=make_password(None),
                                           created_at=now)
            for row in rows["sessions"]:
                if Account.objects.filter(id=row["user_id"]).exists():
                    LoginSession.objects.get_or_create(token_hash=row["token_hash"], defaults={
                        "user_id": row["user_id"], "expires_at": row["expires_at"],
                    })
            for row in rows["cards"]:
                Card.objects.get_or_create(id=row["id"], defaults={
                    "user_id": row["user_id"], "bank_name": row["bank_name"], "last4": row["last4"],
                    "created_at": timestamp(row["created_at"]),
                })
            for row in rows["transactions"]:
                Transaction.objects.get_or_create(id=row["id"], defaults={
                    "user_id": row["user_id"], "card_id": row["card_id"], "merchant": row["merchant"],
                    "category": row["category"], "amount": row["amount"], "type": row["type"],
                    "tx_date": date.fromisoformat(row["tx_date"]), "created_at": timestamp(row["created_at"]),
                })
            for row in rows["subscriptions"]:
                Subscription.objects.get_or_create(id=row["id"], defaults={
                    "user_id": row["user_id"], "merchant": row["merchant"],
                    "monthly_amount": row["monthly_amount"], "next_payment": date.fromisoformat(row["next_payment"]),
                    "status": row["status"], "created_at": timestamp(row["created_at"]),
                })
        self.stdout.write(self.style.SUCCESS(
            "Imported " + ", ".join(f"{name}={len(rows[name])}" for name in sorted(expected))
        ))
