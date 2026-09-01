import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
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
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
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
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      }
    }
    return Promise.reject(error);
  }
);
