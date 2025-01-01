from django.db import models
from django.conf import settings
import uuid


class Permission(models.Model):
    PERMISSION_CHOICES = [
        ('view', 'View'),
        ('download', 'Download'),
    ]

    file = models.ForeignKey(
        'files.File',
        on_delete=models.CASCADE,
        related_name='permissions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='file_permissions'
    )
    permission_type = models.CharField(max_length=50, choices=PERMISSION_CHOICES)
    granted_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('file', 'user')
        verbose_name = 'permission'
        verbose_name_plural = 'permissions'

    def __str__(self):
        return f"{self.user.email} has {self.permission_type} access to {self.file.filename}"


class SharedLink(models.Model):
    PERMISSION_CHOICES = [
        ('view', 'View'),
        ('download', 'Download'),
    ]

    file = models.ForeignKey(
        'files.File',
        on_delete=models.CASCADE,
        related_name='shared_links'
    )
    link_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_shared_links'
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    permission_type = models.CharField(max_length=50, choices=PERMISSION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'shared link'
        verbose_name_plural = 'shared links'

    def __str__(self):
        return f"Share link for {self.file.filename} by {self.created_by_user.email}"

    @property
    def is_expired(self):
        """Check if the shared link has expired"""
        if self.expires_at is None:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at
