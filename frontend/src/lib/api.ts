import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      if (config.headers?.set) {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh lock — prevents concurrent 401s from triggering simultaneous refresh requests
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

function _processQueue(token: string | null) {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
}

function _clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => {
    // Detect if a static host served index.html instead of a JSON API response
    if (
      typeof response.data === 'string' &&
      (response.data.trim().startsWith('<!doctype') ||
        response.data.trim().startsWith('<!DOCTYPE') ||
        response.data.trim().startsWith('<html'))
    ) {
      const err: any = new Error(
        'Backend API endpoint not found (received HTML instead of JSON). Please verify your backend server is running and VITE_API_BASE_URL is configured.'
      );
      err.isHtmlResponse = true;
      return Promise.reject(err);
    }
    return response;
  },
  async (error) => {
    // If error response body is HTML
    if (
      typeof error.response?.data === 'string' &&
      (error.response.data.trim().startsWith('<!doctype') ||
        error.response.data.trim().startsWith('<!DOCTYPE') ||
        error.response.data.trim().startsWith('<html'))
    ) {
      error.message =
        'Backend API server unreachable or returned HTML. Please verify that your backend service is running and VITE_API_BASE_URL is configured.';
    }

    const originalRequest = error.config;
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/register');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      const refreshToken = localStorage.getItem('refresh_token');

      // No refresh token stored → session is dead, go to login
      if (!refreshToken) {
        _clearSession();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // If a refresh is already in flight, queue this request to retry when done
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push((newToken: string | null) => {
            if (!newToken) {
              reject(error);
              return;
            }
            if (originalRequest.headers) {
              if (originalRequest.headers.set) {
                originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
            }
            resolve(api(originalRequest));
          });
        });
      }

      _isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: newRefreshToken } = res.data.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', newRefreshToken);
        if (originalRequest.headers) {
          if (originalRequest.headers.set) {
            originalRequest.headers.set('Authorization', `Bearer ${access_token}`);
          } else {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
        }
        _processQueue(access_token);
        _isRefreshing = false;
        return api(originalRequest);
      } catch (refreshErr) {
        _isRefreshing = false;
        _processQueue(null);
        _clearSession();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export function extractApiErrorMessage(err: any, fallbackMessage = 'An unexpected error occurred'): string {
  if (!err) return fallbackMessage;
  if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
    return 'The server took too long to respond. Please try again.';
  }
  if (err.message === 'Network Error' || (!err.response && !err.status && err.request)) {
    return 'Network error: Unable to reach the server. Please check your internet connection and try again.';
  }
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return data.detail
      .map((item: any) => (typeof item === 'string' ? item : item?.msg || item?.message || JSON.stringify(item)))
      .filter(Boolean)
      .join(', ');
  }
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  if (err?.message) return err.message;
  return fallbackMessage;
}
