import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Share2, Key } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-6xl">
            Securely Share Your Files
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            End-to-end encrypted file sharing platform with advanced security features,
            ensuring your data remains private and protected.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg">
              <Link to="/register">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3 mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">End-to-End Encryption</h3>
              <p className="mt-2 text-muted-foreground">
                Your files are encrypted before leaving your device
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3 mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <p className="mt-2 text-muted-foreground">
                Additional security layer for your account
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3 mb-4">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Secure File Sharing</h3>
              <p className="mt-2 text-muted-foreground">
                Share files with specific users or via secure links
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3 mb-4">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Access Control</h3>
              <p className="mt-2 text-muted-foreground">
                Granular permissions and expiring access links
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Highlights */}
      <div className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Enterprise-Grade Security
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Client-Side Encryption</h3>
              <p className="text-muted-foreground">
                Files are encrypted using AES-256 before being uploaded
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Zero-Knowledge</h3>
              <p className="text-muted-foreground">
                We never see or store your encryption keys
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Secure Authentication</h3>
              <p className="text-muted-foreground">
                Multi-factor authentication and secure session management
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Access Controls</h3>
              <p className="text-muted-foreground">
                Fine-grained permissions and time-limited access
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 