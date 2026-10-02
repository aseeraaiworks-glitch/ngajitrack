// Cookie-authenticated mutation protection. Host is the requested public authority;
// Next's internal request URL can use the server's bound hostname/port after Proxy.
// Deployment must preserve Host. Do not trust arbitrary X-Forwarded-Host or wildcard origins.
export function sameOriginWrite(request: { headers: Headers; url: string }) {
  const raw = request.headers.get('origin'), host = request.headers.get('host');
  if (!raw || !host) return false;
  try {
    const origin = new URL(raw);
    return ['http:', 'https:'].includes(origin.protocol) && origin.origin === raw &&
      origin.host === host.toLowerCase() && origin.protocol === new URL(request.url).protocol;
  } catch { return false; }
}
