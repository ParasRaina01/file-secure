import * as React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

interface MFASetupProps {
  mfaSecret: string;
  mfaQrCode: string;
  token?: string;
  onSetupComplete: () => void;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
      detail?: string;
      totp_code?: string[];
    };
  };
  message?: string;
}

export function MFASetup({ mfaSecret, mfaQrCode, token, onSetupComplete }: MFASetupProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [totpCode, setTotpCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!totpCode) {
      setError('Please enter the verification code');
      return;
    }

    if (totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      // Set the authorization header if token is provided
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      // Verify the TOTP code
      await api.post('/auth/mfa/enable/', { 
        totp_code: totpCode,
        secret: mfaSecret // Include the secret for verification
      });
      
      toast({
        title: "MFA Setup Complete",
        description: "Two-factor authentication has been enabled for your account.",
      });

      // Clear the authorization header
      delete api.defaults.headers.common['Authorization'];
      
      onSetupComplete();
    } catch (error) {
      console.error('MFA Setup Error:', error);
      const apiError = error as ApiError;
      const errorMessage = apiError.response?.data?.error || 
                          apiError.response?.data?.totp_code?.[0] || 
                          apiError.response?.data?.detail ||
                          apiError.message ||
                          'Failed to verify the code. Please try again.';
      
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "MFA Setup Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Set Up 2FA</CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app and enter the verification code
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <img 
              src={mfaQrCode} 
              alt="QR Code for 2FA Setup" 
              className="w-48 h-48"
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p>Can't scan the QR code?</p>
            <p className="mt-1">Enter this code manually: <code className="bg-muted px-2 py-1 rounded">{mfaSecret}</code></p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totp_code">Verification Code</Label>
            <Input
              id="totp_code"
              type="text"
              placeholder="Enter 6-digit code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`h-11 text-center tracking-widest ${error ? 'border-destructive' : ''}`}
              disabled={isLoading}
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full h-11" 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 