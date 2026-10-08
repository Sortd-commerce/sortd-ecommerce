from decimal import Decimal

from django.db import migrations, models


def seed_delivery_zones(apps, schema_editor):
    DeliveryZone = apps.get_model("commerce", "DeliveryZone")
    from commerce.delivery_zone_seeds import REFERENCE_DELIVERY_ZONES

    for row in REFERENCE_DELIVERY_ZONES:
        DeliveryZone.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "polygon": row["polygon"],
                "delivery_fee": row.get("delivery_fee", Decimal("0.00")),
                "sort_order": row.get("sort_order", 0),
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0009_delivery_promise_blank"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryZone",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("polygon", models.JSONField()),
                ("delivery_fee", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.DeleteModel(
            name="DeliveryPostalCode",
        ),
        migrations.RunPython(seed_delivery_zones, migrations.RunPython.noop),
    ]
