from django.db import migrations, models


def seed_existing_staff(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(is_staff=True).exclude(staff_role="member").update(staff_role="admin")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_devicesession"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="staff_role",
            field=models.CharField(blank=True, max_length=16),
        ),
        migrations.RunPython(seed_existing_staff, migrations.RunPython.noop),
    ]
