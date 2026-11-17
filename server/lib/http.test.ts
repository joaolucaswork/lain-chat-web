import { describe, expect, test } from 'bun:test';
import { json, sseMsg, withSecurityHeaders } from './http.ts';

describe('sseMsg', () => {
  test('formato SSE event/data com \\n\\n final', () => {
    expect(sseMsg('token', { text: 'oi' })).toBe('event: token\ndata: {"text":"oi"}\n\n');
  });
});

describe('json', () => {
  test('status custom + headers de segurança', async () => {
    const res = json({ error: 'x' }, 400);
    expect(res.status).toBe(400);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.json()).toEqual({ error: 'x' });
  });
});

describe('withSecurityHeaders', () => {
  test('CSP não abre script inline (só o hash do bootstrap do tema)', () => {
    const res = withSecurityHeaders(new Response('ok'));
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain('sha256-');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
