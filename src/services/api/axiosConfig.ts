import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PUBLIC_PATH_PREFIXES = [
  '/customer-registrations',
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
];

function isPublicRequest(url?: string) {
  if (!url) return false;
  return PUBLIC_PATH_PREFIXES.some((prefix) => url.startsWith(prefix));
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000,
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  if (isPublicRequest(config.url)) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  }

  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const clearAuthAndRedirect = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('shoppingCart');
  window.location.href = '/login';
};

// Response interceptor — handle 401 / token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (isPublicRequest(originalRequest?.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      if (originalRequest?._retry) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      const accessToken = localStorage.getItem('accessToken');

      if (!refreshToken || !accessToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh-token`, { accessToken, refreshToken });
        if (data?.success) {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        // token refresh failed - invalidate current session and require login
      }

      clearAuthAndRedirect();
    }

    return Promise.reject(error);
  }
);

export default api;
