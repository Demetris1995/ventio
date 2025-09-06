import type { APIRoute } from 'astro';

const SHOP = import.meta.env.PUBLIC_SHOP_API_URL!;

async function gfetch(
  request: Request,
  query: string,
  variables?: Record<string, unknown>
) {
  const res = await fetch(SHOP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ query, variables }),
  });
  const setCookie = res.headers.get('set-cookie');
  const json = (await res.json()) as { data?: any; errors?: any };
  return { json, setCookie };
}

export const POST: APIRoute = async ({ request }) => {
  const payload = (await request.json()) as {
    email: string;
    firstName: string;
    lastName: string;
    streetLine1: string;
    city: string;
    postalCode: string;
    countryCode: string; // ISO 2-letter, e.g. "CY"
  };

  // 1) Customer
  await gfetch(
    request,
    `mutation($input: CreateCustomerInput!) {
      setCustomerForOrder(input: $input) { __typename }
    }`,
    { input: { emailAddress: payload.email, firstName: payload.firstName, lastName: payload.lastName } }
  );

  // 2) Addresses
  await gfetch(
    request,
    `mutation($ship: CreateAddressInput!, $bill: CreateAddressInput) {
      setOrderShippingAddress(input: $ship) { __typename }
      setOrderBillingAddress(input: $bill) { __typename }
    }`,
    {
      ship: {
        fullName: `${payload.firstName} ${payload.lastName}`,
        streetLine1: payload.streetLine1,
        city: payload.city,
        postalCode: payload.postalCode,
        countryCode: payload.countryCode,
      },
      bill: {
        fullName: `${payload.firstName} ${payload.lastName}`,
        streetLine1: payload.streetLine1,
        city: payload.city,
        postalCode: payload.postalCode,
        countryCode: payload.countryCode,
      },
    }
  );

  // 3) Transition to ArrangingPayment
  await gfetch(
    request,
    `mutation { transitionOrderToState(state: "ArrangingPayment") { __typename ... on Order { id state } } }`
  );

  // 4) Add payment (manual handler we registered)
  const { json, setCookie } = await gfetch(
    request,
    `mutation {
      addPaymentToOrder(input: { method: "manual", metadata: { note: "dev" } }) {
        __typename
        ... on Order { id state code totalWithTax }
        ... on ErrorResult { errorCode message }
      }
    }`
  );

  return new Response(JSON.stringify(json.data?.addPaymentToOrder ?? json), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...(setCookie ? { 'set-cookie': setCookie } : {}),
    },
  });
};
