from django.db import models
from django.conf import settings
from files.models import File
import uuid
from django.utils import timezone
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

class SharePermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    share_link_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name='shares'
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shared_by'
    )
    shared_with = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shared_with',
        null=True,  # Null for public share links
        blank=True
    )
    
    # Download control
    max_downloads = models.IntegerField(
        default=3,
        help_text="Maximum number of downloads allowed. -1 for unlimited."
    )
    downloads_used = models.IntegerField(
        default=0,
        help_text="Number of successful downloads"
    )
    is_download_enabled = models.BooleanField(
        default=False,
        help_text="Whether downloads are currently enabled"
    )
    last_downloaded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last successful download"
    )
    
    # Share link and expiration
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this share link expires"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'share permission'
        verbose_name_plural = 'share permissions'

    def __str__(self):
        return f"Share of {self.file.filename} by {self.shared_by.email}"

    def is_expired(self):
        """Check if share has expired"""
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at

    def has_downloads_remaining(self):
        """Check if downloads are still available"""
        if self.max_downloads == -1:  # Unlimited downloads
            return True
        return self.downloads_used < self.max_downloads

    def can_access(self, user):
        """Check if user can access (view) through this share"""
        if self.is_expired():
            logger.info(f"Access denied - Share expired: {self.id}")
            return False
            
        # Check if user has access
        if self.shared_with == user or (self.share_link_token and not self.shared_with):
            return True
            
        logger.info(f"Access denied - User not authorized: {self.id}, user: {user.id}")
        return False

    def can_download(self, user):
        """Check if user can download through this share"""
        if not self.can_access(user):
            return False
            
        if not self.is_download_enabled:
            logger.info(f"Download denied - Downloads disabled: {self.id}")
            return False
            
        if not self.has_downloads_remaining():
            logger.info(f"Download denied - No downloads remaining: {self.id}")
            return False
            
        return True

    def record_download(self):
        """Record a successful download"""
        if not self.has_downloads_remaining():
            raise ValidationError("No downloads remaining")
            
        self.downloads_used += 1
        self.last_downloaded_at = timezone.now()
        self.save(update_fields=['downloads_used', 'last_downloaded_at'])
        logger.info(f"Download recorded for share {self.id}, downloads used: {self.downloads_used}")

    def clean(self):
        """Validate share permission"""
        if self.shared_with == self.file.user:
            raise ValidationError({
                "shared_with": "Cannot share file with its owner"
            })
        
        if self.expires_at and self.expires_at < timezone.now():
            raise ValidationError({
                "expires_at": "Expiration date cannot be in the past"
            })
        
        if self.max_downloads < -1:
            raise ValidationError({
                "max_downloads": "Maximum downloads cannot be less than -1"
            })
        
        if self.downloads_used < 0:
            raise ValidationError({
                "downloads_used": "Downloads used cannot be negative"
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
