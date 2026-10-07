from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0007_activate_apple_pay"),
    ]

    operations = [
        migrations.AddField(
            model_name="commercesettings",
            name="delivery_promise",
            field=models.CharField(default="Delivery in 30 minutes", max_length=120),
        ),
    ]
