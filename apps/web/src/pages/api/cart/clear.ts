export const prerender = false;

import type { APIRoute } from 'astro';
import { SHOP_API_URL } from '../../../lib/client';

const QUERY_LINES = /* GraphQL */ `
  query ActiveOrderLines {
    activeOrder {
      id
      lines { id }
    }
  }
`;

const MUTATION_REMOVE = /* GraphQL */ `
  mutation RemoveOrderLine($orderLineId: ID!) {
    removeOrderLine(orderLineId: $orderLineId) {
      __typename
      ... on Order { id totalQuantity totalWithTax }
      ... on ErrorResult { errorCode message }
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
  // Step 1: get current lines
  const qRes = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ query: QUERY_LINES }),
  });

  const setQ = qRes.headers.get('set-cookie') || '';
  const sQ = extract(setQ, 'session');
  const sigQ = extract(setQ, 'session.sig');

  // Compose headers for final response; carry over any cookie updates
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  if (sQ) headers.append('set-cookie', buildCookie('session', sQ));
  if (sigQ) headers.append('set-cookie', buildCookie('session.sig', sigQ));

  const qJson = await qRes.json().catch(() => ({}));
  const lines: Array<{ id: string }> = qJson?.data?.activeOrder?.lines ?? [];

  // If no lines, nothing to do
  if (!lines.length) {
    return new Response(JSON.stringify({ ok: true, cleared: 0 }), { status: 200, headers });
  }

  // Step 2: remove each line sequentially (preserves same session/cookies)
  let lastPayload: any = null;
  for (const l of lines) {
    const r = await fetch(SHOP_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ query: MUTATION_REMOVE, variables: { orderLineId: l.id } }),
    });
    const set = r.headers.get('set-cookie') || '';
    const s = extract(set, 'session');
    const sig = extract(set, 'session.sig');
    if (s) headers.append('set-cookie', buildCookie('session', s));
    if (sig) headers.append('set-cookie', buildCookie('session.sig', sig));

    lastPayload = await r.json().catch(() => ({}));
    const resNode = lastPayload?.data?.removeOrderLine;
    if (resNode?.__typename === 'ErrorResult') {
      return new Response(JSON.stringify(resNode), { status: 200, headers });
    }
  }

  return new Response(JSON.stringify({ ok: true, cleared: lines.length, last: lastPayload?.data?.removeOrderLine ?? null }), {
    status: 200,
    headers,
  });
};
