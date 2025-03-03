import * as React from 'react';
import { RegisterForm } from '@/components/auth/RegisterForm';

export function Register() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </div>
  );
} 