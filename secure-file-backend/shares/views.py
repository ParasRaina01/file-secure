from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import get_random_string
from datetime import timedelta
from .models import SharedLink
from .serializers import SharedLinkSerializer
from files.models import File

class CreateSharedLinkView(generics.CreateAPIView):
    serializer_class = SharedLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        file_id = self.kwargs.get('file_id')
        file = get_object_or_404(File, id=file_id)
        
        # Check if user has permission to create share link
        if file.user != request.user:
            raise PermissionDenied("You don't have permission to share this file")
            
        # Generate unique URL
        unique_id = get_random_string(length=32)
        url = f"/share/{unique_id}"
        
        # Create serializer with the file and URL
        serializer = self.get_serializer(data={
            **request.data,
            'file': file.id,
            'url': url
        })
        
        if serializer.is_valid():
            # Set max expiry to 30 days
            max_expiry = timezone.now() + timedelta(days=30)
            expires_at = serializer.validated_data.get('expires_at')
            
            if not expires_at or expires_at > max_expiry:
                serializer.validated_data['expires_at'] = max_expiry
            
            # Save with the user
            serializer.save(created_by_user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RevokeSharedLinkView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return SharedLink.objects.filter(created_by_user=self.request.user)

class SharedLinkAccessView(generics.RetrieveAPIView):
    """View for accessing files through shared links"""
    
    def get(self, request, *args, **kwargs):
        shared_link = get_object_or_404(
            SharedLink, 
            url=f"/share/{kwargs.get('unique_id')}"
        )
        
        # Check if link has expired
        if shared_link.expires_at and shared_link.expires_at <= timezone.now():
            return Response(
                {"error": "This link has expired"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Return file download response
        return Response({
            "file_id": shared_link.file.id,
            "filename": shared_link.file.filename,
            "download_url": f"/api/files/{shared_link.file.id}/content/",
            "allow_download": shared_link.allow_download
        })
