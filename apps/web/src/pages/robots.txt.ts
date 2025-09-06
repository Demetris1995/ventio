import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Sitemap: /sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
