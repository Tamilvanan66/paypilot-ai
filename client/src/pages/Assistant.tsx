import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, RefreshCw, Send, Sparkles, Wand2 } from 'lucide-react';
import { aiApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { currency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, Recommendation } from '../types';

const SUGGESTIONS = [
  'What do you have under $50?',
  'Recommend a gift for someone who likes coffee',
  'Do you have anything in stock right now?',
  'Which product is best for daily use?',
];

export default function Assistant() {
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [gen, setGen] = useState({ name: '', category: '', specs: '', tone: 'professional' });
  const [generated, setGenerated] = useState<{
    description: string;
    shortDescription: string;
    seoTitle: string;
    keywords: string[];
    source: string;
  } | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  useEffect(() => {
    void aiApi.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await aiApi.chat({ message, conversationId });
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          source: res.source,
          recommendations: res.recommendations,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Assistant request failed.');
      setMessages((m) => [
        ...m,
        { id: `e-${Date.now()}`, role: 'assistant', content: 'I could not reach the assistant service. Please try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!gen.name.trim()) return toast.error('Enter a product name first.');
    setGenBusy(true);
    try {
      const res = await aiApi.describe({
        name: gen.name.trim(),
        category: gen.category || undefined,
        specs: gen.specs.trim() || undefined,
        tone: gen.tone,
      });
      setGenerated(res);
      toast.success(res.source === 'ai' ? 'Generated with the AI model.' : 'Generated with the deterministic template.');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Generation failed.');
    } finally {
      setGenBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Assistant"
        subtitle="Grounded in your live catalogue — stock, prices and categories come from the database."
        actions={
          <>
            <Badge tone={status?.configured ? 'green' : 'amber'}>
              {status?.configured ? 'AI model connected' : 'Rules engine (no API key)'}
            </Badge>
            <Button variant="secondary" className="text-xs" onClick={reset}>
              <RefreshCw className="h-3.5 w-3.5" /> New conversation
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="flex h-[600px] flex-col p-0 xl:col-span-3">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Customer assistant</p>
              <p className="truncate text-[11px] text-muted">
                {conversationId ? `Conversation ${conversationId.slice(-6)} · context retained` : 'New conversation'}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-line bg-surface p-3.5 text-xs leading-relaxed text-muted">
                  Ask about products, prices, stock or recommendations. The assistant only uses real
                  catalogue records and never claims a payment succeeded.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="chip border-line bg-white/5 text-muted transition hover:border-accent/40 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent text-[#062B27]'
                      : 'border border-line bg-surface text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === 'assistant' && m.source && (
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide opacity-60">
                      {m.source === 'ai' ? 'AI model · grounded' : 'rules engine'}
                    </p>
                  )}
                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {m.recommendations.map((r) => (
                        <RecommendationCard key={r.productId} rec={r} cur={cur} compact />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
                  <Spinner label="Thinking…" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product, budget or availability…"
              aria-label="Message the assistant"
              disabled={busy}
            />
            <Button type="submit" loading={busy} className="shrink-0 px-3.5">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-accent2" />
              <div>
                <h2 className="text-sm font-semibold text-ink">Product description generator</h2>
                <p className="text-[11px] text-muted">Review and edit before saving to a product.</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <Field label="Product name" htmlFor="gen-name">
                <Input id="gen-name" value={gen.name} onChange={(e) => setGen({ ...gen, name: e.target.value })} placeholder="Ceramic Pour-Over Set" />
              </Field>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Category" htmlFor="gen-cat">
                  <Input id="gen-cat" value={gen.category} onChange={(e) => setGen({ ...gen, category: e.target.value })} placeholder="Home" />
                </Field>
                <Field label="Tone" htmlFor="gen-tone">
                  <Select id="gen-tone" value={gen.tone} onChange={(e) => setGen({ ...gen, tone: e.target.value })}>
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="luxury">Luxury</option>
                    <option value="technical">Technical</option>
                  </Select>
                </Field>
              </div>
              <Field label="Specifications" htmlFor="gen-specs" hint="Materials, size, care, differentiators">
                <Textarea id="gen-specs" value={gen.specs} onChange={(e) => setGen({ ...gen, specs: e.target.value })} placeholder="Stoneware ceramic, 600ml, dishwasher safe, matte glaze" />
              </Field>
              <Button className="w-full" loading={genBusy} onClick={() => void generate()}>
                <Sparkles className="h-4 w-4" /> Generate draft
              </Button>
            </div>

            {generated && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Draft</p>
                  <Badge tone={generated.source === 'ai' ? 'green' : 'amber'}>{generated.source}</Badge>
                </div>
                <p className="text-sm font-semibold text-ink">{generated.seoTitle}</p>
                <p className="text-xs text-muted">{generated.shortDescription}</p>
                <p className="text-xs leading-relaxed text-ink">{generated.description}</p>
                <div className="flex flex-wrap gap-1">
                  {generated.keywords.map((k) => (
                    <span key={k} className="chip border-line bg-white/5 text-[10px] text-muted">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Safety rules enforced</h2>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Prices and stock are read from your catalogue, never invented.</li>
              <li>• The assistant never claims a payment succeeded without a verified capture.</li>
              <li>• Payment credentials are refused; no card numbers are ever requested.</li>
              <li>• Recommendations are validated against real, active product IDs.</li>
              <li>• No store changes are executed by the model — you confirm every action.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, cur, compact = false }: { rec: Recommendation; cur: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-line bg-card/70 p-2 ${compact ? '' : 'p-3'}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface">
        {rec.imageUrl ? (
          <img src={rec.imageUrl} alt={rec.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Sparkles className="h-4 w-4 text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-ink">{rec.name}</p>
          <span className="shrink-0 text-xs font-bold text-accent">{currency(rec.price, rec.currency || cur)}</span>
        </div>
        <p className="truncate text-[10px] text-muted">
          {rec.category} · {rec.available ? `${rec.stock} in stock` : 'Out of stock'}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">{rec.reason}</p>
      </div>
    </div>
  );
}
