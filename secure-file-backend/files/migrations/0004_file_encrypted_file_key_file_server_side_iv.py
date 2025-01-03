# Generated by Django 5.0 on 2024-12-30 08:49

import files.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('files', '0003_remove_file_encryption_key'),
    ]

    operations = [
        migrations.AddField(
            model_name='file',
            name='encrypted_file_key',
            field=models.BinaryField(default=files.models.default_encrypted_key),
        ),
        migrations.AddField(
            model_name='file',
            name='server_side_iv',
            field=models.BinaryField(default=files.models.default_iv),
        ),
    ]
