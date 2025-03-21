import * as React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export function Login() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
} 