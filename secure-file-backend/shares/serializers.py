from rest_framework import serializers
from .models import SharePermission
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class SharePermissionSerializer(serializers.ModelSerializer):
    expires_at = serializers.DateTimeField(required=False)
    is_download_enabled = serializers.BooleanField(required=True)
    share_link_token = serializers.UUIDField(read_only=True)
    expiry_minutes = serializers.IntegerField(write_only=True, required=False)
    share_url = serializers.CharField(read_only=True)
    expiry_display = serializers.CharField(read_only=True)
    
    EXPIRY_CHOICES = {
        1: timedelta(minutes=1),      # 1 minute (for testing)
        60: timedelta(hours=1),       # 1 hour
        1440: timedelta(days=1),      # 1 day
        10080: timedelta(days=7),     # 7 days
    }
    
    EXPIRY_DISPLAY = {
        1: "1 minute",
        60: "1 hour",
        1440: "1 day",
        10080: "7 days",
    }
    
    class Meta:
        model = SharePermission
        fields = ('id', 'file', 'shared_with', 'share_link_token', 'expires_at', 
                 'is_download_enabled', 'max_downloads', 'downloads_used', 
                 'created_at', 'updated_at', 'expiry_minutes', 'share_url',
                 'expiry_display')
        read_only_fields = ('id', 'share_link_token', 'downloads_used', 
                          'created_at', 'updated_at', 'share_url', 'expiry_display')
        extra_kwargs = {
            'is_download_enabled': {
                'error_messages': {
                    'required': 'Please specify if downloads should be enabled'
                }
            },
            'max_downloads': {
                'error_messages': {
                    'min_value': 'Maximum downloads cannot be less than -1',
                    'invalid': 'Please enter a valid number for maximum downloads'
                }
            }
        }
    
    def validate_expiry_minutes(self, value):
        """Validate expiry minutes against allowed choices"""
        if value not in self.EXPIRY_CHOICES:
            valid_choices = ", ".join(self.EXPIRY_DISPLAY.values())
            raise serializers.ValidationError(
                f"Please select a valid expiry time: {valid_choices}"
            )
        return value
    
    def validate(self, data):
        try:
            # Handle expiry time
            expiry_minutes = data.pop('expiry_minutes', None) if 'expiry_minutes' in data else None
            
            if expiry_minutes is not None:
                data['expires_at'] = timezone.now() + self.EXPIRY_CHOICES[expiry_minutes]
                # Remove expiry_display from data to prevent database save
                self._expiry_display = self.EXPIRY_DISPLAY[expiry_minutes]
            elif 'expires_at' not in data:
                # Default to 7 days if no expiry specified
                data['expires_at'] = timezone.now() + timedelta(days=7)
                self._expiry_display = "7 days"
                
            # Ensure download permission is explicitly set
            if 'is_download_enabled' not in data:
                data['is_download_enabled'] = False
                
            # Remove expiry_display if it somehow got into the data
            data.pop('expiry_display', None)
                
            logger.debug(f"Validated data: {data}")
            return data
        except Exception as e:
            logger.error(f"Error in validate: {str(e)}", exc_info=True)
            raise serializers.ValidationError({
                "message": "Failed to validate share data",
                "detail": str(e)
            })
            
    def create(self, validated_data):
        """Override create to handle expiry display"""
        instance = super().create(validated_data)
        # Add expiry display to instance for serialization
        instance._expiry_display = getattr(self, '_expiry_display', None)
        return instance
            
    def to_representation(self, instance):
        """Add human-readable expiry time to response"""
        data = super().to_representation(instance)
        
        # Use stored expiry display if available
        if hasattr(instance, '_expiry_display'):
            data['expiry_display'] = instance._expiry_display
        # Otherwise calculate from expires_at
        elif instance.expires_at:
            remaining = instance.expires_at - timezone.now()
            if remaining.total_seconds() > 0:
                days = remaining.days
                hours = remaining.seconds // 3600
                minutes = (remaining.seconds % 3600) // 60
                
                if days > 0:
                    data['expiry_display'] = f"Expires in {days} days"
                elif hours > 0:
                    data['expiry_display'] = f"Expires in {hours} hours"
                else:
                    data['expiry_display'] = f"Expires in {minutes} minutes"
            else:
                data['expiry_display'] = "Expired"
        return data 