import { AuthUser } from '../types';

/**
 * Diagnostic logger for /api/master/* and /api/masters/* endpoints.
 * Intercepts requests, logs exact URL, headers, bar_id context, and full response structure,
 * specifically identifying unexpected nesting layers (e.g., 'data.data' or 'data.brands').
 */
export function inspectMasterDiagnostic(
  url: string,
  targetUrl: string,
  headers: Record<string, string>,
  status: number,
  response: any
) {
  const isMasterRequest = /\/api\/masters?(\/|$|\?)/i.test(url);
  if (!isMasterRequest) return;

  const barIdFromHeader = headers['x-bar-id'] || null;
  const barIdFromQuery = (() => {
    try {
      const parsed = new URL(targetUrl, 'http://localhost:3000');
      return parsed.searchParams.get('barId') || parsed.searchParams.get('bar_id');
    } catch {
      return null;
    }
  })();
  const barIdContext = barIdFromHeader || barIdFromQuery;

  // Inspect nesting layers in response
  const responseData = response?.data;
  const hasNestedData = responseData && typeof responseData === 'object' && 'data' in responseData;
  const hasDataBrands = responseData && typeof responseData === 'object' && 'brands' in responseData;
  const hasDataItems = responseData && typeof responseData === 'object' && 'items' in responseData;
  const hasDirectBrands = response && typeof response === 'object' && 'brands' in response;
  const hasDirectItems = response && typeof response === 'object' && 'items' in response;

  const nestingAnalysis = {
    hasNestedDataLayer: Boolean(hasNestedData),
    hasDataBrandsLayer: Boolean(hasDataBrands),
    hasDataItemsLayer: Boolean(hasDataItems),
    hasDirectBrandsLayer: Boolean(hasDirectBrands),
    hasDirectItemsLayer: Boolean(hasDirectItems),
    detectedStructure: hasNestedData
      ? 'data.data (DOUBLE NESTED LAYER DETECTED)'
      : hasDataBrands && hasDataItems
      ? 'data.items & data.brands (DUAL STRUCTURE)'
      : hasDataBrands
      ? 'data.brands (WRAPPED IN data.brands)'
      : hasDataItems
      ? 'data.items (WRAPPED IN data.items)'
      : Array.isArray(responseData)
      ? 'data (ARRAY)'
      : 'RAW OBJECT / OTHER',
  };

  const groupTitle = `🔍 [API MASTER DIAGNOSTIC] ${url} (HTTP ${status || 'ERR'})`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupTitle);
  } else {
    console.group(groupTitle);
  }

  console.log('📌 Exact URL:', targetUrl);
  console.log('📋 Request Headers:', headers);
  console.log(
    `🏢 Bar ID Context:`,
    barIdContext
      ? `✅ CORRECTLY PASSED: "${barIdContext}" (${barIdFromHeader ? 'via x-bar-id header' : 'via URL query'})`
      : '⚠️ NOT PASSED (Request executing in Global / Canonical Reference Master scope)'
  );

  console.log('🧬 Response Nesting Analysis:', nestingAnalysis);
  if (hasNestedData) {
    console.warn(
      '⚠️ [NESTING WARNING] Response contains unexpected double nesting layer: "response.data.data"!'
    );
  }
  if (hasDataBrands) {
    console.info(
      'ℹ️ [NESTING INFO] Response contains "data.brands" layer. Verify consumer expects data.brands vs data.items.'
    );
  }

  console.log('📦 Full Response Structure:', response);
  console.groupEnd();
}

/**
 * Shared API client utility to ensure consistent authentication and error handling.
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const storedToken =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('liquorflow_session_token') || (typeof localStorage !== 'undefined' ? localStorage.getItem('liquorflow_session_token') : null)
      : typeof localStorage !== 'undefined'
      ? localStorage.getItem('liquorflow_session_token')
      : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (storedToken) {
    headers['x-session-token'] = storedToken;
  }

  const storedBarId = typeof localStorage !== 'undefined' ? localStorage.getItem('liquorflow_selected_bar_id') : null;
  if (storedBarId) {
    headers['x-bar-id'] = storedBarId;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent even in cross-origin/iframe environments
  };

  const targetUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : typeof window !== 'undefined'
    ? url
    : `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;

  try {
    const res = await fetch(targetUrl, fetchOptions);
    
    // Robust 401 handling
    if (res.status === 401) {
      const currentRoute = typeof window !== 'undefined' ? window.location.pathname : '';
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
      const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<head');
      const errResult = {
        success: false,
        error: {
          code: 'INVALID_SERVER_RESPONSE',
          message: isHtml 
            ? `Server returned HTML instead of JSON (${res.status}). The backend server might be restarting or the route is invalid.`
            : `Server returned an invalid response (${res.status}). Please verify server configuration.`,
        },
      };
      inspectMasterDiagnostic(url, targetUrl, headers, res.status, errResult);
      return errResult;
    }

    inspectMasterDiagnostic(url, targetUrl, headers, res.status, data);
    return data;
  } catch (err: any) {
    const errResult = {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed',
      },
    };
    inspectMasterDiagnostic(url, targetUrl, headers, 0, errResult);
    return errResult;
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
 * Specialized helper for PATCH requests
 */
export async function apiPatch<T = any>(url: string, body: any) {
  return apiFetch<T>(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Specialized helper for DELETE requests
 */
export async function apiDelete<T = any>(url: string) {
  return apiFetch<T>(url, { method: 'DELETE' });
}
