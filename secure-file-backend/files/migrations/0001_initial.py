# Generated by Django 5.0.2 on 2024-12-29 20:59

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='File',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filename', models.CharField(max_length=255)),
                ('encrypted_filename', models.CharField(max_length=255, unique=True)),
                ('original_file_size', models.BigIntegerField()),
                ('upload_timestamp', models.DateTimeField(auto_now_add=True)),
                ('encryption_iv', models.CharField(max_length=255)),
                ('mime_type', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'file',
                'verbose_name_plural': 'files',
                'ordering': ['-upload_timestamp'],
            },
        ),
    ]
