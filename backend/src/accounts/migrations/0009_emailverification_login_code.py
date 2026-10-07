from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_rename_acct_ds_user_revoked_idx_accounts_de_user_id_45e55c_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailverification",
            name="attempts",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="emailverification",
            name="kind",
            field=models.CharField(
                choices=[
                    ("verify", "Verify email"),
                    ("login", "Login code"),
                    ("reset", "Reset password"),
                ],
                default="verify",
                max_length=16,
            ),
        ),
    ]
