from django.shortcuts import render, get_object_or_404
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.core.exceptions import ValidationError
from django.http import FileResponse, HttpResponse, Http404
from .serializers import FileUploadSerializer, FileDownloadSerializer
from .models import File
from .key_management import KeyManagement
import traceback
import logging
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from django.utils.http import http_date
import mimetypes
import os

logger = logging.getLogger(__name__)

class FileUploadView(generics.CreateAPIView):
    """
    Upload an encrypted file.
    The file should be encrypted client-side before upload using the Web Crypto API.
    Required fields:
    - file: The encrypted file
    - filename: Original filename
    - encryption_iv: Initialization vector used for encryption (32 char hex)
    - original_file_size: Size of the original file before encryption
    - mime_type: Original file's MIME type
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FileUploadSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(
                data=request.data,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                logger.error(f"Serializer validation errors: {serializer.errors}")
                return Response({
                    'error': 'Validation failed',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
            file_instance = serializer.save()
            
            return Response({
                'message': 'File uploaded successfully',
                'file': {
                    'id': file_instance.id,
                    'filename': file_instance.filename,
                    'upload_timestamp': file_instance.upload_timestamp,
                    'mime_type': file_instance.mime_type,
                    'original_file_size': file_instance.original_file_size
                }
            }, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            logger.error(f"Validation error: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error during file upload: {str(e)}\n{traceback.format_exc()}")
            return Response({
                'error': 'An error occurred while uploading the file.',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FileListView(generics.ListAPIView):
    """
    List all files owned by or shared with the current user.
    Returns metadata needed for client-side decryption.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FileDownloadSerializer

    def get_queryset(self):
        """Get files owned by or shared with the user"""
        user = self.request.user
        # Get user's own files
        own_files = File.objects.filter(user=user)
        # Get files shared with user (to be implemented with permissions)
        # shared_files = File.objects.filter(permissions__user=user)
        # return own_files | shared_files
        return own_files


class FileDetailView(generics.RetrieveDestroyAPIView):
    """
    Retrieve or delete a specific file.
    Includes metadata needed for client-side decryption.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FileDownloadSerializer
    lookup_field = 'id'

    def get_queryset(self):
        """Get files the user has access to"""
        user = self.request.user
        return File.objects.filter(user=user)


class FileContentView(APIView):
    """
    Download the encrypted file content.
    The file is decrypted from server-side encryption before being sent,
    but remains encrypted with client-side encryption.
    """
    permission_classes = []  # Allow public access for shared files
    
    def get_object(self, file_id, user=None):
        """Get file if user has access through ownership or share"""
        file_instance = get_object_or_404(File, id=file_id)
        
        # Check if user owns the file
        if user and file_instance.user == user:
            return file_instance
            
        # Check if file is shared with user
        share = SharePermission.objects.filter(
            file=file_instance,
            expires_at__gt=timezone.now(),
            is_download_enabled=True
        ).first()
        
        if not share:
            raise PermissionDenied("You don't have permission to access this file")
            
        if not share.can_download(user):
            raise PermissionDenied("Download not allowed")
            
        return file_instance

    def get(self, request, file_id):
        try:
            # Get the file instance
            file_instance = self.get_object(file_id, request.user if request.user.is_authenticated else None)
            
            # Get the server-side encrypted data from database
            server_encrypted_data = file_instance.encrypted_content
            
            if not server_encrypted_data:
                return Response(
                    {
                        "status": "error",
                        "message": "File content not found",
                        "detail": "The file content could not be found"
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get the file key and decrypt it
            file_key = file_instance.get_file_key()

            # Decrypt the server-side encryption
            client_encrypted_data = KeyManagement.decrypt_file(
                server_encrypted_data,
                file_key,
                file_instance.server_side_iv
            )
            
            # Create the response with the client-encrypted file
            response = HttpResponse(
                client_encrypted_data,
                content_type='application/octet-stream'  # Always send as binary data
            )
            
            # Add headers for better download handling
            response['Content-Disposition'] = f'attachment; filename="{file_instance.filename}"'
            response['Content-Length'] = len(client_encrypted_data)
            
            return response
            
        except PermissionDenied as e:
            return Response(
                {
                    "status": "error",
                    "message": "Access denied",
                    "detail": str(e)
                },
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            logger.error(f"Error during file download: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {
                    "status": "error",
                    "message": "Error occurred while downloading the file",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FilePreviewView(APIView):
    """View for previewing files"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, file_id):
        try:
            # Get the file instance
            file = get_object_or_404(File, id=file_id, user=request.user)
            
            if not file.encrypted_content:
                return Response(
                    {"error": "File content not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Get the file key and decrypt it
            file_key = file.get_file_key()

            # Decrypt the server-side encryption
            decrypted_data = KeyManagement.decrypt_file(
                file.encrypted_content,
                file_key,
                file.server_side_iv
            )
            
            # Create response with proper content type
            response = HttpResponse(
                decrypted_data,
                content_type=file.mime_type
            )
            
            # Set headers for preview
            response['Content-Length'] = len(decrypted_data)
            response['Content-Disposition'] = f'inline; filename="{file.filename}"'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            response['Access-Control-Allow-Origin'] = '*'
            
            return response
            
        except Exception as e:
            logger.error(f"Error in FilePreviewView: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
