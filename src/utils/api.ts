import { AuthUser } from '../types';

/**
 * Shared API client utility to ensure consistent authentication and error handling.
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const storedToken = sessionStorage.getItem('liquorflow_session_token') || localStorage.getItem('liquorflow_session_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (storedToken) {
    headers['x-session-token'] = storedToken;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent even in cross-origin/iframe environments
  };

  try {
    const res = await fetch(url, fetchOptions);
    
    // Robust 401 handling
    if (res.status === 401) {
      const currentRoute = window.location.pathname;
      const isAuthPage = currentRoute.includes('/login') || currentRoute.includes('/setup');
      
      if (!isAuthPage) {
        console.warn(`[API] 401 Unauthorized detected on ${url}. Clearing session and triggering logout.`);
        sessionStorage.removeItem('liquorflow_session_token');
        localStorage.removeItem('liquorflow_session_token');
        window.dispatchEvent(new CustomEvent('liquorflow_unauthorized'));
      }
    }

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[API] Received non-JSON response (${res.status}) from ${url}:`, text.substring(0, 200));
      return {
        success: false,
        error: {
          code: 'INVALID_SERVER_RESPONSE',
          message: `Server returned an invalid response (${res.status}). Please verify server configuration.`,
        },
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed',
      },
    };
  }
}

/**
 * Specialized helper for GET requests
 */
export async function apiGet<T = any>(url: string) {
  return apiFetch<T>(url, { method: 'GET' });
}

/**
 * Specialized helper for POST requests
 */
export async function apiPost<T = any>(url: string, body: any) {
  return apiFetch<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Specialized helper for PUT requests
 */
export async function apiPut<T = any>(url: string, body: any) {
  return apiFetch<T>(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Specialized helper for DELETE requests
 */
export async function apiDelete<T = any>(url: string) {
  return apiFetch<T>(url, { method: 'DELETE' });
}
