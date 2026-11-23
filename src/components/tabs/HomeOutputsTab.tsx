import { AlertTriangle, BookOpen, Brain, FileSearch } from 'lucide-react';
import { EquityProjectionChart } from '../charts/EquityProjectionChart';
import { ExitWealthComparisonChart } from '../charts/ExitWealthComparisonChart';
import { usePlannerOutput } from '../../hooks/usePlannerOutput';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Badge, Button, Card, Money, Stat, fmtMoney, fmtPct } from '../ui';

const CASE_LABEL: Record<number, string> = {
  1: 'Case 1 — Buying today (existing property funds the deposit)',
  2: 'Case 2 — Future purchase, no existing property (savings horizon)',
  3: 'Case 3 — Future purchase with existing property (Phase 1 equity replaces starting pool)',
};

export function HomeOutputsTab({ onOpenAiReview, onOpenCgtRules, onOpenTaxDiff }: {
  onOpenAiReview: () => void;
  onOpenCgtRules: () => void;
  onOpenTaxDiff: () => void;
}) {
  const out = usePlannerOutput();
  const fy = usePlannerStore((s) => s.state.fy);
  const lmiCapitalize = usePlannerStore((s) => s.state.lmiCapitalize);
  const setFy = usePlannerStore((s) => s.set);
  const t = out.householdTax;
  const p = out.purchase;
  const m = out.mortgage;
  const v = out.viability;

  const ratingTone = v.rating === 'secure' ? 'good' : v.rating === 'caution' ? 'warn' : 'bad';

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {out.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={15} /> Attention
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-200">
            {out.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Household tax */}
      <Card
        title="Household Tax & Take-Home"
        subtitle={`Financial year ${fy} · exact ATO resident tables`}
        right={
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={fy}
              onChange={(e) => setFy({ fy: e.target.value })}
            >
              {['2023-24', '2025-26', '2026-27', '2027-28'].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
              {Object.keys(usePlannerStore.getState().state.customTaxTables).map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={onOpenTaxDiff} className="!px-2 !py-1 text-xs">
              <FileSearch size={13} /> Check tax updates
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Household gross" value={fmtMoney(t.householdGross)} sub="combined" />
          <Stat label="Total tax & levies" value={fmtMoney(t.householdTotalTax)} sub={`incl. HECS ${fmtMoney(t.householdHecs)}`} />
          <Stat label="Net take-home" value={fmtMoney(t.householdNet)} sub={`${fmtMoney(t.netFortnightly)}/fortnight · ${fmtMoney(t.netWeekly)}/week`} tone="good" />
          <Stat label="Net monthly" value={fmtMoney(t.netMonthly)} sub="drives all cashflow" tone="good" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[t.primary, t.partner].map((pr, i) => (
            <div key={i} className="rounded-lg border border-zinc-100 p-3 text-xs dark:border-zinc-800">
              <div className="mb-1 font-semibold">{i === 0 ? 'Primary partner' : 'Partner'}</div>
              <table className="w-full">
                <tbody>
                  <tr><td className="py-0.5 text-zinc-500">Gross income</td><td className="text-right money">{fmtMoney(pr.gross)}</td></tr>
                  <tr><td className="py-0.5 text-zinc-500">Income tax</td><td className="text-right money">-{fmtMoney(pr.incomeTax)}</td></tr>
                  <tr><td className="py-0.5 text-zinc-500">Medicare levy (2%)</td><td className="text-right money">-{fmtMoney(pr.medicareLevy)}</td></tr>
                  {pr.mls > 0 && <tr><td className="py-0.5 text-zinc-500">MLS</td><td className="text-right money">-{fmtMoney(pr.mls)}</td></tr>}
                  {pr.hecs > 0 && <tr><td className="py-0.5 text-zinc-500">HECS/HELP</td><td className="text-right money">-{fmtMoney(pr.hecs)}</td></tr>}
                  {pr.wato > 0 && <tr><td className="py-0.5 text-zinc-500">WATO offset</td><td className="text-right money text-emerald-600">+{fmtMoney(pr.wato)}</td></tr>}
                  <tr className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="py-1 font-semibold">Net pay</td>
                    <td className="money py-1 text-right font-semibold">{fmtMoney(pr.netPay)}</td>
                  </tr>
                  <tr><td className="py-0.5 text-zinc-500">Marginal rate (excl. Medicare)</td><td className="text-right money">{fmtPct(pr.marginalRateExclMedicare, 0)}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>

      {/* Phase 1 */}
      {out.phase1 && out.activePhase1 && (
        <Card
          title="Phase 1 — Exit Strategy (apples-to-apples)"
          subtitle={`Winner: Scenario ${out.phase1.winnerId} · advantage ${fmtMoney(out.phase1.winnerAdvantage)}`}
          right={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onOpenCgtRules} className="!px-2 !py-1 text-xs">
                <BookOpen size={13} /> CGT rules
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(['A', 'B', 'C', 'D'] as const).map((id) => {
              const s = out.phase1!.scenarios[id];
              const win = out.phase1!.winnerId === id;
              return (
                <div
                  key={id}
                  className={`rounded-lg border p-3 ${
                    win
                      ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Scenario {id}</span>
                    {win && <Badge tone="good">WINNER</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-500" title={s.name}>{s.name}</div>
                  <div className="money mt-1 text-base font-semibold">{fmtMoney(s.endingWealth)}</div>
                  <div className="text-[11px] text-zinc-400">deployable {fmtMoney(s.deployableEquity)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <ExitWealthComparisonChart result={out.phase1} />
          </div>
          <div className="mt-2 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
            <div>
              Breakeven growth rate (best of B/C/D ties A):{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {out.phase1.breakevenGrowthPct === null ? 'n/a within 0–25%' : `${out.phase1.breakevenGrowthPct}% p.a.`}
              </span>
            </div>
            <div>
              Breakeven interest rate (winner flips):{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {out.phase1.breakevenRatePct === null ? 'n/a within 0–15%' : `${out.phase1.breakevenRatePct}%`}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Future savings */}
      {out.futureSavings && (
        <Card title="Future Savings Horizon" subtitle={`${out.futureSavings.months} months of after-tax compounding`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Ending pool" value={fmtMoney(out.futureSavings.endingPool)} tone="good" />
            <Stat label="Pre-tax gains" value={fmtMoney(out.futureSavings.preTaxGains)} />
            <Stat label="Tax on gains" value={fmtMoney(out.futureSavings.taxPaid)} />
            <Stat label="Inflated target price" value={fmtMoney(out.futureSavings.futureTargetPrice)} sub="at settlement" />
          </div>
        </Card>
      )}

      {/* Phase 2 purchase */}
      <Card title={`Phase 2 — ${CASE_LABEL[p.case]}`} subtitle={p.poolSource}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Effective price" value={fmtMoney(p.effectivePrice)} />
          <Stat label="Deposit pool" value={fmtMoney(p.depositPool)} sub={p.poolShortfall > 0 ? `shortfall ${fmtMoney(p.poolShortfall)}` : 'covers emergency floor'} tone={p.poolShortfall > 0 ? 'bad' : 'good'} />
          <Stat label="Loan (incl. LMI)" value={fmtMoney(p.totalLoan)} sub={`${(p.lvr * 100).toFixed(1)}% LVR`} />
          <Stat label="Cash at settlement" value={fmtMoney(p.cashRequiredAtSettlement)} sub={`duty ${fmtMoney(p.duty.netDuty)}${p.duty.lmiFlagged ? ` + LMI ${fmtMoney(p.duty.lmiTotal)}` : ''} · LMI ${lmiCapitalize ? 'capitalised' : 'upfront'}`} />
        </div>
        {p.duty.lmiFlagged && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            LMI {p.duty.lmiBandLabel}: {fmtMoney(p.duty.lmiPremium)} premium + {fmtMoney(p.duty.lmiStampDuty)} NSW duty on the premium
            ({lmiCapitalize ? 'capitalised into the loan' : 'payable upfront'}).
          </p>
        )}
      </Card>

      {/* Mortgage */}
      <Card title="30-Year Mortgage & Payoff" subtitle={`Base P&I ${fmtMoney(m.baseMonthlyPayment)}/mo · extra ${fmtMoney(out.optimisedExtraMonthly)}/mo`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Standard payoff"
            value={m.standardPayoffMonth !== null ? `${Math.floor(m.standardPayoffMonth / 12)}y ${m.standardPayoffMonth % 12}m` : '>50y'}
            sub={`interest ${fmtMoney(m.standardTotalInterest)}`}
          />
          <Stat
            label="Accelerated payoff"
            value={m.acceleratedPayoffMonth !== null ? `${Math.floor(m.acceleratedPayoffMonth / 12)}y ${m.acceleratedPayoffMonth % 12}m` : '>50y'}
            sub={`interest ${fmtMoney(m.acceleratedTotalInterest)}`}
            tone="good"
          />
          <Stat label="Interest saved" value={fmtMoney(m.lifetimeInterestSaved)} sub={`${m.yearsSaved} years earlier`} tone="good" />
          <Stat
            label="Family loan snowball"
            value={m.familyLoanSnowballMonth !== null ? `Month ${m.familyLoanSnowballMonth}` : '—'}
            sub={m.bufferWentNegative ? 'buffer dipped negative' : 'offset buffer held'}
            tone={m.bufferWentNegative ? 'warn' : undefined}
          />
        </div>
        <div className="mt-4">
          <EquityProjectionChart curve={out.equityCurve} />
        </div>
      </Card>

      {/* Viability */}
      <Card
        title="Borrowing Viability"
        right={<Badge tone={ratingTone}>{v.rating.toUpperCase()}</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="DTI" value={`${v.dti.toFixed(1)}x`} sub={v.dtiStatus === 'ok' ? 'healthy' : v.dtiStatus === 'tight' ? 'tight (≥4.5x)' : 'high (≥6.0x)'} tone={v.dtiStatus === 'ok' ? 'good' : v.dtiStatus === 'tight' ? 'warn' : 'bad'} />
          <Stat label="Repayment stress" value={fmtPct(v.repaymentStress, 0)} sub={v.stressStatus === 'ok' ? 'under 30%' : v.stressStatus === 'tight' ? '30–45%' : '≥45% of take-home'} tone={v.stressStatus === 'ok' ? 'good' : v.stressStatus === 'tight' ? 'warn' : 'bad'} />
          <Stat label={`APRA @ ${v.apraAssessmentRatePct.toFixed(2)}%`} value={v.apraStatus === 'pass' ? 'PASS' : v.apraStatus === 'marginal' ? 'MARGINAL' : 'FAIL'} sub={`${v.apraSurplus >= 0 ? '+' : '-'}${fmtMoney(Math.abs(v.apraSurplus))}/mo surplus`} tone={v.apraStatus === 'pass' ? 'good' : v.apraStatus === 'marginal' ? 'warn' : 'bad'} />
          <Stat label="Surplus cushion" value={`${fmtMoney(v.surplusCushion)}/mo`} sub="after min P&I + living costs" tone="good" />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-300">
          {v.explanations.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </Card>

      {/* Rate sensitivity */}
      <Card title="Interest Rate Sensitivity (±1.0%)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="py-1.5">Scenario</th>
              <th className="py-1.5 text-right">Rate</th>
              <th className="py-1.5 text-right">Monthly P&I</th>
              <th className="py-1.5 text-right">Δ vs primary</th>
              <th className="py-1.5 text-right">Lifetime interest</th>
              <th className="py-1.5 text-right">APRA</th>
            </tr>
          </thead>
          <tbody>
            {out.rateSensitivity.map((r) => (
              <tr key={r.label} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="py-1.5 font-medium">{r.label}</td>
                <td className="money py-1.5 text-right">{r.ratePct.toFixed(2)}%</td>
                <td className="money py-1.5 text-right">{fmtMoney(r.monthlyPI)}</td>
                <td className={`money py-1.5 text-right ${r.deltaVsPrimaryMonthly > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {r.deltaVsPrimaryMonthly >= 0 ? '+' : ''}{fmtMoney(r.deltaVsPrimaryMonthly)}
                </td>
                <td className="money py-1.5 text-right">{fmtMoney(r.totalLifetimeInterest)}</td>
                <td className="py-1.5 text-right">
                  <Badge tone={r.apraStatus === 'pass' ? 'good' : r.apraStatus === 'marginal' ? 'warn' : 'bad'}>
                    {r.apraStatus.toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Share portfolio */}
      <Card title="Share Portfolio Liquidation (if sold)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Gross gain" value={fmtMoney(out.shares.grossGain)} />
          <Stat label="50% discount" value={out.shares.discountApplied ? 'applied' : 'not applied'} sub={out.shares.discountApplied ? 'held > 12 months' : 'held ≤ 12 months'} />
          <Stat label="CGT payable" value={fmtMoney(out.shares.cgtTax)} />
          <Stat label="Net usable proceeds" value={fmtMoney(out.shares.netProceeds)} tone="good" />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onOpenAiReview}>
          <Brain size={16} /> Ask the local AI about this plan
        </Button>
      </div>
    </div>
  );
}
