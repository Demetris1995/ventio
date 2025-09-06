export const prerender = false;
import type { APIRoute } from 'astro';
import { SHOP_API_URL } from '../../../lib/client';
import { MUTATION_CHECKOUT } from '../../../lib/gql';

export const POST: APIRoute = async ({ request }) => {
  const ct = request.headers.get('content-type') || '';
  const body = ct.includes('application/json')
    ? ((await request.json()) as any)
    : Object.fromEntries(await request.formData());

  const email = String(body?.email ?? '');
  const firstName = String(body?.firstName ?? '');
  const lastName = String(body?.lastName ?? '');
  const streetLine1 = String(body?.streetLine1 ?? '');
  const city = String(body?.city ?? '');
  const postalCode = String(body?.postalCode ?? '');
  const countryCode = String(body?.countryCode ?? '');

  if (!email || !firstName || !lastName || !streetLine1 || !city || !postalCode || !countryCode) {
    return new Response(JSON.stringify({ message: 'Missing checkout fields' }), { status: 400 });
  }

  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({
      query: MUTATION_CHECKOUT,
      variables: { email, firstName, lastName, streetLine1, city, postalCode, countryCode },
    }),
  });

  const setCookie = res.headers.get('set-cookie');
  const json = (await res.json()) as any;
  const code =
    json?.data?.transitionOrderToState?.code ??
    json?.data?.addPaymentToOrder?.code ??
    null;

  return new Response(JSON.stringify(code ? { code } : (json?.data ?? json)), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(setCookie ? { 'set-cookie': setCookie } : {}) },
  });
};
