export const prerender = false;
import type { APIRoute } from 'astro';
const SHOP = import.meta.env.PUBLIC_SHOP_API_URL!;

export const POST: APIRoute = async ({ request, redirect }) => {
  const ct = request.headers.get('content-type') || '';
  let lineId = '', quantity = 0;

  if (ct.includes('application/json')) {
    const b = (await request.json()) as any;
    lineId = String(b.lineId ?? '');
    quantity = Number(b.quantity ?? 0);
  } else {
    const f = await request.formData();
    lineId = String(f.get('lineId') ?? '');
    quantity = Number(f.get('quantity') ?? 0);
  }

  if (!lineId || Number.isNaN(quantity)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
  }

  const res = await fetch(SHOP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({
      query: `mutation($lineId: ID!, $quantity: Int!) {
        adjustOrderLine(orderLineId: $lineId, quantity: $quantity) {
          ... on Order { id state code totalWithTax }
          ... on ErrorResult { errorCode message }
        }
      }`,
      variables: { lineId, quantity },
    }),
  });

  const setCookie = res.headers.get('set-cookie');
  const json = (await res.json()) as any;

  const isFormPost = !ct.includes('application/json');
  if (isFormPost) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/cart', ...(setCookie ? { 'set-cookie': setCookie } : {}) },
    });
  }

  return new Response(JSON.stringify(json?.data?.adjustOrderLine ?? json), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(setCookie ? { 'set-cookie': setCookie } : {}) },
  });
};
