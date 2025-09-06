import type { APIRoute } from 'astro';
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    ok: true,
    cwd: process.cwd(),
    hint: 'This is the Astro app currently running on :4321',
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
