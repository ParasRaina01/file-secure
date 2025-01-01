# Secure File Sharing Application

A secure, end-to-end encrypted file sharing platform built with React and Django. This application allows users to securely upload, store, and share files with client-side encryption and robust security measures.

## Features

- **End-to-End Encryption**: Files are encrypted in the browser before upload using AES-256-GCM
- **Two-Factor Authentication**: Optional 2FA support using TOTP (Time-based One-Time Password)
- **Dark/Light Mode**: Full theme support with system preference detection
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Secure File Management**: Upload, download, and delete files with encryption key management
- **Modern UI**: Built with shadcn/ui components for a clean, accessible interface

## Tech Stack

### Frontend
- **Framework**: React with TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Encryption**: Web Crypto API
- **Theme Management**: next-themes

### Backend
- **Framework**: Django with Django REST Framework
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: SQLite (development) / PostgreSQL (production)
- **Security**: Django's built-in security features + custom encryption
- **File Storage**: Local filesystem with encrypted storage

## Security Features

- Client-side encryption using AES-256-GCM before upload
- Secure key management with per-file encryption keys
- JWT-based authentication with refresh tokens
- CORS protection and security headers
- Password strength validation
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- Secure session management

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Python 3.10 or higher
- uv (Python package manager)

### Backend Setup
1. Create and activate a virtual environment:
```bash
cd secure-file-backend
uv venv
source .venv/bin/activate  # On Linux/macOS
```

2. Install dependencies:
```bash
uv pip install -r requirements.txt
```

3. Run migrations:
```bash
python manage.py migrate
```

4. Start the development server:
```bash
python manage.py runserver 8001
```

### Frontend Setup
1. Install dependencies:
```bash
cd secure-file-frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8001

## Environment Variables

### Backend (.env)
```env
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8001/api
```

## File Structure

```
secure-file/
├── secure-file-backend/    # Django backend
│   ├── core/              # Core functionality
│   ├── authentication/    # Auth related
│   ├── files/            # File management
│   ├── shares/           # File sharing
│   └── ...
└── secure-file-frontend/  # React frontend
    ├── src/
    │   ├── components/   # React components
    │   ├── features/     # Redux features
    │   ├── lib/          # Utilities
    │   └── ...
    └── ...
```

## Security Considerations

- Never commit sensitive information (API keys, secrets, etc.)
- Keep dependencies updated for security patches
- Follow security best practices for production deployment
- Regularly backup encrypted files and database
- Monitor system logs for suspicious activity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 