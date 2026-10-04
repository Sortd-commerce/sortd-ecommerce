from django.db import migrations


def seed_cod(apps, schema_editor):
    PaymentMethod = apps.get_model("commerce", "PaymentMethod")
    PaymentMethod.objects.get_or_create(code="cod", defaults={"name": "Cash on delivery", "is_active": True})


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_cod, migrations.RunPython.noop),
    ]
