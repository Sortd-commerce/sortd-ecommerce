from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0007_alter_labreport_pdf"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["status", "category"], name="catalog_product_status_cat"),
        ),
    ]
