from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os
import base64
from django.conf import settings
import secrets

class KeyManagement:
    KEY_STORE_PATH = os.path.join(settings.BASE_DIR, 'key_store')
    MASTER_KEY_PATH = os.path.join(KEY_STORE_PATH, 'master.key')
    
    @classmethod
    def initialize(cls):
        """Initialize the key management system"""
        os.makedirs(cls.KEY_STORE_PATH, exist_ok=True)
        if not os.path.exists(cls.MASTER_KEY_PATH):
            cls._generate_master_key()
    
    @classmethod
    def _generate_master_key(cls):
        """Generate and save the master key"""
        key = Fernet.generate_key()
        with open(cls.MASTER_KEY_PATH, 'wb') as f:
            f.write(key)
    
    @classmethod
    def _load_master_key(cls):
        """Load the master key"""
        with open(cls.MASTER_KEY_PATH, 'rb') as f:
            return f.read()
    
    @classmethod
    def generate_file_key(cls):
        """Generate a new encryption key for a file"""
        return secrets.token_bytes(32)  # 256 bits for AES-256
    
    @classmethod
    def encrypt_file_key(cls, file_key):
        """Encrypt a file key using the master key"""
        f = Fernet(cls._load_master_key())
        return f.encrypt(file_key)
    
    @classmethod
    def decrypt_file_key(cls, encrypted_key):
        """Decrypt a file key using the master key"""
        f = Fernet(cls._load_master_key())
        return f.decrypt(encrypted_key)
    
    @staticmethod
    def generate_iv():
        """Generate a random IV for AES encryption"""
        return secrets.token_bytes(16)  # 128 bits for AES
    
    @staticmethod
    def encrypt_file(file_data, key, iv):
        """
        Encrypt file data using AES-256-CBC
        
        Args:
            file_data (bytes): The file data to encrypt
            key (bytes): 32-byte encryption key
            iv (bytes): 16-byte initialization vector
        
        Returns:
            bytes: The encrypted file data
        """
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Add PKCS7 padding
        block_size = algorithms.AES.block_size // 8
        padding_length = block_size - (len(file_data) % block_size)
        padding = bytes([padding_length] * padding_length)
        padded_data = file_data + padding
        
        # Encrypt the data
        encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
        return encrypted_data
    
    @staticmethod
    def decrypt_file(encrypted_data, key, iv):
        """
        Decrypt file data using AES-256-CBC
        
        Args:
            encrypted_data (bytes): The encrypted file data
            key (bytes): 32-byte encryption key
            iv (bytes): 16-byte initialization vector
        
        Returns:
            bytes: The decrypted file data
        """
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # Decrypt the data
        padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
        
        # Remove PKCS7 padding
        padding_length = padded_data[-1]
        return padded_data[:-padding_length] 