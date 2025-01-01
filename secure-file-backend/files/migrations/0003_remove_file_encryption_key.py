from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('files', '0002_file_encryption_key_alter_file_encryption_iv'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='file',
            name='encryption_key',
        ),
        migrations.AlterField(
            model_name='file',
            name='encryption_iv',
            field=models.BinaryField(),
        ),
    ] 