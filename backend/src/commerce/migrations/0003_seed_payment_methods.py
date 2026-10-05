from django.db import migrations


def seed_payment_methods(apps, schema_editor):
    PaymentMethod = apps.get_model("commerce", "PaymentMethod")
    rows = [
        ("cod", "Cash on delivery", True),
        ("card", "Card", False),
        ("apple_pay", "Apple Pay", False),
    ]
    for code, name, is_active in rows:
        PaymentMethod.objects.get_or_create(
            code=code,
            defaults={"name": name, "is_active": is_active},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0002_seed_cod"),
    ]

    operations = [
        migrations.RunPython(seed_payment_methods, migrations.RunPython.noop),
    ]
