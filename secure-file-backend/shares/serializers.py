from rest_framework import serializers
from .models import SharedLink

class SharedLinkSerializer(serializers.ModelSerializer):
    expires_at = serializers.DateTimeField(required=True)
    allow_download = serializers.BooleanField(required=True)
    url = serializers.CharField(read_only=True)

    class Meta:
        model = SharedLink
        fields = ('id', 'file', 'url', 'expires_at', 'allow_download', 'created_at')
        read_only_fields = ('id', 'url', 'created_at') 