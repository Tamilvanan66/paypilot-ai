import { env, aiConfigured } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export const aiEnabled = aiConfigured;

/** Low-level call to any OpenAI-compatible /chat/completions endpoint. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: CompletionOptions = {},
): Promise<string> {
  if (!aiConfigured()) throw ApiError.upstream('AI provider is not configured', { code: 'ai_not_configured' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${env.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.ai.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 700,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw ApiError.upstream(`AI provider error (${res.status})`, text.slice(0, 300));
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw ApiError.upstream('AI provider returned an empty response');
    return content;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') throw ApiError.upstream('AI provider timed out');
    throw ApiError.upstream('AI provider request failed', (err as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}

/** Parse JSON defensively from a model response that may include prose/fences. */
export function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface CatalogueEntry {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  category: string;
  shortDescription: string;
}

export function buildCatalogueBlock(entries: CatalogueEntry[], currency: string) {
  if (!entries.length) return 'CATALOGUE: (no active products)';
  const lines = entries.map(
    (p) =>
      `- id=${p.id} | ${p.name} | ${currency} ${p.price.toFixed(2)} | stock=${p.stock} | category=${p.category || 'uncategorised'} | ${p.shortDescription || 'no description'}`,
  );
  return `CATALOGUE (the ONLY products that exist — never mention anything else):\n${lines.join('\n')}`;
}

export const SAFETY_RULES = `HARD RULES:
1. Only use facts from the CATALOGUE block for names, prices, stock and features. If a product is not listed, say you do not carry it.
2. Never invent prices, discounts, stock counts or delivery promises.
3. Never state that a payment has been taken, completed, refunded or is pending. You cannot see payment records. Direct the customer to the checkout page or support.
4. Never ask for card numbers, CVV, bank credentials, PayPal passwords or one-time codes. If a customer offers them, refuse and tell them to use the secure checkout.
5. You cannot modify the store, orders, prices or stock. Never claim you did. Any such change requires the owner to confirm it in the dashboard.
6. Be concise (max ~120 words), friendly and specific. Recommend at most 3 products, by name.`;

/* ----------------------------- deterministic fallbacks ----------------------------- */

const stopwords = new Set([
  'the','a','an','and','or','for','to','of','in','on','with','is','are','i','we','you','my','me',
  'need','want','looking','some','please','can','could','have','has','do','does','it','that','this',
  'best','good','cheap','under','below','less','than','around','about','budget','recommend','suggest',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

export function extractBudget(text: string): number | null {
  const m = text.match(/(?:under|below|less than|max|up to|budget of|around)\s*\$?\s*(\d+(?:\.\d+)?)/i)
    ?? text.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function fallbackChatReply(input: {
  message: string;
  storeName: string;
  currency: string;
  products: { name: string; price: number; stock: number; shortDescription: string }[];
}): string {
  const { message, storeName, currency, products } = input;
  const tokens = tokenize(message);
  const budget = extractBudget(message);

  const scored = products
    .map((p) => {
      const hay = `${p.name} ${p.shortDescription}`.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  const withinBudget = budget === null ? scored : scored.filter((s) => s.p.price <= budget);
  const picks = (withinBudget.length ? withinBudget : scored)
    .filter((s) => s.p.stock > 0)
    .slice(0, 3)
    .map((s) => s.p);

  if (!picks.length) {
    return `Thanks for reaching out to ${storeName}. I couldn't find a matching in-stock product right now — you can browse the full catalogue, or tell me your budget and what you need it for and I'll try again.`;
  }

  const list = picks
    .map(
      (p) =>
        `• ${p.name} — ${currency} ${p.price.toFixed(2)} (${p.stock} in stock)${
          p.shortDescription ? `: ${p.shortDescription}` : ''
        }`,
    )
    .join('\n');

  return `Here's what I found at ${storeName}${
    budget !== null ? ` under ${currency} ${budget.toFixed(2)}` : ''
  }:\n${list}\n\nAll prices and stock levels are live from the store catalogue. Want details on any of these?`;
}

export function fallbackDescription(input: {
  name: string;
  category?: string;
  specs?: string;
  tone?: string;
}): { description: string; shortDescription: string; seoTitle: string; keywords: string[] } {
  const { name, category, specs } = input;
  const specList = (specs ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bullets = specList.length
    ? specList.map((s) => `• ${s}`).join('\n')
    : `• ${name} built for everyday use\n• Reliable build quality`;

  const description = `${name} is a ${category ? `${category.toLowerCase()} ` : ''}product designed for people who want dependable performance without overpaying.\n\nKey features\n${bullets}\n\nWhy customers choose it\nIt does the job it promises, arrives ready to use, and is backed by our support team. If you have questions before ordering, message us — we answer with real stock and pricing information.`;

  const words = tokenize(`${name} ${category ?? ''} ${specList.join(' ')}`).slice(0, 8);
  return {
    description,
    shortDescription: `${name}${category ? ` — ${category}` : ''}. Dependable quality, ready to use.`,
    seoTitle: `${name}${category ? ` | ${category}` : ''} — Buy Online`,
    keywords: Array.from(new Set([name.toLowerCase(), ...words])).slice(0, 10),
  };
}
