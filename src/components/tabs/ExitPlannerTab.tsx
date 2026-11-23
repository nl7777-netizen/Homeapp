import { BookOpen, Trophy } from 'lucide-react';
import { ExitWealthComparisonChart } from '../charts/ExitWealthComparisonChart';
import { usePlannerOutput } from '../../hooks/usePlannerOutput';
import { usePlannerStore } from '../../store/usePlannerStore';
import type { ExistingPropertyInput } from '../../types/planner';
import { Badge, Button, Card, Field, NumberField, SelectField, Toggle, fmtMoney } from '../ui';

const EXISTING_FIELDS: { key: keyof ExistingPropertyInput; label: string; prefix?: string; suffix?: string; step?: number }[] = [
  { key: 'value', label: 'Current market value', prefix: '$', step: 10_000 },
  { key: 'originalPurchasePrice', label: 'Original purchase price', prefix: '$', step: 10_000 },
  { key: 'purchaseCosts', label: 'Purchase duty + costs (cost base add)', prefix: '$', step: 500 },
  { key: 'loanBalance', label: 'Current loan balance', prefix: '$', step: 5_000 },
  { key: 'loanRatePct', label: 'Loan interest rate %', suffix: '%', step: 0.01 },
  { key: 'loanTermMonthsRemaining', label: 'Loan term remaining (months)', step: 12 },
  { key: 'weeklyRent', label: 'Weekly rent (if rented)', prefix: '$', step: 10 },
  { key: 'vacancyWeeksPerYear', label: 'Vacancy weeks / year', step: 1 },
  { key: 'pmFeePct', label: 'Property management fee %', suffix: '%', step: 0.5 },
  { key: 'maintenanceAnnual', label: 'Maintenance (annual)', prefix: '$', step: 100 },
  { key: 'depreciationAnnual', label: 'Depreciation claimed (annual, non-cash)', prefix: '$', step: 100 },
  { key: 'unimprovedLandValue', label: 'Unimproved land value (NSW land tax)', prefix: '$', step: 10_000 },
  { key: 'councilMonthly', label: 'Council rates (monthly)', prefix: '$', step: 10 },
  { key: 'insuranceMonthly', label: 'Insurance (monthly)', prefix: '$', step: 5 },
  { key: 'waterMonthly', label: 'Water (monthly)', prefix: '$', step: 5 },
  { key: 'utilitiesMonthly', label: 'Utilities (monthly)', prefix: '$', step: 10 },
  { key: 'strataMonthly', label: 'Strata (monthly)', prefix: '$', step: 10 },
  { key: 'agentCommissionPct', label: 'Agent commission %', suffix: '%', step: 0.1 },
  { key: 'marketingCost', label: 'Marketing / auction fees', prefix: '$', step: 100 },
  { key: 'legalCost', label: 'Legal (sale)', prefix: '$', step: 100 },
  { key: 'dischargeFee', label: 'Mortgage discharge fee', prefix: '$', step: 50 },
  { key: 'monthsRentedBeforeSale', label: 'Months rented before sale (6-yr rule)', step: 1 },
  { key: 'valueAtFirstRental', label: 'Value at first rental (s.118-192 reset)', prefix: '$', step: 10_000 },
  { key: 'heldMonths', label: 'Total months owned (50% discount)', step: 1 },
];

export function ExitPlannerTab({ onOpenCgtRules }: { onOpenCgtRules: () => void }) {
  const out = usePlannerOutput();
  const state = usePlannerStore((s) => s.state);
  const set = usePlannerStore((s) => s.set);
  const setExisting = usePlannerStore((s) => s.setExisting);

  const ex = state.existing;
  const setEx = (key: keyof ExistingPropertyInput, v: number | string | boolean) => setExisting({ [key]: v } as Partial<ExistingPropertyInput>);

  return (
    <div className="space-y-4">
      {!state.hasExistingProperty && (
        <Card title="No existing property">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enable the existing property below to run the four-scenario exit analysis (A: sell now · B: keep as PPOR · C: rent
            then sell · D: rentvest &amp; extract equity).
          </p>
          <div className="mt-3 w-64">
            <Toggle checked={state.hasExistingProperty} onChange={(b) => set({ hasExistingProperty: b })} label="I have an existing NSW property" />
          </div>
        </Card>
      )}

      {state.hasExistingProperty && (
        <>
          <Card
            title="Existing Property"
            subtitle="Value, loan, rental & exit-cost inputs"
            right={
              <Button variant="secondary" onClick={onOpenCgtRules} className="!px-2 !py-1 text-xs">
                <BookOpen size={13} /> CGT rules explained
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {EXISTING_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <NumberField
                    value={Number(ex[f.key]) || 0}
                    onChange={(n) => setEx(f.key, n)}
                    prefix={f.prefix}
                    suffix={f.suffix}
                    step={f.step ?? 1}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="CGT treatment">
                <SelectField
                  value={ex.cgtMode}
                  onChange={(v) => setEx('cgtMode', v)}
                  options={[
                    { value: 'ppor-always', label: 'PPOR — always lived in (0% CGT)' },
                    { value: 'ppor-rented', label: 'PPOR — rented part of ownership' },
                    { value: 'investment', label: 'Investment property (full CGT)' },
                  ]}
                />
              </Field>
              <Field label="CGT regime">
                <SelectField
                  value={ex.cgtRegime}
                  onChange={(v) => setEx('cgtRegime', v)}
                  options={[
                    { value: 'standard', label: 'Standard (pre-reform rules)' },
                    { value: 'post2027', label: 'Post-1-Jul-2027 reform (no discount + CPI indexation)' },
                  ]}
                />
              </Field>
              <Toggle checked={ex.grandfatheredGearing} onChange={(b) => setEx('grandfatheredGearing', b)} label="Grandfathered negative gearing" />
              <Field label="Scenario B repayment mode">
                <SelectField
                  value={state.scenarioBRepayment}
                  onChange={(v) => set({ scenarioBRepayment: v })}
                  options={[
                    { value: 'pi', label: 'Principal & interest' },
                    { value: 'io', label: 'Interest only' },
                    { value: 'offset', label: 'P&I + surplus to offset' },
                  ]}
                />
              </Field>
            </div>
          </Card>

          <Card title="Growth Assumptions & Scenario Choice">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Growth mode">
                <SelectField
                  value={state.growthMode}
                  onChange={(v) => set({ growthMode: v })}
                  options={[
                    { value: 'annual', label: 'Annual growth %' },
                    { value: 'fixed', label: 'Fixed future sale price' },
                  ]}
                />
              </Field>
              {state.growthMode === 'annual' ? (
                <Field label="Annual property growth %">
                  <NumberField value={state.annualGrowthPct} onChange={(n) => set({ annualGrowthPct: n })} suffix="%" step={0.1} />
                </Field>
              ) : (
                <Field label="Fixed future sale price">
                  <NumberField value={state.fixedFutureSalePrice} onChange={(n) => set({ fixedFutureSalePrice: n })} prefix="$" step={10_000} />
                </Field>
              )}
              <Field label="Active scenario (feeds Phase 2)">
                <SelectField
                  value={state.exitScenarioChoice}
                  onChange={(v) => set({ exitScenarioChoice: v })}
                  options={[
                    { value: 'auto', label: 'Auto (winner)' },
                    { value: 'A', label: 'A — Sell now' },
                    { value: 'B', label: 'B — Keep as PPOR' },
                    { value: 'C', label: 'C — Rent then sell' },
                    { value: 'D', label: 'D — Rentvest & extract equity' },
                  ]}
                />
              </Field>
            </div>
          </Card>

          {out.phase1 && (
            <Card
              title="Scenario Outcomes (apples-to-apples consolidated wealth)"
              right={
                <Badge tone="good">
                  <Trophy size={11} className="mr-1" /> Winner {out.phase1.winnerId} by {fmtMoney(out.phase1.winnerAdvantage)}
                </Badge>
              }
            >
              <ExitWealthComparisonChart result={out.phase1} />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(['A', 'B', 'C', 'D'] as const).map((id) => {
                  const s = out.phase1!.scenarios[id];
                  return (
                    <div
                      key={id}
                      className={`rounded-lg border p-3 ${
                        out.phase1!.winnerId === id
                          ? 'border-emerald-400 dark:border-emerald-700'
                          : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold">Scenario {id}</span>
                          <span className="ml-2 text-xs text-zinc-500">{s.name}</span>
                        </div>
                        <span className="money text-base font-semibold">{fmtMoney(s.endingWealth)}</span>
                      </div>
                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          <tr>
                            <td className="py-0.5 text-zinc-500">Deployable to Phase 2</td>
                            <td className="money py-0.5 text-right font-medium">{fmtMoney(s.deployableEquity)}</td>
                          </tr>
                          {s.monthZeroSaleNet > 0 && (
                            <tr>
                              <td className="py-0.5 text-zinc-500">Month-0 net sale proceeds</td>
                              <td className="money py-0.5 text-right">{fmtMoney(s.monthZeroSaleNet)}</td>
                            </tr>
                          )}
                          {s.usableEquityNow > 0 && (
                            <tr>
                              <td className="py-0.5 text-zinc-500">Usable equity now (80% LVR)</td>
                              <td className="money py-0.5 text-right">{fmtMoney(s.usableEquityNow)}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-0.5 text-zinc-500">CGT paid</td>
                            <td className="money py-0.5 text-right">{fmtMoney(s.cgtPaid)}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-zinc-500">Interest paid</td>
                            <td className="money py-0.5 text-right">{fmtMoney(s.totalInterestPaid)}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-zinc-500">Tax paid (net)</td>
                            <td className="money py-0.5 text-right">{fmtMoney(s.totalTaxPaid)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-violet-600 dark:text-violet-300">
                          Full ledger
                        </summary>
                        <table className="mt-1 w-full text-[11px]">
                          <tbody>
                            {s.ledger.map((l, i) => (
                              <tr key={i}>
                                <td className="py-0.5 text-zinc-500">{l.label}</td>
                                <td className={`money py-0.5 text-right ${l.amount < 0 ? 'text-rose-500' : ''}`}>
                                  {l.amount < 0 ? '-' : ''}{fmtMoney(Math.abs(l.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Breakeven growth:</span>{' '}
                  {out.phase1.breakevenGrowthPct === null
                    ? 'no flip within 0–25% p.a.'
                    : `at ${out.phase1.breakevenGrowthPct}% p.a. the best keep/rentvest strategy ties selling now`}
                </div>
                <div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Breakeven rate:</span>{' '}
                  {out.phase1.breakevenRatePct === null
                    ? 'no winner flip within 0–15%'
                    : `at ${out.phase1.breakevenRatePct}% the scenario winner changes`}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
