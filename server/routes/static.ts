/** Arquivos do frontend (dist) + SPA fallback. Retorna null para /api/*. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRONTEND_DIST, MIME, UI_FALLBACK, UI_PATH } from '../config.ts';
import { withSecurityHeaders } from '../lib/http.ts';

export async function handleStatic(req: Request, path: string): Promise<Response | null> {
  // Static: /assets/* (imutável)
  if ((req.method === 'GET' || req.method === 'HEAD') && path.startsWith('/assets/')) {
    const f = Bun.file(join(FRONTEND_DIST, path));
    if (!(await f.exists())) return withSecurityHeaders(new Response('not found', { status: 404 }));
    const ext = path.match(/\.(\w+)$/)?.[0] || '';
    return withSecurityHeaders(new Response(f, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } }));
  }

  // Static: arquivos na raiz do dist (favicon, etc.)
  if ((req.method === 'GET' || req.method === 'HEAD') && path !== '/' && !path.startsWith('/api/')) {
    const f = Bun.file(join(FRONTEND_DIST, path.slice(1)));
    if (await f.exists()) {
      const ext = path.match(/\.(\w+)$/)?.[0] || '';
      return withSecurityHeaders(new Response(f, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } }));
    }
    // SPA fallback p/ React Router (/memorias, /sobre)
    const html = existsSync(UI_PATH) ? readFileSync(UI_PATH, 'utf-8') : UI_FALLBACK;
    return withSecurityHeaders(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }));
  }

  if (req.method === 'GET' && path === '/') {
    const html = existsSync(UI_PATH) ? readFileSync(UI_PATH, 'utf-8') : UI_FALLBACK;
    return withSecurityHeaders(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }));
  }

  return null;
}
