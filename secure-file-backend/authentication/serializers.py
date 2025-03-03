from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
import pyotp

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        # Generate MFA secret
        mfa_secret = pyotp.random_base32()
        # Enable MFA by default
        user = User.objects.create_user(
            **validated_data,
            mfa_enabled=True,
            mfa_secret=mfa_secret
        )
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Include MFA secret in response for initial setup
        data['mfa_secret'] = instance.mfa_secret
        # Generate QR code URL
        totp = pyotp.TOTP(instance.mfa_secret)
        provisioning_uri = totp.provisioning_uri(
            name=instance.email,
            issuer_name="SecureFile"
        )
        data['mfa_qr_uri'] = provisioning_uri
        return data


class EnableMFASerializer(serializers.Serializer):
    totp_code = serializers.CharField(required=True, min_length=6, max_length=6)
    secret = serializers.CharField(required=True)

    def validate(self, attrs):
        user = self.context['request'].user
        totp = pyotp.TOTP(attrs['secret'])
        
        if not totp.verify(attrs['totp_code']):
            raise serializers.ValidationError({"totp_code": "Invalid TOTP code."})
            
        # Store the validated secret
        user.mfa_secret = attrs['secret']
        return attrs


class VerifyMFASerializer(serializers.Serializer):
    totp_code = serializers.CharField(required=True, min_length=6, max_length=6)

    def validate_totp_code(self, value):
        user = self.context['user']
        if not user.mfa_enabled or not user.mfa_secret:
            raise serializers.ValidationError("MFA is not enabled for this user.")
        
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(value):
            raise serializers.ValidationError("Invalid TOTP code.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)
    totp_code = serializers.CharField(required=False, min_length=6, max_length=6) 