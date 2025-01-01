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

    def perform_create(self, serializer):
        file_id = self.kwargs.get('file_id')
        file = get_object_or_404(File, id=file_id)
        
        # Check if user has permission to create share link
        if file.owner != self.request.user:
            raise PermissionDenied("You don't have permission to share this file")
            
        # Generate unique URL and set max expiry to 1 week
        unique_id = get_random_string(length=32)
        url = f"/share/{unique_id}"
        max_expiry = timezone.now() + timedelta(days=7)
        
        # If expiry date is not set or is more than a week, set it to 1 week
        expiry_date = serializer.validated_data.get('expiry_date')
        if not expiry_date or expiry_date > max_expiry:
            serializer.validated_data['expiry_date'] = max_expiry
            
        serializer.save(file=file, url=url)

class RevokeSharedLinkView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return SharedLink.objects.filter(file__owner=self.request.user)

class SharedLinkAccessView(generics.RetrieveAPIView):
    """View for accessing files through shared links"""
    
    def get(self, request, *args, **kwargs):
        shared_link = get_object_or_404(
            SharedLink, 
            url=f"/share/{kwargs.get('unique_id')}"
        )
        
        # Check if link has expired
        if shared_link.expiry_date and shared_link.expiry_date <= timezone.now():
            return Response(
                {"error": "This link has expired"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check access count
        if (shared_link.max_access_count and 
            shared_link.access_count >= shared_link.max_access_count):
            return Response(
                {"error": "Maximum access limit reached"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Increment access count
        shared_link.access_count += 1
        shared_link.save()
        
        # Return file download response
        return Response({
            "file_id": shared_link.file.id,
            "filename": shared_link.file.filename,
            "download_url": f"/api/files/{shared_link.file.id}/content/"
        })
