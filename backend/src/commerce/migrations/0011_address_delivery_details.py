from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0010_delivery_zones"),
    ]

    operations = [
        migrations.AddField(
            model_name="address",
            name="label",
            field=models.CharField(default="other", max_length=16),
        ),
        migrations.AddField(
            model_name="address",
            name="community",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="address",
            name="building",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="address",
            name="unit",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="address",
            name="floor",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
