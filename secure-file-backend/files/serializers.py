from rest_framework import serializers
from .models import File
from .key_management import KeyManagement
import magic
import os
from django.conf import settings

class FileUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    encryption_iv = serializers.CharField(required=True, write_only=True)
    original_file_size = serializers.IntegerField(required=True)
    mime_type = serializers.CharField(required=True)
    
    class Meta:
        model = File
        fields = ('id', 'file', 'filename', 'encryption_iv', 'original_file_size', 
                 'mime_type', 'upload_timestamp', 'created_at', 'updated_at')
        read_only_fields = ('id', 'filename', 'upload_timestamp', 'created_at', 'updated_at')

    def validate_file(self, value):
        """
        Validate the uploaded file:
        1. Check file size (max 10MB as per settings)
        2. Verify file is actually encrypted (basic check)
        """
        # Check file size
        if value.size > 10 * 1024 * 1024:  # 10MB
            raise serializers.ValidationError("File size cannot exceed 10MB.")

        # Basic check for encrypted content (should appear as binary/random data)
        mime = magic.Magic(mime=True)
        file_type = mime.from_buffer(value.read(1024))
        value.seek(0)  # Reset file pointer

        # Encrypted files should typically appear as application/octet-stream
        if file_type != 'application/octet-stream':
            raise serializers.ValidationError(
                "File doesn't appear to be encrypted. Please encrypt the file before uploading."
            )

        return value

    def validate_encryption_iv(self, value):
        """Validate the encryption IV format"""
        try:
            # IV should be a hex string of 32 characters (16 bytes)
            if len(value) != 32:
                raise serializers.ValidationError(
                    "Invalid IV format. Must be 32 characters hex string."
                )
            # Try converting to bytes to ensure it's valid hex
            bytes.fromhex(value)
            return value
        except ValueError:
            raise serializers.ValidationError(
                "Invalid IV format. Must be a valid hex string."
            )

    def create(self, validated_data):
        uploaded_file = validated_data.pop('file')
        encryption_iv = validated_data.pop('encryption_iv')
        
        # Generate a secure filename using uuid
        import uuid
        file_extension = os.path.splitext(uploaded_file.name)[1]
        encrypted_filename = f"{uuid.uuid4().hex}{file_extension}"

        # Read the client-side encrypted file
        client_encrypted_data = uploaded_file.read()

        # Generate server-side encryption key and IV
        file_key = KeyManagement.generate_file_key()
        server_iv = KeyManagement.generate_iv()

        # Encrypt the already client-encrypted data with server-side encryption
        server_encrypted_data = KeyManagement.encrypt_file(
            client_encrypted_data,
            file_key,
            server_iv
        )

        # Encrypt the file key with the master key
        encrypted_key = KeyManagement.encrypt_file_key(file_key)

        # Create the file instance
        file_instance = File.objects.create(
            user=self.context['request'].user,
            filename=uploaded_file.name,
            encrypted_filename=encrypted_filename,
            encryption_iv=bytes.fromhex(encryption_iv),  # Client-side IV
            encrypted_file_key=encrypted_key,  # Server-side encrypted key
            server_side_iv=server_iv,  # Server-side IV
            **validated_data
        )

        # Save the server-side encrypted file
        file_path = os.path.join(settings.MEDIA_ROOT, 'uploads', encrypted_filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'wb+') as destination:
            destination.write(server_encrypted_data)

        return file_instance


class FileDownloadSerializer(serializers.ModelSerializer):
    """Serializer for file download responses"""
    download_url = serializers.SerializerMethodField()
    encryption_iv = serializers.SerializerMethodField()
    upload_timestamp = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ")

    class Meta:
        model = File
        fields = ('id', 'filename', 'original_file_size', 'mime_type', 
                 'encryption_iv', 'download_url', 'upload_timestamp')

    def get_download_url(self, obj):
        """Generate the download URL for the file"""
        return f"/api/files/{obj.id}/content/"

    def get_encryption_iv(self, obj):
        """Convert IV from bytes to hex string"""
        return obj.encryption_iv.hex() 