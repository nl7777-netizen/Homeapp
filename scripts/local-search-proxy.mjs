#!/usr/bin/env node
/**
 * Local web-search proxy for the NSW Property Planner.
 *
 * Runs on your machine (Node 20+ — uses native fetch, no dependencies) and
 * bridges the browser to a search API so the AI Suburb Lookup and the
 * Safe AI Tax & Duty Update Checker can pull live data WITHOUT the browser
 * holding any API keys (CORS-safe, localhost only).
 *
 * Usage:
 *   SERPER_API_KEY=... node scripts/local-search-proxy.mjs
 *   BRAVE_API_KEY=... node scripts/local-search-proxy.mjs
 *   SERPAPI_KEY=... node scripts/local-search-proxy.mjs
 *
 * The planner's Local AI settings should point at:
 *   http://localhost:8787/search
 *
 * Endpoints:
 *   GET /search?q=<query>[&num=<n>]
 *   GET /health
 */

import http from 'node:http';

const PORT = parseInt(process.env.PORT ?? '8787', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function json(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Serper.dev — Google SERP API. */
async function searchSerper(query, num) {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num }),
  });
  if (!r.ok) throw new Error(`Serper HTTP ${r.status}`);
  const d = await r.json();
  return (d.organic ?? []).map((o) => ({
    title: o.title,
    url: o.link,
    snippet: o.snippet ?? '',
  }));
}

/** Brave Search API. */
async function searchBrave(query, num) {
  const params = new URLSearchParams({ q: query, count: String(num) });
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
  });
  if (!r.ok) throw new Error(`Brave HTTP ${r.status}`);
  const d = await r.json();
  return (d.web?.results ?? []).map((o) => ({
    title: o.title,
    url: o.url,
    snippet: o.description ?? '',
  }));
}

/** SerpApi Google search. */
async function searchSerpApi(query, num) {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: process.env.SERPAPI_KEY,
    num: String(num),
  });
  const r = await fetch(`https://serpapi.com/searches/json?${params}`);
  if (!r.ok) throw new Error(`SerpApi HTTP ${r.status}`);
  const d = await r.json();
  return (d.organic_results ?? []).map((o) => ({
    title: o.title,
    url: o.link,
    snippet: o.snippet ?? '',
  }));
}

async function route(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }
  if (url.pathname === '/health') {
    const provider = process.env.SERPER_API_KEY ? 'serper' : process.env.BRAVE_API_KEY ? 'brave' : process.env.SERPAPI_KEY ? 'serpapi' : 'none';
    json(res, 200, { ok: true, provider });
    return;
  }
  if (url.pathname !== '/search') {
    json(res, 404, { error: 'Unknown endpoint — use /search?q=…' });
    return;
  }
  const q = url.searchParams.get('q');
  if (!q) {
    json(res, 400, { error: 'Missing ?q= query parameter' });
    return;
  }
  const num = Math.min(10, Math.max(1, parseInt(url.searchParams.get('num') ?? '8', 10) || 8));

  let hits;
  try {
    if (process.env.SERPER_API_KEY) hits = await searchSerper(q, num);
    else if (process.env.BRAVE_API_KEY) hits = await searchBrave(q, num);
    else if (process.env.SERPAPI_KEY) hits = await searchSerpApi(q, num);
    else {
      json(res, 503, { error: 'No search provider configured. Set SERPER_API_KEY, BRAVE_API_KEY or SERPAPI_KEY and restart.' });
      return;
    }
  } catch (e) {
    json(res, 502, { error: `Upstream search failed: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  json(res, 200, { results: hits, provider: 'local-proxy' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => json(res, 500, { error: e instanceof Error ? e.message : String(e) }));
});

server.listen(PORT, HOST, () => {
  const provider = process.env.SERPER_API_KEY ? 'serper' : process.env.BRAVE_API_KEY ? 'brave' : process.env.SERPAPI_KEY ? 'serpapi' : 'NONE — set an API key';
  console.log(`[local-search-proxy] listening on http://${HOST}:${PORT}/search  (provider: ${provider})`);
});
