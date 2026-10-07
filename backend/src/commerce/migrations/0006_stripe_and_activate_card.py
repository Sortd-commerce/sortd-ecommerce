from django.db import migrations, models


def activate_card(apps, schema_editor):
    PaymentMethod = apps.get_model("commerce", "PaymentMethod")
    PaymentMethod.objects.update_or_create(
        code="card",
        defaults={"name": "Credit or debit card", "is_active": True},
    )
    PaymentMethod.objects.filter(code="apple_pay").update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0005_discount_coupon_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="stripe_payment_intent_id",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.RunPython(activate_card, migrations.RunPython.noop),
    ]
