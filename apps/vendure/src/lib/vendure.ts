// Minimal helper to call Vendure Shop API while forwarding cookies across ports.
const VENDURE_SHOP_API = process.env.VENDURE_SHOP_API ?? "http://localhost:3000/shop-api";

export type GqlResult<T> = { data?: T; errors?: Array<{ message: string }> };

export async function vendureFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  req?: Request
): Promise<{ result: GqlResult<T>; setCookies: string[] }> {
  const res = await fetch(VENDURE_SHOP_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // forward incoming cookies so session sticks to the same active order
      ...(req ? { cookie: req.headers.get("cookie") ?? "" } : {}),
    },
    body: JSON.stringify({ query, variables }),
    // important: allow cross-port cookie
    credentials: "include",
  });

  // collect Set-Cookie headers to forward back to the browser
  const setCookie = res.headers.get("set-cookie");
  const setCookies = setCookie ? [setCookie] : [];

  const json = (await res.json()) as GqlResult<T>;
  return { result: json, setCookies };
}

// Helper to mirror Set-Cookie back to client from our Astro API routes
export function withSetCookies(body: BodyInit, setCookies: string[], init?: ResponseInit) {
  const headers = new Headers(init?.headers ?? {});
  setCookies.forEach((sc) => headers.append("set-cookie", sc));
  return new Response(body, { ...init, headers });
}
