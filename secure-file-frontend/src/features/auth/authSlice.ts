import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/axios';

interface User {
  id: number;
  email: string;
  username: string;
  mfa_enabled: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,
  mfaRequired: false,
};

interface LoginResponse {
  access?: string;
  refresh?: string;
  user?: User;
  mfa_required?: boolean;
  error?: string;
}

interface LoginSuccessPayload {
  token: string;
  user: User;
  mfaRequired: boolean;
}

interface MfaRequiredPayload {
  mfaRequired: true;
}

type LoginPayload = LoginSuccessPayload | MfaRequiredPayload;

interface ApiError {
  response?: {
    data?: {
      error?: string;
      detail?: string;
    };
  };
  message?: string;
}

export const login = createAsyncThunk<LoginPayload, { email: string; password: string; totp_code?: string }>(
  'auth/login',
  async ({ email, password, totp_code }, { rejectWithValue }) => {
    try {
      const response = await api.post<LoginResponse>('/auth/login/', {
        email,
        password,
        ...(totp_code && { totp_code }),
      });

      const data = response.data;

      if (data.mfa_required) {
        return { mfaRequired: true } as MfaRequiredPayload;
      }

      if (data.access && data.refresh && data.user) {
        localStorage.setItem('token', data.access);
        localStorage.setItem('refreshToken', data.refresh);
        
        return {
          token: data.access,
          user: data.user,
          mfaRequired: false,
        } as LoginSuccessPayload;
      }

      return rejectWithValue('Invalid response from server');
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError.response?.data?.error || apiError.response?.data?.detail || 'Login failed';
      return rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMfaRequired: (state) => {
      state.mfaRequired = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.mfaRequired = false;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('file_keys'); // Clear stored encryption keys
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        if ('token' in action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.mfaRequired = false;
        } else {
          state.mfaRequired = true;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearMfaRequired, logout } = authSlice.actions;

export default authSlice.reducer; 