import requests
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import binascii

# Test configuration
API_URL = "http://localhost:8000"
DOWNLOAD_DIR = "test_downloads"

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

def decrypt_file(encrypted_data, key, iv):
    """Decrypt the downloaded file"""
    cipher = Cipher(
        algorithms.AES(key),
        modes.CBC(iv),
        backend=default_backend()
    )
    decryptor = cipher.decryptor()
    decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()
    
    # Remove padding
    padding_length = decrypted_data[-1]
    return decrypted_data[:-padding_length]

def test_file_download():
    """Test the file download functionality"""
    # Create download directory
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    try:
        # 1. Login
        print("\n1. Logging in to get authentication token...")
        access_token = login()
        print("Login successful")
        
        # 2. List available files
        print("\n2. Getting list of files...")
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(
            f"{API_URL}/api/files/",
            headers=headers
        )
        
        if response.status_code != 200:
            print("Failed to get file list:", response.text)
            return
        
        files = response.json()
        if not files:
            print("No files found")
            return
        
        print(f"Found {len(files)} files:")
        for file in files:
            print(f"- {file['filename']} (ID: {file['id']})")
        
        # 3. Get details of the first file
        file_id = files[0]['id']
        print(f"\n3. Getting details for file {file_id}...")
        
        response = requests.get(
            f"{API_URL}/api/files/{file_id}/",
            headers=headers
        )
        
        if response.status_code != 200:
            print("Failed to get file details:", response.text)
            return
        
        file_details = response.json()
        print("File details:", file_details)
        
        # 4. Download the file
        print("\n4. Downloading file...")
        response = requests.get(
            f"{API_URL}/api/files/{file_id}/content/",
            headers=headers,
            stream=True
        )
        
        if response.status_code != 200:
            print("Failed to download file:", response.text)
            return
        
        # Save the encrypted file
        download_path = os.path.join(DOWNLOAD_DIR, f"downloaded_{file_details['filename']}")
        with open(download_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"File downloaded to {download_path}")
        print("Encryption IV:", response.headers.get('X-Encryption-IV'))
        
    finally:
        # Cleanup
        print("\n5. Cleaning up...")
        if os.path.exists(DOWNLOAD_DIR):
            for file in os.listdir(DOWNLOAD_DIR):
                os.remove(os.path.join(DOWNLOAD_DIR, file))
            os.rmdir(DOWNLOAD_DIR)
        print("Cleanup complete")

if __name__ == "__main__":
    test_file_download() 