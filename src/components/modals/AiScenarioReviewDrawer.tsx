import { useEffect, useRef, useState } from 'react';
import { Send, Square, X } from 'lucide-react';
import { QUICK_PROMPTS, createScenarioReview } from '../../services/aiWorkflows';
import { usePlannerOutput } from '../../hooks/usePlannerOutput';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Button } from '../ui';

/** Right-hand drawer: private, streaming AI review of the deterministic plan. */
export function AiScenarioReviewDrawer({ onClose }: { onClose: () => void }) {
  const out = usePlannerOutput();
  const ai = usePlannerStore((s) => s.state.ai);
  const lifeEvents = usePlannerStore((s) => s.state.lifeEvents);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [answer]);

  const run = async (q: string) => {
    if (!q.trim() || busy) return;
    if (!ai.selectedModel) {
      setError('No model selected — open Local AI settings and connect LM Studio.');
      return;
    }
    setBusy(true);
    setError(null);
    setAnswer('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const review = createScenarioReview(ai.lmStudioBaseUrl, ai.selectedModel, out, lifeEvents);
      await review.run(q, (t) => setAnswer((a) => a + t), ctrl.signal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">Private AI Scenario Review</h2>
            <p className="text-[11px] text-zinc-400">
              Streams from your local LM Studio ({ai.selectedModel || 'no model selected'}) — nothing leaves your machine
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => void run(p)}
              disabled={busy}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {p}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-4 py-3">
          {answer ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{answer}</div>
          ) : (
            !busy && (
              <p className="text-xs text-zinc-400">
                Ask a question about your plan. The model receives a compact, self-contained summary of your household tax,
                Phase 1 scenarios, Phase 2 purchase, mortgage and viability outputs.
              </p>
            )
          )}
          {error && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        </div>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Ask about your scenario…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run(question);
              }}
            />
            {busy ? (
              <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                <Square size={14} /> Stop
              </Button>
            ) : (
              <Button onClick={() => void run(question)}>
                <Send size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
