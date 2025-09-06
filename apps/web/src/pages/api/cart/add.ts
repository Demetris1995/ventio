export const prerender = false;

import type { APIRoute } from 'astro';
import { SHOP_API_URL } from '../../../lib/client';
import { MUTATION_ADD_TO_ORDER } from '../../../lib/gql';

function isFormContentType(ct: string) {
  const c = ct.toLowerCase();
  return c.startsWith('application/x-www-form-urlencoded') || c.startsWith('multipart/form-data');
}

function extractCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  const re = new RegExp(`${name}=([^;]+)`, 'i');
  const m = re.exec(header);
  return m?.[1] ?? null;
}

function buildSetCookie(name: string, value: string) {
  // Dev-friendly cookie; Path=/ so it’s sent on all routes; no Domain so it’s first-party to :4321
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
}

export const POST: APIRoute = async ({ request }) => {
  const ct = (request.headers.get('content-type') || '').toLowerCase();

  // Parse payload (JSON, form, or query)
  let variantId = '';
  let quantity = 1;

  try {
    if (ct.includes('application/json')) {
      const raw = await request.text();
      const body = raw ? JSON.parse(raw) : {};
      variantId = String(body.variantId ?? '');
      quantity = Number(body.quantity ?? 1);
    } else if (isFormContentType(ct)) {
      const fd = await request.formData();
      variantId = String(fd.get('variantId') ?? '');
      quantity = Number(fd.get('quantity') ?? 1);
    } else {
      const u = new URL(request.url);
      variantId = u.searchParams.get('variantId') || '';
      quantity = Number(u.searchParams.get('quantity') || '1');
    }
  } catch {
    /* ignore; validate below */
  }

  if (!variantId || Number.isNaN(quantity) || quantity <= 0) {
    return new Response(JSON.stringify({ message: 'Invalid payload: missing variantId' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  // Call Vendure and forward incoming cookie (if any)
  const vendureRes = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      query: MUTATION_ADD_TO_ORDER,
      variables: { variantId, quantity },
    }),
  });

  const vendureSetCookie = vendureRes.headers.get('set-cookie') || '';

  // Extract BOTH cookies Vendure uses for sessions
  const sessionVal = extractCookieValue(vendureSetCookie, 'session');
  const sigVal = extractCookieValue(vendureSetCookie, 'session.sig');

  // Use a real Headers object so we can append Set-Cookie more than once
  const headers = new Headers();
  headers.set('cache-control', 'no-store');

  if (sessionVal) headers.append('set-cookie', buildSetCookie('session', sessionVal));
  if (sigVal) headers.append('set-cookie', buildSetCookie('session.sig', sigVal));

  const isForm = isFormContentType(ct) || !ct;

  if (isForm) {
    // Server-side redirect so the browser commits cookies, then loads /cart with them
    headers.set('location', '/cart');
    return new Response(null, { status: 302, headers });
  }

  // JSON clients: return Vendure payload
  const json = await vendureRes.json().catch(() => ({}));
  const payload = json?.data?.addItemToOrder ?? json;
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(payload), { status: 200, headers });
};
