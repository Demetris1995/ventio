import type { APIContext } from 'astro';
import { gqlFetch } from '../../../lib/client';

export async function POST({ request }: APIContext) {
  const cookie = request.headers.get('cookie');
  const body = await request.json();
  const mutation = `
    mutation Set($selections: [SellerShippingSelectionInput!]!) {
      setShippingPerSeller(selections: $selections) { id }
    }
  `;
  try {
    const data = await gqlFetch(mutation, { selections: body?.selections ?? [] }, cookie);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'failed' }), { status: 500 });
  }
}
