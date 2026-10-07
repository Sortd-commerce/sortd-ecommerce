from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0004_pricing_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="discount",
            name="benefit",
            field=models.CharField(
                choices=[("merchandise", "Merchandise discount"), ("free_delivery", "Free delivery")],
                default="merchandise",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="discount",
            name="detail",
            field=models.CharField(blank=True, max_length=240),
        ),
        migrations.AddField(
            model_name="discount",
            name="first_order_only",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="discount",
            name="headline",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="discount",
            name="max_discount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="discount",
            name="minimum_order",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
