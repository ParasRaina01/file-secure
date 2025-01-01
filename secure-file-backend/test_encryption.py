import requests
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import secrets
import json
import base64

# Test configuration
API_URL = "http://localhost:8000"
TEST_FILE_CONTENT = b"This is a test file content that we'll use to verify both client and server-side encryption."
TEST_FILE_NAME = "test.txt"

def client_side_encrypt(data):
    """
    Simulate client-side encryption using Web Crypto API (AES-256-CBC)
    """
    # Generate a random 256-bit key and 128-bit IV
    key = secrets.token_bytes(32)  # 32 bytes = 256 bits
    iv = secrets.token_bytes(16)   # 16 bytes = 128 bits
    
    # Create and pad the data
    block_size = algorithms.AES.block_size // 8
    padding_length = block_size - (len(data) % block_size)
    padding = bytes([padding_length] * padding_length)
    padded_data = data + padding
    
    # Create AES cipher in CBC mode
    cipher = Cipher(
        algorithms.AES(key),
        modes.CBC(iv),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()
    
    # Encrypt the data
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    
    return {
        'encrypted_data': encrypted_data,
        'key': key,
        'iv': iv.hex(),  # IV needs to be sent to server for later decryption
        'original_size': len(data)
    }

def client_side_decrypt(encrypted_data, key, iv):
    """
    Simulate client-side decryption using Web Crypto API
    """
    # Convert IV from hex
    iv_bytes = bytes.fromhex(iv)
    
    # Create cipher
    cipher = Cipher(
        algorithms.AES(key),
        modes.CBC(iv_bytes),
        backend=default_backend()
    )
    decryptor = cipher.decryptor()
    
    # Decrypt the data
    padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
    
    # Remove padding
    padding_length = padded_data[-1]
    return padded_data[:-padding_length]

def login():
    """Login and get access token"""
    login_data = {
        'email': 'test@example.com',
        'password': 'SecurePass123!'
    }
    
    response = requests.post(
        f"{API_URL}/api/auth/login/",
        json=login_data
    )
    
    if response.status_code != 200:
        raise Exception(f"Login failed: {response.text}")
    
    return response.json()['access']

def test_encryption_flow():
    """Test the complete encryption flow"""
    print("\n=== Testing Complete Encryption Flow ===")
    
    try:
        # 1. Client-side encryption
        print("\n1. Performing client-side encryption...")
        encryption_result = client_side_encrypt(TEST_FILE_CONTENT)
        print(f"Original size: {encryption_result['original_size']} bytes")
        print(f"Client IV: {encryption_result['iv']}")
        print("Client-side encryption successful")
        
        # Save encrypted data to a temporary file
        with open('temp_encrypted.bin', 'wb') as f:
            f.write(encryption_result['encrypted_data'])
        
        # 2. Login to get token
        print("\n2. Logging in to get authentication token...")
        access_token = login()
        print("Login successful")
        
        # 3. Upload encrypted file
        print("\n3. Uploading encrypted file...")
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        with open('temp_encrypted.bin', 'rb') as f:
            files = {
                'file': (TEST_FILE_NAME, f, 'application/octet-stream')
            }
            data = {
                'filename': TEST_FILE_NAME,
                'encryption_iv': encryption_result['iv'],
                'original_file_size': encryption_result['original_size'],
                'mime_type': 'text/plain'
            }
            
            response = requests.post(
                f"{API_URL}/api/files/upload/",
                headers=headers,
                data=data,
                files=files
            )
        
        if response.status_code != 201:
            raise Exception(f"Upload failed: {response.text}")
        
        file_id = response.json()['file']['id']
        print(f"File uploaded successfully with ID: {file_id}")
        
        # 4. Get file details
        print("\n4. Getting file details...")
        response = requests.get(
            f"{API_URL}/api/files/{file_id}/",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to get file details: {response.text}")
        
        file_details = response.json()
        print("File details retrieved successfully")
        
        # 5. Download the file
        print("\n5. Downloading file...")
        response = requests.get(
            f"{API_URL}/api/files/{file_id}/content/",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Download failed: {response.text}")
        
        downloaded_encrypted_data = response.content
        print(f"Downloaded encrypted data size: {len(downloaded_encrypted_data)} bytes")
        
        # 6. Client-side decryption
        print("\n6. Performing client-side decryption...")
        decrypted_data = client_side_decrypt(
            downloaded_encrypted_data,
            encryption_result['key'],
            file_details['encryption_iv']
        )
        
        # 7. Verify the result
        print("\n7. Verifying decrypted content...")
        if decrypted_data == TEST_FILE_CONTENT:
            print("SUCCESS: Decrypted content matches original!")
        else:
            print("ERROR: Decrypted content does not match original!")
            print(f"Original : {TEST_FILE_CONTENT}")
            print(f"Decrypted: {decrypted_data}")
        
    finally:
        # Cleanup
        print("\n8. Cleaning up...")
        if os.path.exists('temp_encrypted.bin'):
            os.remove('temp_encrypted.bin')
        print("Cleanup complete")

if __name__ == "__main__":
    test_encryption_flow() 