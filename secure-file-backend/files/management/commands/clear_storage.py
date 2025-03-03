from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from files.models import File
from shares.models import SharePermission
import os
import shutil
from django.conf import settings

User = get_user_model()

class Command(BaseCommand):
    help = 'Clears all stored files and resets the database'

    def handle(self, *args, **options):
        # 1. Delete all files from disk
        uploads_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        if os.path.exists(uploads_dir):
            self.stdout.write('Removing all files from disk...')
            shutil.rmtree(uploads_dir)
            os.makedirs(uploads_dir)  # Recreate empty directory
            self.stdout.write(self.style.SUCCESS('✓ Files removed from disk'))

        # 2. Clear database tables
        self.stdout.write('Clearing database...')
        
        # Clear shares first (due to foreign key constraints)
        share_count = SharePermission.objects.count()
        SharePermission.objects.all().delete()
        self.stdout.write(f'✓ Removed {share_count} share permissions')

        # Clear files
        file_count = File.objects.count()
        File.objects.all().delete()
        self.stdout.write(f'✓ Removed {file_count} files')

        # Clear users (this will cascade delete everything else)
        user_count = User.objects.count()
        User.objects.all().delete()
        self.stdout.write(f'✓ Removed {user_count} users')

        self.stdout.write(self.style.SUCCESS('Storage cleared successfully!')) 