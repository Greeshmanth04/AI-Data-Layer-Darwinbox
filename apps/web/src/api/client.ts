export const apiClient = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  const data = await res.json();
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    throw new Error(data.error?.message || 'API Error');
  }
  return data.data; 
};
