from django.urls import path
from .views import (
    CreateShareLinkView,
    RevokeShareView,
    ShareLinkAccessView,
    SharePreviewView,
    ShareDownloadView
)

urlpatterns = [
    # File sharing endpoints
    path('files/<int:file_id>/create-link/', CreateShareLinkView.as_view(), name='create-share'),
    path('shares/<uuid:pk>/revoke/', RevokeShareView.as_view(), name='revoke-share'),
    path('shares/share/<uuid:token>/', ShareLinkAccessView.as_view(), name='access-share'),
    path('shares/share/<uuid:token>/preview/', SharePreviewView.as_view(), name='preview-share'),
    path('shares/share/<uuid:token>/download/', ShareDownloadView.as_view(), name='download-share'),
] 