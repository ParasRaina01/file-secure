from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import pyotp


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        
        # Enable MFA by default
        if 'mfa_enabled' not in extra_fields:
            extra_fields['mfa_enabled'] = True
        if 'mfa_secret' not in extra_fields:
            extra_fields['mfa_secret'] = pyotp.random_base32()
            
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('regular_user', 'Regular User'),
    ]

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=255, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='regular_user')
    
    # MFA fields
    mfa_enabled = models.BooleanField(default=True)
    mfa_secret = models.CharField(max_length=255, null=True, blank=True)
    
    # Standard user fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.username

    def get_short_name(self):
        return self.username
