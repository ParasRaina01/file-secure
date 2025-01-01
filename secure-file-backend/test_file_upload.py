import requests
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import secrets
import json

# Test configuration
API_URL = "http://localhost:8000"
TEST_FILE_CONTENT = b"This is a test file content for secure file sharing application."
TEST_FILE_NAME = "test.txt"

def create_test_file():
    """Create a test file and encrypt it"""
    # Generate a random 256-bit key and 128-bit IV
    key = secrets.token_bytes(32)  # 32 bytes = 256 bits
    iv = secrets.token_bytes(16)   # 16 bytes = 128 bits
    
    # Create and pad the test file content
    padded_data = TEST_FILE_CONTENT + (b' ' * (16 - (len(TEST_FILE_CONTENT) % 16)))
    
    # Create AES cipher in CBC mode
    cipher = Cipher(
        algorithms.AES(key),
        modes.CBC(iv),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()
    
    # Encrypt the data
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    
    # Save encrypted file
    with open('test_encrypted.bin', 'wb') as f:
        f.write(encrypted_data)
    
    return {
        'iv': iv.hex(),
        'original_size': len(TEST_FILE_CONTENT),
        'encrypted_file_path': 'test_encrypted.bin'
    }

def test_file_upload():
    """Test the file upload endpoint"""
    # First, login to get token
    login_data = {
        'email': 'test@example.com',
        'password': 'SecurePass123!'
    }
    
    print("\n1. Logging in to get authentication token...")
    login_response = requests.post(
        f"{API_URL}/api/auth/login/",
        json=login_data
    )
    
    if login_response.status_code != 200:
        print("Login failed:", login_response.text)
        return
    
    access_token = login_response.json()['access']
    print("Login successful, got access token")
    
    # Create and encrypt test file
    print("\n2. Creating and encrypting test file...")
    encryption_data = create_test_file()
    print("Test file created and encrypted")
    print(f"IV: {encryption_data['iv']}")
    print(f"Original size: {encryption_data['original_size']}")
    
    # Prepare file upload
    print("\n3. Uploading encrypted file...")
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    
    with open(encryption_data['encrypted_file_path'], 'rb') as f:
        files = {
            'file': (TEST_FILE_NAME, f, 'application/octet-stream')
        }
        data = {
            'filename': TEST_FILE_NAME,
            'encryption_iv': encryption_data['iv'],
            'original_file_size': encryption_data['original_size'],
            'mime_type': 'text/plain'
        }
        
        print("\nRequest data:")
        print(json.dumps(data, indent=2))
        
        response = requests.post(
            f"{API_URL}/api/files/upload/",
            headers=headers,
            data=data,
            files=files
        )
    
    print("\n4. Upload Response:")
    print(f"Status Code: {response.status_code}")
    try:
        print("Response Body:", json.dumps(response.json(), indent=2))
    except:
        print("Raw Response:", response.text)
    
    # Cleanup
    print("\n5. Cleaning up test files...")
    if os.path.exists('test_encrypted.bin'):
        os.remove('test_encrypted.bin')
    print("Test files cleaned up")

if __name__ == "__main__":
    test_file_upload() 