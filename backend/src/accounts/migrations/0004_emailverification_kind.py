from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_mark_existing_users_verified"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailverification",
            name="kind",
            field=models.CharField(
                choices=[("verify", "Verify email"), ("reset", "Reset password")],
                default="verify",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="emailverification",
            index=models.Index(fields=["user", "kind"], name="accounts_em_user_id_a7dd3c_idx"),
        ),
    ]
