import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Store } from '../models/Store.js';
import { Conversation, Message } from '../models/Conversation.js';
import {
  aiEnabled,
  buildCatalogueBlock,
  chatCompletion,
  fallbackChatReply,
  fallbackDescription,
  parseJsonLoose,
  SAFETY_RULES,
  type CatalogueEntry,
} from '../services/ai.js';
import { recommend } from '../services/recommendations.js';
import { overview, revenueSeries, productPerformance, salesByCategory, inventoryInsights } from '../services/analytics.js';
import { ApiError } from '../utils/errors.js';

const storeIdOf = (req: Request) => new Types.ObjectId(String(req.user!.storeId));

async function catalogueFor(storeId: Types.ObjectId) {
  const [products, categories] = await Promise.all([
    Product.find({ storeId, status: 'active' }).limit(200).lean(),
    Category.find({ storeId }).lean(),
  ]);
  const catMap = new Map(categories.map((c) => [String(c._id), c.name]));
  const entries: CatalogueEntry[] = products.map((p) => ({
    id: String(p._id),
    name: p.name,
    price: p.price,
    currency: p.currency,
    stock: p.stock,
    category: p.categoryId ? (catMap.get(String(p.categoryId)) ?? '') : '',
    shortDescription: p.shortDescription || (p.description ?? '').slice(0, 120),
  }));
  return { entries, products, catMap };
}

export async function chat(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { message, conversationId, customerEmail, language } = req.body as {
    message: string;
    conversationId?: string | null;
    customerEmail?: string;
    language?: string;
  };

  const store = await Store.findById(storeId).lean();
  if (!store) throw ApiError.notFound('Store not found');

  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, storeId })
    : null;
  if (!conversation) {
    conversation = await Conversation.create({
      storeId,
      channel: 'dashboard',
      customerEmail: customerEmail ?? '',
      title: message.slice(0, 60),
      language: language ?? 'en',
    });
  }

  await Message.create({ storeId, conversationId: conversation._id, role: 'user', content: message, source: 'system' });

  const history = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  history.reverse();

  const { entries, products, catMap } = await catalogueFor(storeId);
  const currency = entries[0]?.currency ?? store.currency ?? 'USD';

  let reply: string;
  let source: 'ai' | 'fallback' = 'ai';
  let recommended: Record<string, unknown>[] = [];

  if (aiEnabled()) {
    try {
      const messages = [
        {
          role: 'system' as const,
          content: `You are the AI shopping assistant for "${store.name}". ${store.aiPersona}\nReply in the customer's language (detected: ${language ?? 'en'}).\n\n${buildCatalogueBlock(entries, currency)}\n\n${SAFETY_RULES}`,
        },
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      reply = await chatCompletion(messages, { temperature: 0.4, maxTokens: 500 });
    } catch {
      source = 'fallback';
      reply = fallbackChatReply({
        message,
        storeName: store.name,
        currency,
        products: products.map((p) => ({
          name: p.name,
          price: p.price,
          stock: p.stock,
          shortDescription: p.shortDescription ?? '',
        })),
      });
    }
    // Attach grounded recommendations (validated against the real catalogue).
    try {
      const rec = await recommend({ storeId, query: message, limit: 3 });
      recommended = rec.items as unknown as Record<string, unknown>[];
    } catch {
      recommended = [];
    }
  } else {
    source = 'fallback';
    reply = fallbackChatReply({
      message,
      storeName: store.name,
      currency,
      products: products.map((p) => ({
        name: p.name,
        price: p.price,
        stock: p.stock,
        shortDescription: p.shortDescription ?? '',
      })),
    });
    const rec = await recommend({ storeId, query: message, limit: 3 });
    recommended = rec.items as unknown as Record<string, unknown>[];
  }

  const assistantMessage = await Message.create({
    storeId,
    conversationId: conversation._id,
    role: 'assistant',
    content: reply,
    source,
    products: recommended,
  });

  conversation.messageCount += 2;
  conversation.lastMessageAt = new Date();
  if (conversation.title === 'New conversation') conversation.title = message.slice(0, 60);
  await conversation.save();

  res.json({
    success: true,
    data: {
      conversationId: String(conversation._id),
      reply,
      source,
      aiEnabled: aiEnabled(),
      messageId: String(assistantMessage._id),
      recommendations: recommended,
      productsCount: products.length,
      categoriesCount: catMap.size,
    },
  });
}

export async function listConversations(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const items = await Conversation.find({ storeId }).sort({ lastMessageAt: -1 }).limit(30).lean();
  res.json({ success: true, data: items });
}

export async function getConversation(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const conversation = await Conversation.findOne({ _id: req.params.id, storeId }).lean();
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, data: { conversation, messages } });
}

export async function recommendations(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { query, limit, budget, category } = req.body as {
    query: string;
    limit?: number;
    budget?: number | null;
    category?: string;
  };
  const result = await recommend({ storeId, query, limit, budget, category });
  res.json({
    success: true,
    data: {
      ...result,
      engine: result.source === 'ai' ? 'ai+grounded-catalogue' : 'rules (deterministic)',
    },
  });
}

export async function generateDescription(req: Request, res: Response) {
  const { name, category, specs, tone } = req.body as {
    name: string;
    category?: string;
    specs?: string;
    tone?: string;
  };

  const fallback = fallbackDescription({ name, category, specs, tone });

  if (!aiEnabled()) {
    return res.json({ success: true, data: { ...fallback, source: 'template', aiEnabled: false } });
  }

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You write e-commerce product copy. Return STRICT JSON with keys: description (string, 80-160 words, plain text with line breaks), shortDescription (max 160 chars), seoTitle (max 60 chars), keywords (array of 5-10 lowercase strings). Never invent certifications, warranties, or measurements that were not supplied.',
        },
        {
          role: 'user',
          content: `Product: ${name}\nCategory: ${category ?? 'unspecified'}\nTone: ${tone ?? 'professional'}\nSupplied specifications:\n${specs || '(none supplied)'}`,
        },
      ],
      { temperature: 0.6, maxTokens: 700, json: true },
    );

    const parsed = parseJsonLoose<{
      description?: string;
      shortDescription?: string;
      seoTitle?: string;
      keywords?: string[];
    }>(raw);

    if (!parsed?.description) throw new Error('unparseable');

    return res.json({
      success: true,
      data: {
        description: parsed.description,
        shortDescription: parsed.shortDescription ?? fallback.shortDescription,
        seoTitle: parsed.seoTitle ?? fallback.seoTitle,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 12) : fallback.keywords,
        source: 'ai',
        aiEnabled: true,
      },
    });
  } catch {
    return res.json({
      success: true,
      data: {
        ...fallback,
        source: 'template',
        aiEnabled: true,
        warning: 'AI provider failed, template copy returned instead.',
      },
    });
  }
}

export async function businessInsights(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const [ov, revenue, perf, cats, inv] = await Promise.all([
    overview(storeId),
    revenueSeries(storeId, 30),
    productPerformance(storeId, 5),
    salesByCategory(storeId),
    inventoryInsights(storeId),
  ]);

  const metrics = { overview: ov, revenue30: revenue, topProducts: perf, categories: cats, inventory: inv };

  const facts = [
    `Net revenue: ${ov.revenue.net} ${ 'USD'} (gross ${ov.revenue.gross}, refunds ${ov.revenue.refunds})`,
    `Orders: total ${ov.orders.total}, pending ${ov.orders.pending}, completed ${ov.orders.completed}, pending payments ${ov.orders.pendingPayments} (${ov.orders.pendingPaymentValue})`,
    `Average order value: ${ov.orders.averageOrderValue}`,
    `Products: ${ov.products.total}, low stock ${ov.products.lowStock}, out of stock ${ov.products.outOfStock}, inventory value ${ov.products.inventoryValue}`,
    `Top seller: ${perf[0] ? `${perf[0].name} (${perf[0].unitsSold} units, ${perf[0].revenue})` : 'no paid sales yet'}`,
    `Top category: ${cats[0] ? `${cats[0].category} (${cats[0].revenue})` : 'none'}`,
    `Days with revenue in last 30: ${revenue.filter((r) => r.revenue > 0).length}/30`,
  ];

  const deterministic = {
    headline: perf.length
      ? `${perf[0].name} leads sales; ${ov.products.lowStock} product(s) need restocking.`
      : 'No paid orders yet — the analytics will populate as soon as the first payment clears.',
    observations: facts,
    actions: [
      ov.products.lowStock + ov.products.outOfStock > 0
        ? `Restock ${ov.products.lowStock + ov.products.outOfStock} low/out-of-stock product(s) to avoid lost sales.`
        : 'Stock levels are healthy across active products.',
      ov.orders.pendingPayments > 0
        ? `Follow up on ${ov.orders.pendingPayments} unpaid order(s) worth ${ov.orders.pendingPaymentValue}.`
        : 'No outstanding unpaid orders.',
      perf.length ? `Feature ${perf[0].name} in your next promotion.` : 'Add products and share your store link to get the first order.',
    ],
  };

  if (!aiEnabled()) {
    return res.json({
      success: true,
      data: { ...deterministic, source: 'deterministic', aiEnabled: false, metrics, generatedAt: new Date().toISOString() },
    });
  }

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You are a retail business analyst. You are given REAL computed metrics. Summarise only what the numbers support; never invent figures, forecasts or comparisons that are not derivable. Historical data only — if you speculate, prefix with "Possible:". Return STRICT JSON: {"headline": string (max 120 chars), "observations": string[] (3-5 items, each citing a number from the input), "actions": string[] (2-4 concrete actions)}.',
        },
        { role: 'user', content: `METRICS:\n${facts.join('\n')}\n\nJSON only.` },
      ],
      { temperature: 0.3, maxTokens: 600, json: true },
    );
    const parsed = parseJsonLoose<{ headline?: string; observations?: string[]; actions?: string[] }>(raw);
    if (!parsed?.headline) throw new Error('unparseable');
    return res.json({
      success: true,
      data: {
        headline: parsed.headline,
        observations: parsed.observations?.slice(0, 6) ?? deterministic.observations,
        actions: parsed.actions?.slice(0, 5) ?? deterministic.actions,
        source: 'ai',
        aiEnabled: true,
        metrics,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return res.json({
      success: true,
      data: {
        ...deterministic,
        source: 'deterministic',
        aiEnabled: true,
        warning: 'AI provider unavailable — deterministic summary shown.',
        metrics,
        generatedAt: new Date().toISOString(),
      },
    });
  }
}

export async function aiStatus(_req: Request, res: Response) {
  res.json({ success: true, data: { configured: aiEnabled() } });
}
