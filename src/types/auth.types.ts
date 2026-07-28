export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
  phoneNumber: string;
  role: number;
  fullName?: string;
  shopName?: string;
  location?: string;
}

export interface CreateAdminAccountRequest {
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  fullName?: string;
  department?: string;
}

export interface AdminAccountInfo {
  id: string;
  userId: string;
  username: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  department?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPassword?: string;
  createdAt: string;
}

export interface UpdateAdminAccountRequest {
  email?: string;
  phoneNumber?: string;
  fullName?: string;
  department?: string;
  isActive?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  phoneNumber: string;
  role: 'SuperAdmin' | 'Admin' | 'SalesRep' | 'Customer' | 'SalesCoordinator';
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AdminResetPasswordResult {
  userId: string;
  username: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  generatedAtUtc: string;
}

export interface LockedUserInfo {
  userId: string;
  username: string;
  displayName: string;
  employeeCode?: string;
  role: 'SuperAdmin' | 'Admin' | 'SalesRep' | 'Customer' | 'SalesCoordinator';
  accessFailedCount: number;
  lockoutEnd: string;
  lockedForDisplay: string;
}

export interface UnlockUserResult {
  userId: string;
  username: string;
  wasLocked: boolean;
  message: string;
}
