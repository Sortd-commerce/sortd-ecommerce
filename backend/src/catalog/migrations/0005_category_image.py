import core.assets
import core.uploads
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_productimage_gallery_meta"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="image",
            field=models.FileField(
                blank=True,
                storage=core.assets.public_media_storage,
                upload_to="categories/images/",
                validators=[core.uploads.validate_image_file],
            ),
        ),
    ]
