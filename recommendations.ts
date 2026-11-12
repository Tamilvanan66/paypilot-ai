import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import {
  aiEnabled,
  buildCatalogueBlock,
  chatCompletion,
  extractBudget,
  parseJsonLoose,
  tokenize,
  type CatalogueEntry,
} from './ai.js';

export interface Recommendation {
  productId: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  stock: number;
  available: boolean;
  imageUrl: string;
  shortDescription: string;
  reason: string;
  score: number;
}

interface ScoredCandidate {
  product: Record<string, unknown> & {
    _id: mongoose.Types.ObjectId;
    name: string;
    price: number;
    stock: number;
    currency: string;
    shortDescription?: string;
    imageUrl?: string;
    tags?: string[];
    salesCount?: number;
  };
  score: number;
  categoryName: string;
}

function scoreCandidates(
  products: ScoredCandidate['product'][],
  categoryMap: Map<string, string>,
  query: string,
  budget: number | null,
  categoryFilter?: string,
): ScoredCandidate[] {
  const tokens = tokenize(query);
  return products
    .map((p) => {
      const categoryName = p.categoryId ? (categoryMap.get(String(p.categoryId)) ?? '') : '';
      if (budget !== null && p.price > budget) return { product: p, score: -1, categoryName };
      if (categoryFilter && categoryName.toLowerCase() !== categoryFilter.toLowerCase()) {
        return { product: p, score: -1, categoryName };
      }
      const hay = `${p.name} ${p.shortDescription ?? ''} ${(p.tags ?? []).join(' ')} ${categoryName}`.toLowerCase();
      let score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 2 : 0), 0);
      if (tokens.some((t) => p.name.toLowerCase().includes(t))) score += 3;
      if (p.stock > 0) score += 1;
      score += Math.min(2, (p.salesCount ?? 0) * 0.1);
      if (budget !== null) score += Math.max(0, 2 - Math.abs(budget - p.price) / Math.max(budget, 1));
      return { product: p, score, categoryName };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || b.product.price - a.product.price);
}

function deterministicReason(s: ScoredCandidate, query: string, budget: number | null) {
  const bits: string[] = [];
  const tokens = tokenize(query);
  const matched = tokens.filter(
    (t) =>
      s.product.name.toLowerCase().includes(t) ||
      (s.product.shortDescription ?? '').toLowerCase().includes(t),
  );
  if (matched.length) bits.push(`matches “${matched.slice(0, 2).join(', ')}”`);
  if (s.categoryName) bits.push(`in ${s.categoryName}`);
  if (budget !== null) bits.push(`within your ${budget.toFixed(2)} budget`);
  bits.push(s.product.stock > 0 ? `${s.product.stock} in stock` : 'currently out of stock');
  return `Recommended because it ${bits.join(', ')}.`;
}

/**
 * Recommendation engine: candidate generation + deterministic scoring, optionally
 * re-ranked by the configured AI provider. AI output is always validated against
 * the real candidate set — ids that don't exist are discarded.
 */
export async function recommend(input: {
  storeId: mongoose.Types.ObjectId;
  query: string;
  limit?: number;
  budget?: number | null;
  category?: string;
}): Promise<{ items: Recommendation[]; source: 'ai' | 'rules'; appliedBudget: number | null }> {
  const limit = Math.min(6, Math.max(1, input.limit ?? 3));
  const budget = input.budget ?? extractBudget(input.query);
  const categoryFilter = input.category;

  const [products, categories] = await Promise.all([
    Product.find({ storeId: input.storeId, status: 'active' }).limit(300).lean(),
    Category.find({ storeId: input.storeId }).lean(),
  ]);

  const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));
  const ranked = scoreCandidates(products as ScoredCandidate['product'][], categoryMap, input.query, budget, categoryFilter);
  if (!ranked.length) return { items: [], source: 'rules', appliedBudget: budget };

  const candidates = ranked.slice(0, 12);

  let items: Recommendation[] = candidates.map((s) => ({
    productId: String(s.product._id),
    name: s.product.name,
    price: s.product.price,
    currency: s.product.currency,
    category: s.categoryName,
    stock: s.product.stock,
    available: s.product.stock > 0,
    imageUrl: s.product.imageUrl ?? '',
    shortDescription: s.product.shortDescription ?? '',
    reason: deterministicReason(s, input.query, budget),
    score: Number(s.score.toFixed(2)),
  }));

  if (!aiEnabled()) return { items: items.slice(0, limit), source: 'rules', appliedBudget: budget };

  const entries: CatalogueEntry[] = candidates.map((s) => ({
    id: String(s.product._id),
    name: s.product.name,
    price: s.product.price,
    currency: s.product.currency,
    stock: s.product.stock,
    category: s.categoryName,
    shortDescription: s.product.shortDescription ?? '',
  }));

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You rank products for a shopper. Return STRICT JSON: {"items":[{"id":"<catalogue id>","reason":"<max 18 words, factual>"}]}. Only use ids from the CATALOGUE. Never invent products, prices or stock.',
        },
        {
          role: 'user',
          content: `${buildCatalogueBlock(entries, entries[0]?.currency ?? 'USD')}\n\nSHOPPER REQUEST: ${input.query}\n${budget !== null ? `BUDGET: max ${budget}` : ''}\nPick up to ${limit} best matches, prefer in-stock items.`,
        },
      ],
      { temperature: 0.2, maxTokens: 400, json: true },
    );

    const parsed = parseJsonLoose<{ items?: { id: string; reason: string }[] }>(raw);
    const byId = new Map(candidates.map((s) => [String(s.product._id), s]));
    const aiItems: Recommendation[] = [];
    for (const pick of parsed?.items ?? []) {
      const candidate = byId.get(String(pick.id));
      if (!candidate) continue; // hallucinated id -> discard
      const base = items.find((i) => i.productId === String(pick.id))!;
      aiItems.push({
        ...base,
        reason: String(pick.reason ?? base.reason).slice(0, 200),
      });
    }
    if (!aiItems.length) return { items: items.slice(0, limit), source: 'rules', appliedBudget: budget };
    return { items: aiItems.slice(0, limit), source: 'ai', appliedBudget: budget };
  } catch {
    return { items: items.slice(0, limit), source: 'rules', appliedBudget: budget };
  }
}
