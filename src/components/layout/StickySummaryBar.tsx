import { AlertTriangle, Moon, Sun } from 'lucide-react';
import { usePlannerOutput } from '../../hooks/usePlannerOutput';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Badge, fmtMoney } from '../ui';

/** Always-visible key outputs: take-home, loan/LVR, viability rating, payoff. */
export function StickySummaryBar({ onToggleTheme }: { onToggleTheme: () => void }) {
  const out = usePlannerOutput();
  const theme = usePlannerStore((s) => s.state.theme);
  const toggleTheme = usePlannerStore((s) => s.toggleTheme);
  const p = out.purchase;
  const v = out.viability;
  const m = out.mortgage;

  const ratingTone = v.rating === 'secure' ? 'good' : v.rating === 'caution' ? 'warn' : 'bad';
  const payoffLabel =
    m.acceleratedPayoffMonth !== null
      ? `${Math.floor(m.acceleratedPayoffMonth / 12)}y ${m.acceleratedPayoffMonth % 12}m`
      : '>50y';

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Take-home</span>
          <span className="money text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {fmtMoney(out.householdTax.netMonthly)}/mo
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Loan</span>
          <span className="money text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmtMoney(p.totalLoan)}</span>
          <span className="text-[11px] text-zinc-400">@ {(p.lvr * 100).toFixed(1)}% LVR</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Duty</span>
          <span className="money text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmtMoney(p.duty.netDuty)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Payoff</span>
          <span className="money text-sm font-semibold text-sky-600 dark:text-sky-400">{payoffLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Viability</span>
          <Badge tone={ratingTone}>{v.rating.toUpperCase()}</Badge>
        </div>
        {out.warnings.length > 0 && (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400" title={out.warnings.join('\n')}>
            <AlertTriangle size={14} />
            <span className="text-[11px] font-medium">{out.warnings.length} warning{out.warnings.length > 1 ? 's' : ''}</span>
          </div>
        )}
        <button
          onClick={() => {
            toggleTheme();
            onToggleTheme();
          }}
          className="ml-auto rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
}
