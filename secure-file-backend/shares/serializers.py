from rest_framework import serializers
from .models import SharedLink

class SharedLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedLink
        fields = ('id', 'file', 'url', 'expiry_date', 'max_access_count', 'access_count')
        read_only_fields = ('id', 'url', 'access_count') 