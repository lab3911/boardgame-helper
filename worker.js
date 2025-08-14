// Cloudflare Worker example: set OPENAI_API_KEY in Secrets.
// Usage: deploy and set the endpoint in Settings as https://YOUR_SUBDOMAIN.workers.dev/v1/chat/completions
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/chat/completions') return new Response('Not found', { status: 404 });
    const body = await request.json();
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    return new Response(await resp.text(), { status: resp.status, headers: { 'content-type': 'application/json' } });
  }
}
