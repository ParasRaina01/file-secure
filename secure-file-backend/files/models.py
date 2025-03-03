from django.db import models
from django.conf import settings
import uuid
import time
from .key_management import KeyManagement

def default_encrypted_key():
    """Generate a default encrypted key for existing records"""
    key = KeyManagement.generate_file_key()
    return KeyManagement.encrypt_file_key(key)

def default_iv():
    """Generate a default IV for existing records"""
    return KeyManagement.generate_iv()

def default_encrypted_filename():
    """Generate a default encrypted filename"""
    # Include timestamp to ensure uniqueness
    return f"{uuid.uuid4()}_{int(time.time())}"

class File(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='files'
    )
    filename = models.CharField(max_length=255)  # Original filename
    encrypted_filename = models.CharField(
        max_length=255, 
        unique=True,
        default=default_encrypted_filename
    )  # For reference only now
    original_file_size = models.BigIntegerField(default=0)
    upload_timestamp = models.DateTimeField(auto_now_add=True)
    encryption_iv = models.BinaryField(default=default_iv)  # IV for client-side decryption
    encrypted_file_key = models.BinaryField(default=default_encrypted_key)  # Encrypted key for server-side encryption
    server_side_iv = models.BinaryField(default=default_iv)  # IV for server-side encryption
    mime_type = models.CharField(max_length=100, default='application/octet-stream')
    encrypted_content = models.BinaryField(null=True)  # Actual encrypted file content
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-upload_timestamp']
        verbose_name = 'file'
        verbose_name_plural = 'files'

    def __str__(self):
        return f"{self.filename} (uploaded by {self.user.email})"

    def get_file_key(self):
        """Get the decrypted file key for server-side operations"""
        return KeyManagement.decrypt_file_key(self.encrypted_file_key)
