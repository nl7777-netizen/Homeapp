import { useRef, useState } from 'react';
import { Download, Save, Trash2, Upload } from 'lucide-react';
import { encodeSyncCode, exportJson, importJson } from '../../services/persistence';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Badge, Button, Card, Field, TextField } from '../ui';

export function SavedScenariosTab() {
  const state = usePlannerStore((s) => s.state);
  const saveScenario = usePlannerStore((s) => s.saveScenario);
  const loadScenario = usePlannerStore((s) => s.loadScenario);
  const deleteScenario = usePlannerStore((s) => s.deleteScenario);
  const importJsonText = usePlannerStore((s) => s.importJsonText);
  const applySyncCode = usePlannerStore((s) => s.applySyncCode);
  const resetToDefaults = usePlannerStore((s) => s.resetToDefaults);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeOut, setCodeOut] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsw-planner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImportFile = async (file: File) => {
    try {
      importJsonText(await file.text());
      setMsg('JSON scenario imported and applied.');
    } catch {
      setMsg('Could not parse that JSON file.');
    }
  };

  const doApplyCode = () => {
    try {
      const err = applySyncCode(code);
      if (err) setMsg(err);
      else setMsg('Sync code applied — your inputs were replaced.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Invalid sync code.');
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Saved Scenarios" subtitle="Full snapshots of every input, stored locally in your browser">
        <div className="mb-3 flex gap-2">
          <TextField value={name} onChange={setName} placeholder="Name this scenario (e.g. 'Rentvest 24mo')…" />
          <Button onClick={() => { saveScenario(name); setName(''); }}>
            <Save size={14} /> Save
          </Button>
        </div>
        {state.savedScenarios.length === 0 && (
          <p className="text-xs text-zinc-400">No saved scenarios yet.</p>
        )}
        <ul className="space-y-2">
          {state.savedScenarios.map((sc) => (
            <li key={sc.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{sc.name}</div>
                <div className="text-[11px] text-zinc-400">
                  {new Date(sc.savedAt).toLocaleString('en-AU')} · price {`$${(sc.state.targetPurchasePrice / 1000).toFixed(0)}k`} ·{' '}
                  {sc.state.suburb}
                </div>
              </div>
              <Button variant="secondary" onClick={() => loadScenario(sc.id)} className="!px-2 !py-1 text-xs">
                Load
              </Button>
              <Button variant="ghost" onClick={() => deleteScenario(sc.id)} className="!px-2">
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card title="JSON Export / Import" subtitle="Move your full plan between devices">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doExport}>
              <Download size={14} /> Export JSON
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImportFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </Card>

        <Card title="Wireless Sync Code" subtitle="Compact lz-string code (version header + checksum) — paste it into any browser">
          <div className="space-y-3">
            <div>
              <Button variant="secondary" onClick={() => setCodeOut(encodeSyncCode(state))}>
                Generate sync code
              </Button>
              {codeOut && (
                <div className="thin-scroll mt-2 max-h-24 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[11px] break-all dark:border-zinc-800 dark:bg-zinc-950">
                  {codeOut}
                </div>
              )}
            </div>
            <Field label="Paste a sync code to load">
              <div className="flex gap-2">
                <TextField value={code} onChange={setCode} placeholder="NSWPP1.…" />
                <Button onClick={doApplyCode}>Apply</Button>
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Danger Zone">
          <Button variant="danger" onClick={() => { if (confirm('Reset ALL inputs to defaults? Saved scenarios are kept.')) resetToDefaults(); }}>
            Reset to defaults
          </Button>
        </Card>

        {msg && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <Badge tone="neutral">{msg}</Badge>
          </div>
        )}
      </div>
    </div>
  );
}
