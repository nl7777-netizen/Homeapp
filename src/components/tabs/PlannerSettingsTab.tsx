import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { NSW_SUBURBS } from '../../data/nswSuburbs';
import { findSuburb } from '../../data/nswSuburbs';
import { suburbLookup } from '../../services/aiWorkflows';
import { usePlannerStore } from '../../store/usePlannerStore';
import type { LifeEvent } from '../../types/planner';
import { Button, Card, Field, NumberField, SelectField, TextField, Toggle } from '../ui';

type SubTab = 'household' | 'target';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PlannerSettingsTab() {
  const [sub, setSub] = useState<SubTab>('household');
  const state = usePlannerStore((s) => s.state);
  const set = usePlannerStore((s) => s.set);
  const setHoldingCost = usePlannerStore((s) => s.setHoldingCost);
  const setTargetDate = usePlannerStore((s) => s.setTargetDate);
  const setHoldingPeriodMonths = usePlannerStore((s) => s.setHoldingPeriodMonths);
  const addLifeEvent = usePlannerStore((s) => s.addLifeEvent);
  const updateLifeEvent = usePlannerStore((s) => s.updateLifeEvent);
  const removeLifeEvent = usePlannerStore((s) => s.removeLifeEvent);
  const addCustomSuburb = usePlannerStore((s) => s.addCustomSuburb);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const runAiSuburb = async () => {
    setAiBusy(true);
    setAiMsg(null);
    try {
      const r = await suburbLookup(state.suburb, state.ai);
      addCustomSuburb({
        name: r.suburb,
        region: r.region,
        medianHousePrice: r.medianHousePrice,
        medianUnitPrice: r.medianUnitPrice,
        historicalGrowthRate: r.historicalGrowthRate,
        grossRentalYield: r.grossRentalYield,
        sources: r.sources,
        custom: true,
      });
      set({ suburbGrowthPct: Math.round(r.historicalGrowthRate * 1000) / 10 });
      setAiMsg(
        r.offlineEstimate
          ? 'Offline estimate applied (local suburb database / regional benchmark).'
          : 'Local AI extracted live market data — suburb added to your custom list.',
      );
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : 'AI suburb lookup failed.');
    } finally {
      setAiBusy(false);
    }
  };

  const knownSuburbs = [
    ...NSW_SUBURBS,
    ...state.customSuburbs.filter((c) => !NSW_SUBURBS.some((n) => n.name.toLowerCase() === c.name.toLowerCase())),
  ];

  const selectedSuburb = findSuburb(state.suburb, state.customSuburbs);

  type CostKey = 'strata' | 'council' | 'insurance' | 'water' | 'utilities';
  const costField = (key: CostKey, label: string) => (
    <div className="grid grid-cols-3 gap-2">
      <NumberField value={state.holdingCosts[key].value} onChange={(n) => setHoldingCost(key, { value: n })} prefix="$" />
      <SelectField
        value={state.holdingCosts[key].period}
        onChange={(p) => setHoldingCost(key, { period: p })}
        options={[
          { value: 'annual', label: 'annual' },
          { value: 'quarterly', label: 'quarterly' },
          { value: 'monthly', label: 'monthly' },
        ]}
      />
      <div className="flex items-center text-xs text-zinc-400">{label}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(['household', 'target'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              sub === t ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {t === 'household' ? 'Household, Assets & Budget' : 'Target Property, Loan & Future Mode'}
          </button>
        ))}
      </div>

      {sub === 'household' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Income & Tax Profile">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary partner gross income (AUD/yr)">
                <NumberField value={state.primaryIncome} onChange={(n) => set({ primaryIncome: n })} prefix="$" step={1000} />
              </Field>
              <Field label="Partner gross income (AUD/yr)">
                <NumberField value={state.partnerIncome} onChange={(n) => set({ partnerIncome: n })} prefix="$" step={1000} />
              </Field>
              <Toggle checked={state.primaryHecs} onChange={(b) => set({ primaryHecs: b })} label="Primary has HECS/HELP debt" />
              <Toggle checked={state.partnerHecs} onChange={(b) => set({ partnerHecs: b })} label="Partner has HECS/HELP debt" />
              <Toggle checked={state.hasPrivateHospitalCover} onChange={(b) => set({ hasPrivateHospitalCover: b })} label="Private hospital cover (all members)" />
              <Field label="Dependent children">
                <NumberField value={state.dependentChildren} onChange={(n) => set({ dependentChildren: Math.max(0, Math.round(n)) })} min={0} max={12} />
              </Field>
            </div>
          </Card>

          <Card title="Budget & Cashflow">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pure lifestyle (monthly)" hint="rent-free living baseline">
                <NumberField value={state.pureLifestyleMonthly} onChange={(n) => set({ pureLifestyleMonthly: n })} prefix="$" step={50} />
              </Field>
              <Field label="Living with parents (monthly)" hint="Scenario A baseline">
                <NumberField value={state.livingWithParentsMonthly} onChange={(n) => set({ livingWithParentsMonthly: n })} prefix="$" step={50} />
              </Field>
              <Field label="Emergency cash floor">
                <NumberField value={state.emergencyCashFloor} onChange={(n) => set({ emergencyCashFloor: n })} prefix="$" step={1000} />
              </Field>
              <Field label="Monthly unallocated buffer">
                <NumberField value={state.monthlyUnallocatedBuffer} onChange={(n) => set({ monthlyUnallocatedBuffer: n })} prefix="$" step={50} />
              </Field>
              <Toggle checked={state.optimizeSurplus} onChange={(b) => set({ optimizeSurplus: b })} label="One-click surplus optimisation" />
            </div>
          </Card>

          <Card title="Assets & Ownership">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cash savings">
                <NumberField value={state.cashSavings} onChange={(n) => set({ cashSavings: n })} prefix="$" step={1000} />
              </Field>
              <Field label="Other assets (excl. Phase 1)">
                <NumberField value={state.otherAssets} onChange={(n) => set({ otherAssets: n })} prefix="$" step={1000} />
              </Field>
              <Field label="Share portfolio value">
                <NumberField value={state.sharePortfolioValue} onChange={(n) => set({ sharePortfolioValue: n })} prefix="$" step={1000} />
              </Field>
              <Field label="Share cost base">
                <NumberField value={state.sharePortfolioCostBase} onChange={(n) => set({ sharePortfolioCostBase: n })} prefix="$" step={1000} />
              </Field>
              <Toggle checked={state.sharesHeldOver12Months} onChange={(b) => set({ sharesHeldOver12Months: b })} label="Shares held > 12 months (50% CGT discount)" />
              <Toggle checked={state.includeOtherAssets} onChange={(b) => set({ includeOtherAssets: b })} label="Include other assets in deposit pool" />
              <Field label="Ownership split">
                <SelectField
                  value={state.ownershipSplit.kind}
                  onChange={(v) =>
                    set({
                      ownershipSplit:
                        v === 'custom'
                          ? { kind: 'custom', primaryPct: state.ownershipSplit.kind === 'custom' ? state.ownershipSplit.primaryPct : 50 }
                          : { kind: v },
                    })
                  }
                  options={[
                    { value: 'joint-5050', label: 'Joint 50/50' },
                    { value: 'primary-100', label: 'Primary 100%' },
                    { value: 'partner-100', label: 'Partner 100%' },
                    { value: 'custom', label: 'Custom %' },
                  ]}
                />
              </Field>
              {state.ownershipSplit.kind === 'custom' && (
                <Field label="Primary ownership %">
                  <NumberField
                    value={state.ownershipSplit.primaryPct}
                    onChange={(n) => set({ ownershipSplit: { kind: 'custom', primaryPct: Math.min(100, Math.max(0, n)) } })}
                    suffix="%"
                    min={0}
                    max={100}
                  />
                </Field>
              )}
            </div>
          </Card>

          <Card title="Family Co-Loan (optional)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Family loan amount">
                <NumberField value={state.familyLoanAmount} onChange={(n) => set({ familyLoanAmount: n })} prefix="$" step={5000} />
              </Field>
              <Field label="Annual repayment">
                <NumberField value={state.familyLoanAnnualRepayment} onChange={(n) => set({ familyLoanAnnualRepayment: n })} prefix="$" step={1000} />
              </Field>
              <Toggle checked={state.familyLoanSnowball} onChange={(b) => set({ familyLoanSnowball: b })} label="Snowball into bank repayments at payoff" />
            </div>
          </Card>

          <Card
            title="Target Holding Costs (Phase 2)"
            subtitle="Strata, council rates, insurance, water & utilities for the new home"
          >
            <div className="space-y-2">
              {costField('strata', 'Strata / body corporate')}
              {costField('council', 'Council rates')}
              {costField('insurance', 'Home & contents')}
              {costField('water', 'Water rates')}
              {costField('utilities', 'Power, gas, internet')}
            </div>
          </Card>

          <Card title="Life Events (max 5)" subtitle="Income shocks and one-off offset deposits/withdrawals">
            <div className="space-y-2">
              {state.lifeEvents.map((e: LifeEvent) => (
                <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2">
                  <Field label="Label">
                    <TextField value={e.label} onChange={(s) => updateLifeEvent(e.id, { label: s })} />
                  </Field>
                  <Field label={e.type === 'income-shock' ? 'Partner income share' : 'Amount'}>
                    {e.type === 'income-shock' ? (
                      <NumberField value={Math.round(e.value * 100)} onChange={(n) => updateLifeEvent(e.id, { value: Math.min(1, Math.max(0, n / 100)) })} suffix="%" step={5} />
                    ) : (
                      <NumberField value={e.value} onChange={(n) => updateLifeEvent(e.id, { value: n })} prefix="$" step={1000} />
                    )}
                  </Field>
                  <Field label="Start month">
                    <NumberField value={e.startMonth} onChange={(n) => updateLifeEvent(e.id, { startMonth: Math.max(1, Math.round(n)), endMonth: Math.max(e.endMonth, Math.max(1, Math.round(n))) })} min={1} />
                  </Field>
                  <Field label="End month">
                    <NumberField value={e.endMonth} onChange={(n) => updateLifeEvent(e.id, { endMonth: Math.max(e.startMonth, Math.round(n)) })} min={1} />
                  </Field>
                  <Button variant="ghost" onClick={() => removeLifeEvent(e.id)} className="!px-2">
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() =>
                  addLifeEvent({ type: 'income-shock', label: 'Parental leave', startMonth: 12, endMonth: 24, value: 0.5 })
                }
              >
                <Plus size={14} /> Add life event
              </Button>
            </div>
          </Card>
        </div>
      )}

      {sub === 'target' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Target NSW Suburb & Price">
            <div className="space-y-3">
              <Field label="Suburb">
                <div className="flex gap-2">
                  <select
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={state.suburb}
                    onChange={(e) => set({ suburb: e.target.value })}
                  >
                    {!knownSuburbs.some((s) => s.name.toLowerCase() === state.suburb.toLowerCase()) && (
                      <option value={state.suburb}>{state.suburb}</option>
                    )}
                    {knownSuburbs.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} — {s.region}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={runAiSuburb} disabled={aiBusy}>
                    <Sparkles size={14} /> {aiBusy ? 'Searching…' : 'AI lookup'}
                  </Button>
                </div>
              </Field>
              {selectedSuburb && (
                <p className="text-[11px] text-zinc-400">
                  {selectedSuburb.custom ? 'Custom suburb · ' : ''}median house {`$${(selectedSuburb.medianHousePrice / 1000).toFixed(0)}k`} · unit{' '}
                  {`$${(selectedSuburb.medianUnitPrice / 1000).toFixed(0)}k`} · {`growth ${(selectedSuburb.historicalGrowthRate * 100).toFixed(1)}% p.a.`} ·{' '}
                  {`yield ${(selectedSuburb.grossRentalYield * 100).toFixed(1)}%`}
                  {selectedSuburb.sources && selectedSuburb.sources.length > 0 ? ` · ${selectedSuburb.sources.length} sources` : ''}
                </p>
              )}
              {aiMsg && <p className="text-[11px] text-violet-600 dark:text-violet-300">{aiMsg}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target purchase price">
                  <NumberField value={state.targetPurchasePrice} onChange={(n) => set({ targetPurchasePrice: n })} prefix="$" step={10_000} />
                </Field>
                <Field label="Suburb growth (p.a.)">
                  <NumberField value={state.suburbGrowthPct} onChange={(n) => set({ suburbGrowthPct: n })} suffix="%" step={0.1} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Loan & LMI">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loan interest rate (p.a.)">
                <NumberField value={state.loanInterestRatePct} onChange={(n) => set({ loanInterestRatePct: n })} suffix="%" step={0.05} />
              </Field>
              <Field label="Offset monthly contribution">
                <NumberField value={state.offsetMonthlyContribution} onChange={(n) => set({ offsetMonthlyContribution: n })} prefix="$" step={100} />
              </Field>
              <Field label="Manual extra repayment (monthly)">
                <NumberField value={state.extraMonthlyRepayment} onChange={(n) => set({ extraMonthlyRepayment: n })} prefix="$" step={50} />
              </Field>
              <Toggle checked={state.lmiCapitalize} onChange={(b) => set({ lmiCapitalize: b })} label="Capitalise LMI into the loan" />
              <Field label="LMI override (AUD, 0 = auto banded)">
                <NumberField value={state.lmiOverride ?? 0} onChange={(n) => set({ lmiOverride: n > 0 ? n : null })} prefix="$" step={500} />
              </Field>
              <Toggle checked={state.fhabas} onChange={(b) => set({ fhabas: b })} label="FHBAS first-home concession" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Conveyancing">
                <NumberField value={state.acquisitionCosts.conveyancing} onChange={(n) => set({ acquisitionCosts: { ...state.acquisitionCosts, conveyancing: n } })} prefix="$" />
              </Field>
              <Field label="Building / pest / strata report">
                <NumberField value={state.acquisitionCosts.buildingPestStrata} onChange={(n) => set({ acquisitionCosts: { ...state.acquisitionCosts, buildingPestStrata: n } })} prefix="$" />
              </Field>
              <Field label="PEXA, title & mortgage fees">
                <NumberField value={state.acquisitionCosts.pexaTitleMortgage} onChange={(n) => set({ acquisitionCosts: { ...state.acquisitionCosts, pexaTitleMortgage: n } })} prefix="$" />
              </Field>
              <Field label="Council, water & misc">
                <NumberField value={state.acquisitionCosts.councilWaterMisc} onChange={(n) => set({ acquisitionCosts: { ...state.acquisitionCosts, councilWaterMisc: n } })} prefix="$" />
              </Field>
            </div>
          </Card>

          <Card title="Future Simulation (deferred purchase)" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Toggle checked={state.futureSimulationEnabled} onChange={(b) => set({ futureSimulationEnabled: b })} label="Enable future mode" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start month">
                  <div className="flex gap-1">
                    <select
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      value={state.startMonth}
                      onChange={(e) => set({ startMonth: parseInt(e.target.value) })}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <NumberField value={state.startYear} onChange={(n) => set({ startYear: Math.round(n) })} />
                  </div>
                </Field>
                <Field label="Target (auto-syncs)">
                  <div className="flex gap-1">
                    <select
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      value={state.targetMonth}
                      onChange={(e) => setTargetDate(state.targetYear, parseInt(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <NumberField value={state.targetYear} onChange={(n) => setTargetDate(Math.round(n), state.targetMonth)} />
                  </div>
                </Field>
              </div>
              <Field label="Horizon (months, synced)">
                <NumberField value={state.holdingPeriodMonths} onChange={setHoldingPeriodMonths} min={1} max={360} />
              </Field>
              <Toggle checked={state.inflateTargetPropertyPrice} onChange={(b) => set({ inflateTargetPropertyPrice: b })} label="Inflate target price at suburb growth" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Toggle checked={state.wageGrowthEnabled} onChange={(b) => set({ wageGrowthEnabled: b })} label="Wage growth" />
              <Field label="Annual wage growth %">
                <NumberField value={state.annualWageGrowthPct} onChange={(n) => set({ annualWageGrowthPct: n })} suffix="%" step={0.1} />
              </Field>
              <Toggle checked={state.cpiEnabled} onChange={(b) => set({ cpiEnabled: b })} label="CPI on living expenses" />
              <Field label="Annual CPI %">
                <NumberField value={state.annualLivingExpenseCpiPct} onChange={(n) => set({ annualLivingExpenseCpiPct: n })} suffix="%" step={0.1} />
              </Field>
              <Field label="Savings return (p.a.)">
                <NumberField value={state.savingsReturnRatePct} onChange={(n) => set({ savingsReturnRatePct: n })} suffix="%" step={0.1} />
              </Field>
              <Field label="Investment mode">
                <SelectField
                  value={state.investmentMode}
                  onChange={(v) => set({ investmentMode: v })}
                  options={[
                    { value: 'hisa', label: 'High-interest savings account' },
                    { value: 'etf', label: 'ETF (dividends + capital gains)' },
                  ]}
                />
              </Field>
              {state.investmentMode === 'etf' && (
                <Field label="ETF dividend yield %">
                  <NumberField value={state.etfDividendYieldPct} onChange={(n) => set({ etfDividendYieldPct: n })} suffix="%" step={0.1} />
                </Field>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
