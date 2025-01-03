# Generated by Django 5.0.2 on 2024-12-29 20:59

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('files', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SharedLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('link_uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('permission_type', models.CharField(choices=[('view', 'View'), ('download', 'Download')], max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_shared_links', to=settings.AUTH_USER_MODEL)),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_links', to='files.file')),
            ],
            options={
                'verbose_name': 'shared link',
                'verbose_name_plural': 'shared links',
            },
        ),
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('permission_type', models.CharField(choices=[('view', 'View'), ('download', 'Download')], max_length=50)),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='permissions', to='files.file')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='file_permissions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'permission',
                'verbose_name_plural': 'permissions',
                'unique_together': {('file', 'user')},
            },
        ),
    ]
