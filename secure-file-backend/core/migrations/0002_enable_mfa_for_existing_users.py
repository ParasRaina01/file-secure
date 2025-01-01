from django.db import migrations
import pyotp

def enable_mfa_for_existing_users(apps, schema_editor):
    User = apps.get_model('core', 'User')
    for user in User.objects.filter(mfa_enabled=False):
        user.mfa_enabled = True
        user.mfa_secret = pyotp.random_base32()
        user.save()

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(enable_mfa_for_existing_users),
    ] 