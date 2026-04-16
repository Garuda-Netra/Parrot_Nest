function sanitizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveApiBase() {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envBase) {
    return sanitizeBaseUrl(envBase);
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }

    return window.location.origin;
  }

  return 'http://localhost:5000';
}

const API_BASE = resolveApiBase();

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

async function parseApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const raw = await res.text();

  if (!raw) {
    return {
      success: res.ok,
      message: res.ok ? 'Request succeeded.' : 'Request failed.',
      data: {} as T,
    };
  }

  try {
    return JSON.parse(raw) as ApiResponse<T>;
  } catch {
    return {
      success: res.ok,
      message: raw,
      data: {} as T,
    };
  }
}

export async function apiPost<T = any>(path: string, body: any, isFormData = false): Promise<ApiResponse<T>> {
  const options: RequestInit = {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
  };

  if (!isFormData) {
    options.headers = { 'Content-Type': 'application/json' };
  }

  const res = await fetch(buildApiUrl(path), options);
  return parseApiResponse<T>(res);
}

export async function apiGet<T = any>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(buildApiUrl(path));
  return parseApiResponse<T>(res);
}

export async function apiDelete<T = any>(path: string, deleteToken?: string): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {};
  if (deleteToken) {
    headers['x-delete-token'] = deleteToken;
  }

  const res = await fetch(buildApiUrl(path), {
    method: 'DELETE',
    headers,
  });

  return parseApiResponse<T>(res);
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}
