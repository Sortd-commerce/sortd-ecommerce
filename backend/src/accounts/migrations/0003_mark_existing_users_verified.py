from django.db import migrations
from django.db.models import F


def mark_verified(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email_verified_at__isnull=True).update(email_verified_at=F("date_joined"))


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_email_verified_at_user_phone_emailverification"),
    ]

    operations = [
        migrations.RunPython(mark_verified, migrations.RunPython.noop),
    ]
