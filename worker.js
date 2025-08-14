export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/proxy') return new Response('Not found', { status: 404 });
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400 });
    const upstream = await fetch(target, { headers: { 'User-Agent': 'BGG-Helper/1.0' } });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
  }
}