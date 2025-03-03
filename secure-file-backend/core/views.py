from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status

# Create your views here.

def rate_limit_exceeded(request, exception):
    return Response(
        {
            'error': 'Too many requests',
            'message': 'Please wait before making another request',
            'status_code': status.HTTP_429_TOO_MANY_REQUESTS
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS
    )
