/** Primitivas HTTP do BFF: headers de segurança + JSON + SSE. */

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // sha256-… = script inline de bootstrap do tema em index.html (evita FOUC).
  // Se o conteúdo daquele <script> mudar, recalcular o hash e atualizar aqui,
  // senão o CSP bloqueia o script e o tema volta ao claro no refresh.
  // connect-src inclui o Supabase Cloud: o supabase-js no browser fala
  // direto com https://<ref>.supabase.co (auth). Sem isso o signup/login
  // morre com TypeError "Failed to fetch" (CSP bloqueia cross-origin).
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'sha256-AspNRzsvPr2/WxXfZUY/UJBzuHslkTwELHOu3l/vk14='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https://*.supabase.co; form-action 'self'",
  'Strict-Transport-Security': 'max-age=31536000',
};

export function withSecurityHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

export function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(Response.json(data, { status }));
}

export function sseMsg(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
