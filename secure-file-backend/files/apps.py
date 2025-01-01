from django.apps import AppConfig


class FilesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'files'

    def ready(self):
        """Initialize the key management system when the app is ready"""
        from .key_management import KeyManagement
        KeyManagement.initialize()
