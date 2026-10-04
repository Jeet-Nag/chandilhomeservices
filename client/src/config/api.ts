import { Capacitor } from '@capacitor/core';

/**
 * Centralized API base URL configuration.
 * - In Web Browser / Production: empty string (requests use standard relative /api/... paths)
 * - In Capacitor Native Android (Development): http://127.0.0.1:3000 (accessible via ADB reverse tcp:3000 tcp:3000)
 */
export const API_BASE_URL: string = Capacitor.isNativePlatform()
  ? ((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:3000')
  : '';

/**
 * Resolves an API path using the centralized API_BASE_URL.
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Installs a global fetch interceptor to automatically route all relative /api/... requests
 * through getApiUrl() across the application without manual per-fetch modifications.
 */
export function initApiInterceptor(): void {
  if (typeof window === 'undefined' || !window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      if (typeof input === 'string') {
        if (input.startsWith('/api/') || input === '/api') {
          return await originalFetch(getApiUrl(input), init);
        }
      } else if (input instanceof URL) {
        if (input.pathname.startsWith('/api/') && input.origin === window.location.origin) {
          return await originalFetch(getApiUrl(input.pathname + input.search), init);
        }
      } else if (input instanceof Request) {
        const urlStr = input.url;
        if (urlStr.startsWith('/api/')) {
          const newRequest = new Request(getApiUrl(urlStr), input);
          return await originalFetch(newRequest, init);
        } else if (urlStr.startsWith(window.location.origin + '/api/')) {
          const path = urlStr.replace(window.location.origin, '');
          const newRequest = new Request(getApiUrl(path), input);
          return await originalFetch(newRequest, init);
        }
      }
    } catch {
      // Fall through to original fetch on any inspection issue
    }
    return originalFetch(input, init);
  };
}
