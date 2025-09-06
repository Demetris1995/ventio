import type { APIRoute } from 'astro';

const SHOP = import.meta.env.PUBLIC_SHOP_API_URL!;

export const POST: APIRoute = async ({ request }) => {
  const { variantId, quantity } = (await request.json()) as {
    variantId: string;
    quantity?: number;
  };

  const vendureRes = await fetch(SHOP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // forward incoming cookies (keeps same session for SSR/API calls)
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      query: `
        mutation($id: ID!, $qty: Int!) {
          addItemToOrder(productVariantId: $id, quantity: $qty) {
            __typename
            ... on Order { id code totalWithTax state lines { id quantity } }
            ... on ErrorResult { errorCode message }
          }
        }
      `,
      variables: { id: variantId, qty: Number(quantity ?? 1) },
    }),
  });

  // TS-safe JSON
  const vendureJson = (await vendureRes.json()) as {
    data?: { addItemToOrder?: unknown };
    errors?: unknown;
  };

  // Forward Set-Cookie from Vendure to the browser
  const setCookie = vendureRes.headers.get('set-cookie');

  return new Response(
    JSON.stringify(vendureJson.data?.addItemToOrder ?? vendureJson),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...(setCookie ? { 'set-cookie': setCookie } : {}),
      },
    }
  );
};
