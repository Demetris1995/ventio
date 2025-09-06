import type { APIRoute } from "astro";
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client/core";

const SHOP = import.meta.env.PUBLIC_SHOP_API_URL!;

export const GET: APIRoute = async ({ url, request }) => {
  const client = new ApolloClient({
    link: new HttpLink({ uri: SHOP, fetch, fetchOptions: { credentials: "include" } }),
    cache: new InMemoryCache(),
  });

  // Fetch a reasonable number of product slugs for sitemap
  const { data } = await client.query({
    query: gql`query SitemapProducts { products(options: { take: 200 }) { items { slug } } }`,
    fetchPolicy: "no-cache",
  });

  const origin = `${url.protocol}//${url.host}`;
  const staticUrls = [`${origin}/`, `${origin}/cart`, `${origin}/checkout`];
  const productUrls: string[] = (data?.products?.items ?? []).map((p: any) => `${origin}/p/${p.slug}`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...productUrls]
  .map(u => `  <url><loc>${u}</loc></url>`)
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
