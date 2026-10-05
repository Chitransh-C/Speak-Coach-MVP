/**
 * Central frontend env — all API / voice-proxy URLs go through here.
 *
 * VITE_API_BASE_URL must be the full REST prefix, including /api/v1:
 *   http://localhost:3001/api/v1
 *   https://your.domain.com/api/v1
 */

const DEFAULT_API_BASE_URL = "http://localhost:3001/api/v1";

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/** Full API base including /api/v1 (no trailing slash). Never empty. */
export function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  return trimTrailingSlash(raw || DEFAULT_API_BASE_URL);
}

/**
 * Host origin for non-v1 routes (e.g. Sarvam proxy /api/sarvam/...).
 * Derived from VITE_API_BASE_URL by stripping a trailing /api/v1.
 */
export function getApiOrigin(): string {
  const base = getApiBaseUrl();
  const stripped = base.replace(/\/api\/v1$/i, "");
  if (stripped) return stripped;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Join a path onto the API base. Pass "/auth/login" (not "/api/v1/..."). */
export function apiUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  // Tolerate legacy callers that still prefix /api/v1
  if (p.startsWith("/api/v1/")) p = p.slice("/api/v1".length);
  else if (p === "/api/v1") p = "";
  return `${getApiBaseUrl()}${p}`;
}
