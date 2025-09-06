export const prerender = false;

import type { APIRoute } from 'astro';
import { SHOP_API_URL } from '../../../lib/client';

const MUTATION_ADJUST = /* GraphQL */ `
  mutation AdjustOrderLine($orderLineId: ID!, $quantity: Int!) {
    adjustOrderLine(orderLineId: $orderLineId, quantity: $quantity) {
      __typename
      ... on Order {
        id
        totalQuantity
        totalWithTax
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

function extract(header: string | null, name: string) {
  if (!header) return null;
  const m = new RegExp(`${name}=([^;]+)`, 'i').exec(header);
  return m?.[1] ?? null;
}
function buildCookie(name: string, value: string) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
}

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const lineId = String(body?.lineId ?? '');
  const quantity = Number(body?.quantity ?? 0);

  if (!lineId || !Number.isInteger(quantity) || quantity < 1) {
    return new Response(JSON.stringify({ message: 'Invalid payload' }), {
      status: 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const vendureRes = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ query: MUTATION_ADJUST, variables: { orderLineId: lineId, quantity } }),
  });

  const set = vendureRes.headers.get('set-cookie') || '';
  const s = extract(set, 'session');
  const sig = extract(set, 'session.sig');

  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  if (s) headers.append('set-cookie', buildCookie('session', s));
  if (sig) headers.append('set-cookie', buildCookie('session.sig', sig));

  const json = await vendureRes.json().catch(() => ({}));
  const payload = json?.data?.adjustOrderLine ?? json;

  return new Response(JSON.stringify(payload), { status: 200, headers });
};
