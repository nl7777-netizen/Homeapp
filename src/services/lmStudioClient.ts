/**
 * OpenAI-compatible LM Studio client (100% local-first).
 * Talks to {baseUrl}/models and {baseUrl}/chat/completions. Supports
 * streaming (SSE) and GBNF-style structured JSON via response_format
 * (json_schema). Requires CORS enabled in LM Studio's local server.
 */

export interface LmStudioModel {
  id: string;
  name?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
  /** When set, requests a strictly-typed JSON object response (GBNF json_schema). */
  responseFormat?: { type: 'json_schema'; json_schema: JsonSchemaSpec };
  signal?: AbortSignal;
}

export class LmStudioError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LmStudioError';
  }
}

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/** GET {baseUrl}/models — populate the model dropdown. */
export async function listModels(baseUrl: string, timeoutMs = 8000): Promise<LmStudioModel[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cleanBaseUrl(baseUrl)}/models`, { signal: ctrl.signal });
    if (!res.ok) throw new LmStudioError(`LM Studio /models returned HTTP ${res.status}`, res.status);
    const data = (await res.json()) as { data?: LmStudioModel[] };
    return data.data ?? [];
  } catch (e) {
    if (e instanceof LmStudioError) throw e;
    throw new LmStudioError(
      'Cannot reach LM Studio. Is the local server running with CORS enabled? ' +
        `(detail: ${e instanceof Error ? e.message : String(e)})`,
    );
  } finally {
    clearTimeout(t);
  }
}

/**
 * POST {baseUrl}/chat/completions.
 * With `stream: true`, calls onToken per SSE chunk and resolves with the
 * full assembled text. Otherwise resolves with the full text.
 */
export async function chatCompletion(baseUrl: string, opts: ChatOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
    stream: opts.stream ?? false,
  };
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const res = await fetch(`${cleanBaseUrl(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new LmStudioError(`LM Studio chat/completions returned HTTP ${res.status}. ${detail.slice(0, 300)}`, res.status);
  }

  if (!res.body || !(opts.stream ?? false)) {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }

  // SSE stream parsing.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          full += token;
          opts.onToken?.(token);
        }
      } catch {
        // Partial/malformed SSE line — skip.
      }
    }
  }
  return full;
}

/** Parse a JSON object out of a model response (tolerates code fences). */
export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in model response.');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
