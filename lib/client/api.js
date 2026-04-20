const DEFAULT_API_BASE_URL = "http://127.0.0.1:3101";

export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_API_BASE_URL
  );
}

export function getSocketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL || getApiBaseUrl();
}

export function apiUrl(path) {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const suffix = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options
  });

  return response;
}
