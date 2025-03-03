from django.urls import path
from .views import (
    FileUploadView,
    FileListView,
    FileDetailView,
    FileContentView,
    FilePreviewView
)

urlpatterns = [
    path('', FileListView.as_view(), name='file-list'),
    path('upload/', FileUploadView.as_view(), name='file-upload'),
    path('<int:id>/', FileDetailView.as_view(), name='file-detail'),
    path('<int:file_id>/content/', FileContentView.as_view(), name='file-content'),
    path('<int:file_id>/preview/', FilePreviewView.as_view(), name='file-preview'),
] 