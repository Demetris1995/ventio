import type { APIContext } from 'astro';
import { gqlFetch } from '../../../lib/client';

export async function GET({ request }: APIContext) {
  const cookie = request.headers.get('cookie');
  const query = `
    query { 
      eligibleMethodsBySeller { 
        sellerChannelId 
        sellerName 
        quotes { id code name priceWithTax price } 
      } 
    }
  `;
  try {
    const data = await gqlFetch<{ eligibleMethodsBySeller: any[] }>(query, {}, cookie);
    return new Response(JSON.stringify(data.eligibleMethodsBySeller), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? 'failed' }), { status: 500 });
  }
}
