// Minimal client helpers for API routes and pages.
// Uses PUBLIC_SHOP_API_URL and forwards cookies when needed.

export const SHOP_API_URL: string = import.meta.env.PUBLIC_SHOP_API_URL!;

export async function gqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  cookie?: string | null,
): Promise<T> {
  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  // Forward set-cookie if caller needs it; the API routes do that themselves.
  const json = (await res.json()) as unknown as { data?: T; errors?: Array<{ message: string }> };

  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  if (json?.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  return json.data as T;
}
