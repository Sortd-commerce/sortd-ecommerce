from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0003_seed_payment_methods"),
    ]

    operations = [
        migrations.CreateModel(
            name="CommerceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("delivery_fee", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                (
                    "free_delivery_minimum",
                    models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
                ),
            ],
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_fee",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
    ]
