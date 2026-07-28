import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { UserInfo, AuthResponse } from '../../types/auth.types';
import { authApi } from '../../services/api/authApi';

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const roleMap: Record<string, UserInfo['role']> = {
  '0': 'SuperAdmin',
  '1': 'Admin',
  '2': 'SalesRep',
  '3': 'Customer',
  '4': 'SalesCoordinator',
  SuperAdmin: 'SuperAdmin',
  Admin: 'Admin',
  SalesRep: 'SalesRep',
  Customer: 'Customer',
  SalesCoordinator: 'SalesCoordinator',
};

const normalizeUser = (user: any): UserInfo | null => {
  if (!user) return null;
  const normalizedRole = roleMap[String(user.role)] ?? 'Customer';
  return {
    ...user,
    role: normalizedRole,
  } as UserInfo;
};

const normalizeAuthPayload = (payload: AuthResponse): AuthResponse => ({
  ...payload,
  user: normalizeUser(payload.user) as UserInfo,
});

const loadStoredUser = (): UserInfo | null => {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: loadStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(credentials);
      if (data.success) {
        const normalized = normalizeAuthPayload(data.data);
        localStorage.setItem('accessToken', normalized.accessToken);
        localStorage.setItem('refreshToken', normalized.refreshToken);
        localStorage.setItem('user', JSON.stringify(normalized.user));
        return normalized;
      }
      return rejectWithValue(data.message || 'Login failed');
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: { username: string; email?: string; password: string; phoneNumber: string; role: number; fullName?: string; shopName?: string; location?: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.register(userData);
      if (data.success) {
        const normalized = normalizeAuthPayload(data.data);
        localStorage.setItem('accessToken', normalized.accessToken);
        localStorage.setItem('refreshToken', normalized.refreshToken);
        localStorage.setItem('user', JSON.stringify(normalized.user));
        return normalized;
      }
      return rejectWithValue(data.message || 'Registration failed');
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await authApi.logout(); } catch { /* ignore */ }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    updateUser(state, action: PayloadAction<UserInfo>) {
      const normalizedUser = normalizeUser(action.payload);
      state.user = normalizedUser;
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    },
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      const normalized = normalizeAuthPayload(action.payload);
      state.user = normalized.user;
      state.accessToken = normalized.accessToken;
      state.refreshToken = normalized.refreshToken;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(register.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, setCredentials, updateUser } = authSlice.actions;
export default authSlice.reducer;
