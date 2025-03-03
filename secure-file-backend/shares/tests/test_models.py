from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from files.models import File
from shares.models import SharePermission
from django.utils import timezone
from datetime import timedelta
import uuid

User = get_user_model()

class SharePermissionModelTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@test.com',
            password='testpass123'
        )
        self.recipient = User.objects.create_user(
            email='recipient@test.com',
            password='testpass123'
        )
        
        self.file = File.objects.create(
            user=self.owner,
            filename='test.txt',
            encryption_iv='0' * 32,
            original_file_size=100,
            mime_type='text/plain'
        )

    def test_create_share_permission(self):
        """Test creating a basic share permission"""
        share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            allow_download=True
        )
        self.assertTrue(isinstance(share, SharePermission))
        self.assertTrue(share.allow_download)
        self.assertTrue(share.can_download(self.recipient))

    def test_prevent_duplicate_share(self):
        """Test that duplicate shares are prevented"""
        SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            allow_download=True
        )
        
        with self.assertRaises(ValidationError):
            SharePermission.objects.create(
                file=self.file,
                shared_by=self.owner,
                shared_with=self.recipient,
                allow_download=False
            )

    def test_share_expiration(self):
        """Test share expiration functionality"""
        # Create expired share
        expired_share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            allow_download=True,
            expires_at=timezone.now() - timedelta(days=1)
        )
        self.assertTrue(expired_share.is_expired())
        self.assertFalse(expired_share.can_download(self.recipient))

        # Create active share
        other_user = User.objects.create_user(
            email='other@test.com',
            password='testpass123'
        )
        active_share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=other_user,
            allow_download=True,
            expires_at=timezone.now() + timedelta(days=1)
        )
        self.assertFalse(active_share.is_expired())
        self.assertTrue(active_share.can_download(other_user))

    def test_download_permission(self):
        """Test download permission logic"""
        # Share without download permission
        no_download_share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            allow_download=False
        )
        self.assertFalse(no_download_share.can_download(self.recipient))

        # Share with download permission
        download_share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=User.objects.create_user(
                email='other@test.com',
                password='testpass123'
            ),
            allow_download=True
        )
        self.assertTrue(download_share.can_download(download_share.shared_with))

    def test_public_share_link(self):
        """Test public share link functionality"""
        public_share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            allow_download=True,
            share_link_token=uuid.uuid4()
        )
        random_user = User.objects.create_user(
            email='random@test.com',
            password='testpass123'
        )
        self.assertTrue(public_share.can_download(random_user))

    def test_prevent_share_with_owner(self):
        """Test that sharing with file owner is prevented"""
        with self.assertRaises(ValidationError):
            SharePermission.objects.create(
                file=self.file,
                shared_by=self.owner,
                shared_with=self.owner,
                allow_download=True
            )

    def test_prevent_expired_date_creation(self):
        """Test that shares cannot be created with past expiration dates"""
        with self.assertRaises(ValidationError):
            SharePermission.objects.create(
                file=self.file,
                shared_by=self.owner,
                shared_with=self.recipient,
                allow_download=True,
                expires_at=timezone.now() - timedelta(minutes=1)
            )

    def test_download_limits(self):
        """Test download limit functionality"""
        # Test limited downloads
        share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            max_downloads=2,
            is_download_enabled=True
        )
        
        self.assertTrue(share.has_downloads_remaining())
        self.assertTrue(share.can_download(self.recipient))
        
        # Record downloads
        share.record_download()
        self.assertTrue(share.has_downloads_remaining())
        self.assertEqual(share.downloads_used, 1)
        
        share.record_download()
        self.assertFalse(share.has_downloads_remaining())
        self.assertEqual(share.downloads_used, 2)
        
        # Verify can't download after limit reached
        self.assertFalse(share.can_download(self.recipient))
        
        with self.assertRaises(ValidationError):
            share.record_download()

    def test_unlimited_downloads(self):
        """Test unlimited downloads setting"""
        share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            max_downloads=-1,
            is_download_enabled=True
        )
        
        self.assertTrue(share.has_downloads_remaining())
        
        # Test multiple downloads
        for _ in range(10):
            self.assertTrue(share.can_download(self.recipient))
            share.record_download()
            
        self.assertTrue(share.has_downloads_remaining())
        self.assertEqual(share.downloads_used, 10)

    def test_download_toggle(self):
        """Test enabling/disabling downloads"""
        share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            max_downloads=-1,
            is_download_enabled=True
        )
        
        self.assertTrue(share.can_download(self.recipient))
        
        # Disable downloads
        share.is_download_enabled = False
        share.save()
        self.assertFalse(share.can_download(self.recipient))
        
        # Re-enable downloads
        share.is_download_enabled = True
        share.save()
        self.assertTrue(share.can_download(self.recipient))

    def test_invalid_download_values(self):
        """Test validation of download-related fields"""
        with self.assertRaises(ValidationError):
            SharePermission.objects.create(
                file=self.file,
                shared_by=self.owner,
                shared_with=self.recipient,
                max_downloads=-2  # Invalid value
            )
        
        share = SharePermission.objects.create(
            file=self.file,
            shared_by=self.owner,
            shared_with=self.recipient,
            max_downloads=1
        )
        
        # Try to set negative downloads_used
        share.downloads_used = -1
        with self.assertRaises(ValidationError):
            share.save() 