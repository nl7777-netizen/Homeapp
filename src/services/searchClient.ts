/**
 * Optional web search client with offline fallback.
 *
 * Providers:
 *  - 'none':        no search — callers fall back to the local suburb DB.
 *  - 'local-proxy': zero-dependency local Node proxy (scripts/local-search-proxy.mjs)
 *                   which fetches Serper.dev / Brave / SerpApi server-side
 *                   (no CORS problems) and serves results on localhost.
 *  - 'serper':      direct browser POST to https://google.serper.dev/search
 *                   with a user-supplied API key (stored in localStorage only).
 */

import type { AiSettings } from '../types/planner';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOutcome {
  hits: SearchHit[];
  provider: 'local-proxy' | 'serper' | 'none';
  error: string | null;
}

function cleanUrl(u: string): string {
  return u.replace(/\/+$/, '');
}

export async function webSearch(query: string, settings: AiSettings, timeoutMs = 12000): Promise<SearchOutcome> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (settings.searchProvider === 'serper') {
      if (!settings.serperApiKey) {
        return { hits: [], provider: 'serper', error: 'Serper API key not set (Local AI Settings).' };
      }
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': settings.serperApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 8 }),
        signal: ctrl.signal,
      });
      if (!res.ok) return { hits: [], provider: 'serper', error: `Serper HTTP ${res.status}` };
      const data = (await res.json()) as { organic?: { title?: string; link?: string; snippet?: string }[] };
      const hits = (data.organic ?? []).map((o) => ({ title: o.title ?? '', url: o.link ?? '', snippet: o.snippet ?? '' }));
      return { hits, provider: 'serper', error: null };
    }

    if (settings.searchProvider === 'local-proxy') {
      const url = `${cleanUrl(settings.localProxyUrl)}?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return { hits: [], provider: 'local-proxy', error: `Local proxy HTTP ${res.status} — is scripts/local-search-proxy.mjs running?` };
      const data = (await res.json()) as { results?: SearchHit[] };
      return { hits: data.results ?? [], provider: 'local-proxy', error: null };
    }

    return { hits: [], provider: 'none', error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hits: [], provider: settings.searchProvider === 'none' ? 'none' : settings.searchProvider, error: msg };
  } finally {
    clearTimeout(t);
  }
}
