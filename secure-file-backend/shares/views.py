from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from .models import SharePermission
from .serializers import SharePermissionSerializer
from files.models import File
from django.urls import reverse
from rest_framework.views import APIView
from django.http import FileResponse, HttpResponse, Http404
from files.key_management import KeyManagement
import logging
from django.utils.http import http_date
import mimetypes

logger = logging.getLogger(__name__)

class FilePreviewView(APIView):
    """View for previewing files for authenticated users"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, file_id):
        try:
            # Get the file and verify ownership
            file_instance = get_object_or_404(File, id=file_id)
            if file_instance.user != request.user:
                raise PermissionDenied("You don't have permission to preview this file")
            
            # Get the server-side encrypted data
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
                content_type=file_instance.mime_type
            )
            
            # Add headers for preview
            response['Content-Disposition'] = f'inline; filename="{file_instance.filename}"'
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
            logger.error(f"Error during file preview: {str(e)}", exc_info=True)
            return Response(
                {
                    "status": "error",
                    "message": "Error occurred while previewing the file",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class SharePreviewView(APIView):
    """View for previewing publicly shared files"""
    permission_classes = []  # Allow public access

    def get(self, request, share_token):
        try:
            # Get the share permission
            share = SharePermission.objects.get(share_link_token=share_token)
            
            # Check if share has expired
            if share.expires_at and share.expires_at < timezone.now():
                return Response(
                    {"error": "This share link has expired"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the associated file
            file = share.file
            
            # Get the server-side encrypted data
            server_encrypted_data = file.encrypted_content
            
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
            file_key = file.get_file_key()

            # Decrypt the server-side encryption
            client_encrypted_data = KeyManagement.decrypt_file(
                server_encrypted_data,
                file_key,
                file.server_side_iv
            )
            
            # Determine content type
            content_type, encoding = mimetypes.guess_type(file.filename)
            if not content_type:
                content_type = 'application/octet-stream'
            
            # Create response with client-encrypted data
            response = HttpResponse(
                client_encrypted_data,
                content_type=content_type
            )
            
            # Add headers for preview
            response['Content-Disposition'] = f'inline; filename="{file.filename}"'
            response['Content-Length'] = len(client_encrypted_data)
            response['Last-Modified'] = http_date(timezone.now().timestamp())
            
            # Security headers to prevent download/copy
            response['Content-Security-Policy'] = "default-src 'self'; object-src 'none'; base-uri 'none';"
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            
            return response
            
        except SharePermission.DoesNotExist:
            return Response(
                {"error": "Invalid share link"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error during file preview: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ShareDownloadView(APIView):
    """View for downloading shared files"""
    permission_classes = []  # Allow public access
    
    def get_object(self, token):
        share = get_object_or_404(SharePermission, share_link_token=token)
        
        # Check if share has expired
        if share.expires_at and share.expires_at < timezone.now():
            raise PermissionDenied({
                "message": "Share link expired",
                "detail": "This share link has expired"
            })
            
        # Check download permission
        if not share.is_download_enabled:
            raise PermissionDenied({
                "message": "Downloads not enabled",
                "detail": "Downloads are not enabled for this share"
            })
            
        # Check download limit
        if not share.has_downloads_remaining():
            raise PermissionDenied({
                "message": "Download limit reached",
                "detail": "Maximum number of downloads reached"
            })
            
        return share
        
    def get(self, request, token):
        try:
            share = self.get_object(token)
            file_instance = share.file
            
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
            
            # Record the download
            share.record_download()
            
            # Create the response with the client-encrypted file
            response = HttpResponse(
                client_encrypted_data,
                content_type='application/octet-stream'  # Always binary for downloads
            )
            
            # Add headers for download
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
            logger.error(f"Error during file download: {str(e)}", exc_info=True)
            return Response(
                {
                    "status": "error",
                    "message": "Error occurred while downloading the file",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CreateShareLinkView(generics.CreateAPIView):
    serializer_class = SharePermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        try:
            file_id = self.kwargs.get('file_id')
            logger.info(f"Creating share link for file {file_id}")
            logger.debug(f"Request data: {request.data}")
            
            file = get_object_or_404(File, id=file_id)
            
            # Check if user has permission to create share link
            if file.user != request.user:
                raise PermissionDenied({
                    "message": "Permission denied",
                    "detail": "You don't have permission to share this file"
                })
            
            # Ensure download permission is explicitly set
            data = {
                **request.data,
                'file': file.id,
            }
            if 'is_download_enabled' not in data:
                data['is_download_enabled'] = False
                
            logger.debug(f"Processed data: {data}")
            
            # Create serializer with the file
            serializer = self.get_serializer(data=data)
            
            if not serializer.is_valid():
                logger.error(f"Serializer validation failed: {serializer.errors}")
                error_messages = {}
                for field, errors in serializer.errors.items():
                    error_messages[field] = errors[0] if errors else "Invalid data"
                return Response({
                    "status": "error",
                    "message": "Failed to create share link",
                    "detail": error_messages
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                share = serializer.save(shared_by=request.user)
            except ValidationError as e:
                logger.error(f"Validation error during save: {e.message_dict}")
                return Response({
                    "status": "error",
                    "message": "Failed to create share link",
                    "detail": e.message_dict
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate the full share URL
            share_url = request.build_absolute_uri(
                reverse('access-share', kwargs={'token': share.share_link_token})
            ).replace('http://', 'https://')  # Ensure HTTPS
            
            # Create a new serializer instance with the share URL
            response_serializer = self.get_serializer(share)
            response_data = response_serializer.data
            response_data['share_url'] = share_url
            response_data['status'] = "success"
            response_data['message'] = f"Share link created successfully. Expires {response_data.get('expiry_display', '')}"
            
            logger.info(f"Share link created successfully for file {file_id}")
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except PermissionDenied as e:
            logger.error(f"Permission denied: {str(e)}")
            return Response({
                "status": "error",
                "message": "Permission denied",
                "detail": str(e)
            }, status=status.HTTP_403_FORBIDDEN)
            
        except Exception as e:
            logger.error(f"Error creating share link: {str(e)}", exc_info=True)
            error_detail = str(e)
            if hasattr(e, 'message_dict'):
                error_detail = e.message_dict
            return Response({
                "status": "error",
                "message": "Failed to create share link",
                "detail": error_detail
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RevokeShareView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = SharePermission.objects.all()
    
    def get_queryset(self):
        return SharePermission.objects.filter(shared_by=self.request.user)
        
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response({
                "status": "success",
                "message": "Share link revoked successfully"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "status": "error",
                "message": "Failed to revoke share link",
                "detail": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class ShareLinkAccessView(APIView):
    """View for accessing shared files"""
    permission_classes = []  # Allow public access
    
    def get(self, request, token):
        try:
            # Get the share permission
            share = get_object_or_404(SharePermission, share_link_token=token)
            
            # Check if share has expired
            if share.expires_at and share.expires_at < timezone.now():
                return Response(
                    {"error": "This share link has expired"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the associated file
            file = share.file
            
            # Get the file key and decrypt it for client-side decryption
            file_key = file.get_file_key()
            
            response_data = {
                "status": "success",
                "message": "Share link accessed successfully",
                "data": {
                    "file_id": file.id,
                    "filename": file.filename,
                    "mime_type": file.mime_type,
                    "download_url": f"/api/shares/share/{token}/download/",
                    "preview_url": f"/api/shares/share/{token}/preview/",
                    "allow_download": share.is_download_enabled,
                    "expiry": share.expires_at,
                    "downloads_remaining": share.max_downloads - share.downloads_used if share.max_downloads > -1 else -1,
                    "encryption_iv": file.encryption_iv.hex(),  # Add IV for client-side decryption
                    "encryption_key": file_key.hex(),  # Add key for client-side decryption
                }
            }
            
            return Response(response_data)
            
        except SharePermission.DoesNotExist:
            return Response(
                {"error": "Invalid share link"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error accessing share link: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
