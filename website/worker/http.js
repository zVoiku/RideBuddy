/** Response helpers shared by the Worker's handlers. */

export const ADMIN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export function plain(status, text, extra = {}) {
  return new Response(text, { status, headers: { ...ADMIN_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra } });
}

/** The request came from a page on this same site (the forms and site.js post to their own origin). */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
