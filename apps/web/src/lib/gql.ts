import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';

export function makeClient(request?: Request) {
  const headers: Record<string, string> = {};
  // Forward cookie from browser -> Astro server -> Vendure
  const cookie = request?.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;

  return new ApolloClient({
    link: new HttpLink({
      uri: import.meta.env.PUBLIC_SHOP_API_URL,
      fetch,
      fetchOptions: { credentials: 'include' },
      headers,
    }),
    cache: new InMemoryCache(),
  });
}
