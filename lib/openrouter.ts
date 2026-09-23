import type { Usage } from "@/lib/usage";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const GENERATION_ENDPOINT = "https://openrouter.ai/api/v1/generation";

export type SystemBlock = { text: string; cache?: boolean };

export type ChatRequest = {
  /** Stable prefix: SOP, golden example. Blocks with `cache: true` get an ephemeral cache breakpoint. */
  system: SystemBlock[];
  user: string;
  maxTokens?: number;
  /** Overrides LLM_REASONING_EFFORT for this call only (e.g. the audit pass needs less thinking than drafting). */
  reasoningEffort?: "low" | "medium" | "high";
  signal?: AbortSignal;
};

export type ChatEvent =
  | { type: "id"; openrouterId: string }
  | { type: "text"; delta: string }
  | { type: "done"; openrouterId: string | null; usage: Usage };

export function llmModel(): string {
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not set");
  return model;
}

function headers(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
    "X-Title": "Cue Card Generator",
  };
}

type RawUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  is_byok?: boolean;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  cost_details?: { upstream_inference_cost?: number };
};

/**
 * BYOK (bring-your-own-key) note: when the OpenRouter account routes a model through the
 * user's own provider key, `cost` is ONLY OpenRouter's own service fee (often $0, since BYOK
 * usage is free up to a monthly allowance) — not what the provider actually charges. The real
 * spend is `cost_details.upstream_inference_cost` (or `upstream_inference_cost` from the
 * /generation endpoint). In BYOK mode the two are added: the fee (once the free allowance is
 * used up) plus the provider's own charge. In normal (non-BYOK) mode `cost` already IS the full
 * billed amount, so nothing is added. See https://openrouter.ai/docs/features/byok.
 */
function trueCost(openrouterFee: number, isByok: boolean | undefined, upstreamCost: number): number {
  return isByok ? openrouterFee + upstreamCost : openrouterFee;
}

type StreamChunk = {
  id?: string;
  error?: { message?: string };
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: RawUsage;
};

/** Maps OpenRouter's `usage` object to our shape. `cost` is OpenRouter's settled number in USD. */
export function parseUsage(u: RawUsage | undefined): Usage {
  return {
    inputTokens: u?.prompt_tokens ?? 0,
    outputTokens: u?.completion_tokens ?? 0,
    cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: u?.prompt_tokens_details?.cache_write_tokens ?? 0,
    costUsd: trueCost(Number(u?.cost ?? 0), u?.is_byok, Number(u?.cost_details?.upstream_inference_cost ?? 0)),
  };
}

/**
 * Streams one chat completion. Yields text deltas, then a final `done` event carrying
 * real usage/cost (from `usage: { include: true }`) and the generation id for reconciliation.
 * Extended thinking is on; reasoning deltas are consumed but never yielded.
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatEvent> {
  const body = {
    model: llmModel(),
    stream: true,
    usage: { include: true },
    reasoning: { effort: req.reasoningEffort ?? process.env.LLM_REASONING_EFFORT ?? "medium" },
    max_tokens: req.maxTokens ?? 32_000,
    messages: [
      {
        role: "system",
        content: req.system.map((b) => ({
          type: "text",
          text: b.text,
          // 1-hour TTL, not the 5-min default: the audit phase runs several sections' worth of
          // calls, some queued behind a concurrency limit, and 5 minutes was tight enough that a
          // late-queued call could miss the window and silently fall back to a cold, full-price
          // write. UNVERIFIED that OpenRouter passes `ttl` through — see lib/pricing.ts's comment
          // on the matching cacheWrite rate, and run `npm run verify:caching` once the key works.
          ...(b.cache ? { cache_control: { type: "ephemeral", ttl: "1h" } } : {}),
        })),
      },
      { role: "user", content: req.user },
    ],
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let id: string | null = null;
  let usage: Usage | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      // Lines starting with ":" are OpenRouter keep-alive comments.
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(`OpenRouter stream error: ${chunk.error.message ?? "unknown"}`);
      if (!id && chunk.id) {
        id = chunk.id;
        yield { type: "id", openrouterId: id };
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield { type: "text", delta };
      if (chunk.usage) usage = parseUsage(chunk.usage);
    }
  }
  if (!usage) throw new Error("OpenRouter stream ended without a usage block");
  yield { type: "done", openrouterId: id, usage };
}

/**
 * Best-effort cache warm-up: a minimal call whose only purpose is to write the SOP+example prefix
 * into cache before the deck's first real call needs it, so that first real call reads a warm
 * cache instead of paying to write one on the critical path. Never throws — if OpenRouter rejects
 * `max_tokens: 1` or anything else about this call, the real pipeline must not be affected; it
 * just runs its own cache write on the first real call, exactly as before this existed.
 */
export async function prewarmCache(system: SystemBlock[]): Promise<void> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: llmModel(),
        stream: false,
        max_tokens: 1,
        messages: [
          {
            role: "system",
            content: system.map((b) => ({
              type: "text",
              text: b.text,
              ...(b.cache ? { cache_control: { type: "ephemeral", ttl: "1h" } } : {}),
            })),
          },
          { role: "user", content: "ok" },
        ],
      }),
    });
    if (!res.ok) console.warn("cache prewarm failed (non-fatal)", res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.warn("cache prewarm failed (non-fatal)", err);
  }
}

/** Non-streaming convenience wrapper: collects the whole response. */
export async function chat(req: ChatRequest): Promise<{ text: string; openrouterId: string | null; usage: Usage }> {
  let text = "";
  for await (const ev of streamChat(req)) {
    if (ev.type === "text") text += ev.delta;
    else if (ev.type === "done") return { text, openrouterId: ev.openrouterId, usage: ev.usage };
  }
  throw new Error("Stream ended without a done event");
}

/** Settled cost for a finished generation. Can 404 for a few seconds after the call. */
export async function fetchGeneration(id: string): Promise<Usage | null> {
  const res = await fetch(`${GENERATION_ENDPOINT}?id=${encodeURIComponent(id)}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenRouter generation lookup ${res.status}`);
  const { data } = await res.json();
  return {
    inputTokens: data.native_tokens_prompt ?? data.tokens_prompt ?? 0,
    outputTokens: data.native_tokens_completion ?? data.tokens_completion ?? 0,
    cachedTokens: data.native_tokens_cached ?? 0,
    cacheWriteTokens: 0,
    costUsd: trueCost(Number(data.total_cost ?? 0), data.is_byok, Number(data.upstream_inference_cost ?? 0)),
  };
}
