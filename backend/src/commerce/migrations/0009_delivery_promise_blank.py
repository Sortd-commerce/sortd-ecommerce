from django.db import migrations, models


def scrub_delivery_promise(apps, schema_editor):
    CommerceSettings = apps.get_model("commerce", "CommerceSettings")
    for row in CommerceSettings.objects.all():
        value = (row.delivery_promise or "").strip()
        if not value or value.lower() == "null":
            row.delivery_promise = ""
            row.save(update_fields=["delivery_promise"])


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0008_commerce_delivery_promise"),
    ]

    operations = [
        migrations.AlterField(
            model_name="commercesettings",
            name="delivery_promise",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RunPython(scrub_delivery_promise, migrations.RunPython.noop),
    ]
