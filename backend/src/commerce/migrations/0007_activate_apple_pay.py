from django.db import migrations


def activate_apple_pay(apps, schema_editor):
    PaymentMethod = apps.get_model("commerce", "PaymentMethod")
    PaymentMethod.objects.update_or_create(
        code="apple_pay",
        defaults={"name": "Apple Pay", "is_active": True},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0006_stripe_and_activate_card"),
    ]

    operations = [
        migrations.RunPython(activate_apple_pay, migrations.RunPython.noop),
    ]
