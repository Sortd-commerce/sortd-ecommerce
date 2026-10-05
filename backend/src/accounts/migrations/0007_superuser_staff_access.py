from django.db import migrations


def grant_superusers_staff(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(is_superuser=True).update(is_staff=True, staff_role="admin")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_user_staff_role"),
    ]

    operations = [
        migrations.RunPython(grant_superusers_staff, migrations.RunPython.noop),
    ]
