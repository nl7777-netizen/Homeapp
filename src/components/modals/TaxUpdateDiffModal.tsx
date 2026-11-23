import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { TAX_TABLES, type FinancialYear, type YearTaxTable } from '../../data/taxTables';
import { taxUpdateCheck, type TaxUpdateProposal } from '../../services/aiWorkflows';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Badge, Button, Card, Field, Modal, SelectField } from '../ui';

/**
 * Safe AI Tax & Duty Update Checker: fetches latest ATO figures via the
 * configured search + LM Studio, diffs them against the built-in tables,
 * and applies ONLY on explicit user confirmation (stored as a custom FY
 * table that the tax engine can use immediately).
 */
export function TaxUpdateDiffModal({ onClose }: { onClose: () => void }) {
  const ai = usePlannerStore((s) => s.state.ai);
  const saveCustomTaxTable = usePlannerStore((s) => s.saveCustomTaxTable);
  const [fy, setFy] = useState<FinancialYear>('2027-28');
  const [proposal, setProposal] = useState<TaxUpdateProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const p = await taxUpdateCheck(fy, ai);
      setProposal(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!proposal) return;
    const builtIn = TAX_TABLES[fy];
    const custom: YearTaxTable = {
      ...builtIn,
      fy,
      brackets: proposal.brackets.map((b) => ({ ...b, to: b.to < 0 ? Infinity : b.to })),
      medicare: { ...builtIn.medicare, rate: proposal.medicareLevyRate ?? builtIn.medicare.rate },
    };
    const label = `${fy} (AI updated)`;
    saveCustomTaxTable(label, JSON.stringify(custom));
    setApplied(label);
  };

  return (
    <Modal title="Safe AI Tax & Duty Update Checker" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Target financial year">
            <div className="w-40">
              <SelectField
                value={fy}
                onChange={setFy}
                options={(Object.keys(TAX_TABLES) as FinancialYear[]).map((y) => ({ value: y, label: y }))}
              />
            </div>
          </Field>
          <Button onClick={() => void run()} disabled={busy}>
            <FileSearch size={14} /> {busy ? 'Checking…' : 'Run check'}
          </Button>
          <p className="text-[11px] text-zinc-400">
            Requires a search provider (Local AI settings). Changes are NEVER applied without your confirmation.
          </p>
        </div>

        {error && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

        {applied && (
          <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Applied as custom table <strong>{applied}</strong> — select it in the Household Tax card to use it.
          </p>
        )}

        {proposal && (
          <Card title={`Proposed update for ${proposal.fy}`} subtitle={proposal.notes || 'Extracted from live ATO sources'}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="py-1.5">Item</th>
                  <th className="py-1.5">Built-in</th>
                  <th className="py-1.5">Proposed</th>
                  <th className="py-1.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {proposal.diff.map((d, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-1.5 font-medium">{d.label}</td>
                    <td className="money py-1.5">{d.builtIn}</td>
                    <td className="money py-1.5">{d.proposed}</td>
                    <td className="py-1.5 text-right">
                      <Badge tone={d.changed ? 'warn' : 'neutral'}>{d.changed ? 'CHANGED' : 'same'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setProposal(null)}>Discard</Button>
              <Button onClick={apply}>Confirm &amp; apply as custom table</Button>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}
