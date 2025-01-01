from django.urls import path
from .views import (
    CreateSharedLinkView,
    RevokeSharedLinkView,
    SharedLinkAccessView
)

urlpatterns = [
    # Public sharing links
    path('files/<int:file_id>/create-link/', CreateSharedLinkView.as_view(), name='create-share-link'),
    path('links/<int:pk>/revoke/', RevokeSharedLinkView.as_view(), name='revoke-share-link'),
    path('share/<str:unique_id>/', SharedLinkAccessView.as_view(), name='access-shared-link'),
] 