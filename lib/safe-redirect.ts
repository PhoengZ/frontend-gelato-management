/**
 * Resolves a `next` value the way the browser will, so characters the URL parser strips or
 * rewrites (tabs, newlines, backslashes) cannot smuggle in another origin. Returns a
 * same-origin path, or the fallback.
 */
export function safeNextPath(value: string | null, fallback: string, origin = window.location.origin) {
  if (!value) return fallback;
  try {
    const url = new URL(value, origin);
    // A path such as `/.//host` is same-origin here but protocol-relative once it is navigated to.
    if (url.origin !== origin || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
