# Generated by Django 5.0 on 2025-01-01 21:42

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shares', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='sharedlink',
            name='permission_type',
        ),
        migrations.AddField(
            model_name='sharedlink',
            name='allow_download',
            field=models.BooleanField(default=False),
        ),
    ]
