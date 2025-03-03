import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { login } from '@/features/auth/authSlice';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { MFASetup } from './MFASetup';

interface FormData {
  email: string;
  password: string;
  totp_code?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  totp_code?: string;
}

interface MFASetupData {
  secret: string;
  qr_code: string;
  token: string;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
      detail?: string;
    };
  };
  message?: string;
}

export function LoginForm() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { isLoading, error, mfaRequired, isAuthenticated } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showQRCode, setShowQRCode] = React.useState(false);
  const [mfaSetupData, setMFASetupData] = React.useState<MFASetupData | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = React.useState(false);
  
  const [formData, setFormData] = React.useState<FormData>({
    email: '',
    password: '',
    totp_code: '',
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error,
      });
    }
  }, [error, toast]);

  const handleGenerateQRCode = async () => {
    if (!formData.email || !formData.password) {
      toast({
        variant: "destructive",
        title: "Missing credentials",
        description: "Please enter your email and password to generate a new QR code.",
      });
      return;
    }

    setIsGeneratingQR(true);
    try {
      // For lost MFA setup, we use a special endpoint that accepts credentials directly
      const response = await api.post<MFASetupData>('/auth/mfa/setup/', {
        email: formData.email,
        password: formData.password
      });
      
      // Check if we have the required data
      if (!response.data.secret || !response.data.qr_code) {
        throw new Error('Invalid response from server');
      }

      // Store the MFA setup data
      setMFASetupData(response.data);
      setShowQRCode(true);

      // Show success message
      toast({
        title: "QR Code Generated",
        description: "Scan this QR code with your authenticator app to set up 2FA.",
      });
    } catch (error) {
      console.error('QR Code Generation Error:', error);
      const apiError = error as ApiError;
      const errorMessage = apiError.response?.data?.error || 
                          apiError.response?.data?.detail || 
                          apiError.message ||
                          'Failed to generate QR code. Please try again.';
      toast({
        variant: "destructive",
        title: "Failed to generate QR code",
        description: errorMessage,
      });

      // Clear any existing QR code data
      setMFASetupData(null);
      setShowQRCode(false);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(login({
        email: formData.email,
        password: formData.password,
        totp_code: formData.totp_code
      }));
      
      if (login.fulfilled.match(result)) {
        if (!result.payload.mfaRequired) {
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
        }
      }
    } catch (error) {
      const apiError = error as ApiError;
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: apiError.message || "Failed to verify 2FA code",
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!mfaRequired) {
      if (!formData.email) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      }
    } else {
      if (!formData.totp_code) {
        newErrors.totp_code = '2FA code is required';
      } else if (formData.totp_code.length !== 6) {
        newErrors.totp_code = 'Please enter a valid 6-digit code';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (mfaRequired) {
      await handleVerifyMFA();
    } else {
      if (!validateForm()) {
        return;
      }

      const result = await dispatch(login(formData));
      
      if (login.fulfilled.match(result)) {
        if (result.payload.mfaRequired) {
          toast({
            title: "2FA Required",
            description: "Please enter your 2FA code to continue.",
          });
        } else {
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    // Only allow numbers for TOTP code
    if (name === 'totp_code') {
      processedValue = value.replace(/\D/g, '').slice(0, 6);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  if (showQRCode && mfaSetupData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <MFASetup
          mfaSecret={mfaSetupData.secret}
          mfaQrCode={mfaSetupData.qr_code}
          token={mfaSetupData.token}
          onSetupComplete={() => {
            setShowQRCode(false);
            setMFASetupData(null);
            // Reset form data except email
            setFormData(prev => ({
              ...prev,
              password: '',
              totp_code: ''
            }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center justify-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Enter your credentials to sign in
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!mfaRequired ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? 'border-destructive' : ''}
                    disabled={isLoading || isGeneratingQR}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      disabled={isLoading || isGeneratingQR}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      disabled={isLoading || isGeneratingQR}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totp_code">2FA Code</Label>
                <Input
                  id="totp_code"
                  name="totp_code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={formData.totp_code}
                  onChange={handleChange}
                  className={`text-center tracking-widest ${errors.totp_code ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                {errors.totp_code && (
                  <p className="text-sm text-destructive">{errors.totp_code}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleGenerateQRCode}
                  disabled={isGeneratingQR}
                >
                  {isGeneratingQR ? 'Generating...' : 'Generate New QR Code'}
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              type="submit" 
              disabled={isLoading || isGeneratingQR}
            >
              {isLoading ? 'Please wait...' : mfaRequired ? 'Verify' : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 