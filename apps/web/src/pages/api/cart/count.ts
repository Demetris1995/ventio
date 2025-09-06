export const prerender = false;
import type { APIRoute } from 'astro';
const SHOP = import.meta.env.PUBLIC_SHOP_API_URL!;

export const GET: APIRoute = async ({ request }) => {
  const res = await fetch(SHOP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ query: `query { activeOrder { totalQuantity } }` }),
  });

  const setCookie = res.headers.get('set-cookie');
  const json = (await res.json()) as any;
  const count = Number(json?.data?.activeOrder?.totalQuantity ?? 0);

  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(setCookie ? { 'set-cookie': setCookie } : {}) },
  });
};
