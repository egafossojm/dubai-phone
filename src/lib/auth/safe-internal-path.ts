/**
 * Post-login redirect target. Only same-origin relative paths are allowed.
 * Rejects protocol-relative URLs (`//host`) and backslash tricks (`/\host`).
 */
export function safeInternalPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
    return "/";
  }

  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (value.includes("\\") || value.includes("://")) {
    return "/";
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return "/";
  }

  return value;
}
