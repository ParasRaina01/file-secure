# Generated by Django 4.2 on 2025-01-20 20:19

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('files', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SharePermission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('max_downloads', models.IntegerField(default=1, help_text='Maximum number of downloads allowed. -1 for unlimited.')),
                ('downloads_used', models.IntegerField(default=0, help_text='Number of successful downloads')),
                ('is_download_enabled', models.BooleanField(default=True, help_text='Whether downloads are currently enabled')),
                ('last_downloaded_at', models.DateTimeField(blank=True, help_text='Timestamp of last successful download', null=True)),
                ('share_link_token', models.UUIDField(blank=True, default=uuid.uuid4, null=True, unique=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shares', to='files.file')),
                ('shared_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_by', to=settings.AUTH_USER_MODEL)),
                ('shared_with', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='shared_with', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='sharepermission',
            index=models.Index(fields=['share_link_token'], name='shares_shar_share_l_e2ec02_idx'),
        ),
        migrations.AddIndex(
            model_name='sharepermission',
            index=models.Index(fields=['file', 'shared_with'], name='shares_shar_file_id_37030c_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='sharepermission',
            unique_together={('file', 'shared_with')},
        ),
    ]
