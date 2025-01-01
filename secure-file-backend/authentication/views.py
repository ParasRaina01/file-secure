from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
import pyotp
import qrcode
import qrcode.image
from io import BytesIO
import base64
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer, 
    EnableMFASerializer, 
    VerifyMFASerializer,
    LoginSerializer
)


class RegisterView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens for the user
        refresh = RefreshToken.for_user(user)
        
        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(serializer.data['mfa_qr_uri'])
        qr.make(fit=True)

        # Create QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

        return Response({
            "message": "User registered successfully. Please set up 2FA to continue.",
            "token": str(refresh.access_token),
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "mfa_enabled": user.mfa_enabled,
                "mfa_secret": serializer.data['mfa_secret'],
                "mfa_qr_uri": serializer.data['mfa_qr_uri'],
                "mfa_qr_code": f"data:image/png;base64,{qr_code_base64}"
            }
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    
    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = authenticate(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password']
        )
        
        if user is None:
            return Response(
                {"error": "Invalid credentials"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if user.mfa_enabled:
            if 'totp_code' not in serializer.validated_data:
                return Response(
                    {"mfa_required": True},
                    status=status.HTTP_200_OK
                )
            
            mfa_serializer = VerifyMFASerializer(
                data={'totp_code': serializer.validated_data['totp_code']},
                context={'user': user}
            )
            try:
                mfa_serializer.is_valid(raise_exception=True)
            except Exception:
                return Response(
                    {"error": "Invalid MFA code"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # If we get here, either MFA is not enabled or it was validated successfully
        # Create a new request with the user set
        request._request.user = user
        token_response = super().post(request, *args, **kwargs)
        
        return Response({
            "access": token_response.data['access'],
            "refresh": token_response.data['refresh'],
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "mfa_enabled": user.mfa_enabled
            }
        }, status=status.HTTP_200_OK)


class SetupMFAView(APIView):
    permission_classes = (AllowAny,)
    
    def get(self, request):
        """Handle MFA setup for authenticated users"""
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        return self._generate_mfa_response(request.user)
    
    def post(self, request):
        """Handle MFA setup for users who lost their 2FA"""
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Authenticate user with credentials
        user = authenticate(email=email, password=password)
        if not user:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        return self._generate_mfa_response(user)
    
    def _generate_mfa_response(self, user):
        """Generate MFA setup response for a user"""
        # Generate new TOTP secret
        secret = pyotp.random_base32()
        user.mfa_secret = secret
        user.save()

        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="SecureFileSharing"
        )

        # Create QR code image
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white")

        # Convert QR code to base64
        buffer = BytesIO()
        qr_image.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()

        return Response({
            'secret': secret,
            'qr_code': f"data:image/png;base64,{qr_base64}"
        })


class EnableMFAView(APIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = EnableMFASerializer

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        # If we get here, the TOTP code was valid
        request.user.mfa_enabled = True
        request.user.save()

        return Response({
            'message': 'MFA enabled successfully'
        })


class DisableMFAView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        if not user.mfa_enabled:
            return Response(
                {'error': 'MFA is not enabled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.mfa_enabled = False
        user.mfa_secret = None
        user.save()

        return Response({
            'message': 'MFA disabled successfully'
        })
