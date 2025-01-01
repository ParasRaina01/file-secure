from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    SetupMFAView,
    EnableMFAView,
    DisableMFAView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('mfa/setup/', SetupMFAView.as_view(), name='mfa_setup'),
    path('mfa/enable/', EnableMFAView.as_view(), name='mfa_enable'),
    path('mfa/disable/', DisableMFAView.as_view(), name='mfa_disable'),
] 