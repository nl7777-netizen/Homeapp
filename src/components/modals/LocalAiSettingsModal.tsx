import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { listModels } from '../../services/lmStudioClient';
import { usePlannerStore } from '../../store/usePlannerStore';
import type { SearchProvider } from '../../types/planner';
import { Badge, Button, Field, Modal, SelectField, TextField } from '../ui';

export function LocalAiSettingsModal({ onClose }: { onClose: () => void }) {
  const ai = usePlannerStore((s) => s.state.ai);
  const setAi = usePlannerStore((s) => s.setAi);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const m = await listModels(ai.lmStudioBaseUrl);
      setModels(m.map((x) => x.id));
      setStatus(`Connected — ${m.length} model(s) available. All inference stays on your machine.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Local AI Settings (LM Studio)" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Field label="LM Studio base URL" hint="LM Studio → Developer → Start Server (enable CORS in server settings)">
            <div className="flex gap-2">
              <TextField value={ai.lmStudioBaseUrl} onChange={(s) => setAi({ lmStudioBaseUrl: s })} />
              <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>
                <RefreshCw size={14} /> {busy ? '…' : 'Test'}
              </Button>
            </div>
          </Field>
          {status && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {status}{' '}
              {models.length > 0 && <Badge tone="good">{models.length} models</Badge>}
            </p>
          )}
        </div>

        <Field label="Model" hint={models.length === 0 ? 'Fetch models first, or type the model id exactly as LM Studio lists it.' : undefined}>
          {models.length > 0 ? (
            <SelectField
              value={ai.selectedModel && models.includes(ai.selectedModel) ? ai.selectedModel : models[0]}
              onChange={(m) => setAi({ selectedModel: m })}
              options={models.map((m) => ({ value: m, label: m }))}
            />
          ) : (
            <TextField value={ai.selectedModel} onChange={(s) => setAi({ selectedModel: s })} placeholder="e.g. qwen2.5-14b-instruct" />
          )}
        </Field>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h4 className="mb-2 text-sm font-semibold">Optional Web Search (suburb data &amp; tax updates)</h4>
          <div className="space-y-3">
            <Field label="Search provider" hint="Off by default — everything works from the local suburb database.">
              <SelectField
                value={ai.searchProvider}
                onChange={(v: SearchProvider) => setAi({ searchProvider: v })}
                options={[
                  { value: 'none', label: 'None (offline local DB only)' },
                  { value: 'local-proxy', label: 'Local proxy (scripts/local-search-proxy.mjs)' },
                  { value: 'serper', label: 'Serper.dev (direct, key stored locally)' },
                ]}
              />
            </Field>
            {ai.searchProvider === 'local-proxy' && (
              <Field label="Local proxy URL" hint="Run: node scripts/local-search-proxy.mjs (port 8787)">
                <TextField value={ai.localProxyUrl} onChange={(s) => setAi({ localProxyUrl: s })} />
              </Field>
            )}
            {ai.searchProvider === 'serper' && (
              <Field label="Serper API key" hint="Stored only in this browser's localStorage.">
                <TextField value={ai.serperApiKey} onChange={(s) => setAi({ serperApiKey: s })} type="password" />
              </Field>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
