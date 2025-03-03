from django.urls import path
from .views import rate_limit_exceeded

urlpatterns = [
    # ... existing URLs ...
    path('rate-limit-exceeded/', rate_limit_exceeded, name='rate_limit_exceeded'),
] 