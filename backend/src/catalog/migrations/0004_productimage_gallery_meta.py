from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_product_offers_and_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="productimage",
            name="byte_size",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="productimage",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="productimage",
            name="original_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
