from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_category_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="brand",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="product",
            name="shelf",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="product",
            name="tags",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="productvariant",
            name="max_order",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
