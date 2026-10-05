from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_emailverification_kind"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeviceSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("device_id", models.CharField(max_length=64)),
                ("label", models.CharField(blank=True, max_length=120)),
                ("user_agent", models.CharField(blank=True, max_length=400)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("refresh_jti", models.CharField(blank=True, max_length=64)),
                ("last_seen_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="device_sessions",
                        to="accounts.user",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="devicesession",
            index=models.Index(fields=["user", "revoked_at"], name="acct_ds_user_revoked_idx"),
        ),
        migrations.AddIndex(
            model_name="devicesession",
            index=models.Index(fields=["user", "device_id"], name="acct_ds_user_device_idx"),
        ),
        migrations.AddConstraint(
            model_name="devicesession",
            constraint=models.UniqueConstraint(fields=("user", "device_id"), name="unique_user_device"),
        ),
    ]
