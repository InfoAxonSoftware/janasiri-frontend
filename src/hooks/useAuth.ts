import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store/store';
import { login, logout, clearError, register, updateUser } from '../store/slices/authSlice';
import type { UserInfo } from '../types/auth.types';
import { useCallback } from 'react';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);

  const handleLogin = useCallback(
    (username: string, password: string) => dispatch(login({ username, password })),
    [dispatch]
  );

  const handleRegister = useCallback(
    (userData: { username: string; email?: string; password: string; phoneNumber: string; role: number; fullName?: string; shopName?: string; location?: string }) => 
      dispatch(register(userData)),
    [dispatch]
  );

  const handleLogout = useCallback(() => dispatch(logout()), [dispatch]);

  const handleClearError = useCallback(() => dispatch(clearError()), [dispatch]);

  const handleUpdateUser = useCallback(
    (user: UserInfo) => dispatch(updateUser(user)),
    [dispatch]
  );

  return {
    ...auth,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    clearError: handleClearError,
    updateUser: handleUpdateUser,
  };
}
