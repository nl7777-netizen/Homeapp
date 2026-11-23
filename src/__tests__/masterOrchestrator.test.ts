import { describe, expect, it } from 'vitest';
import { runMasterPlanner } from '../engine/masterOrchestrator';
import { defaultState, decodeSyncCode, encodeSyncCode, migrateState } from '../services/persistence';
import type { PlannerState } from '../types/planner';

const NOW = new Date(2026, 10, 23); // fixed date for deterministic gearing-reform offset

function makeState(overrides: Partial<PlannerState> = {}): PlannerState {
  return { ...defaultState(), ...overrides };
}

describe('Master orchestrator — purchase cases', () => {
  it('Case 1 (buying today + existing property, Scenario A): pool = cash + net shares + other + Month-0 sale proceeds', () => {
    const state = makeState({ exitScenarioChoice: 'A' });
    const out = runMasterPlanner(state, NOW);
    expect(out.purchase.case).toBe(1);

    // Shares: 80k - 60k cost base = 20k gain; 50% discount; weighted 30% (both in 30% bracket) -> 3,000 CGT
    expect(out.shares.cgtTax).toBe(3_000);
    expect(out.shares.netProceeds).toBe(77_000);
    // Scenario A Month-0 sale: 950,000 - 20,950 costs - 380,000 loan - 0 CGT = 549,050
    expect(out.activePhase1!.monthZeroSaleNet).toBe(549_050);
    // Pool: 150,000 + 77,000 + 20,000 + 549,050 = 796,050
    expect(out.purchase.depositPool).toBe(796_050);
  });

  it('Case 2 (future simulation, no existing property): pool = compounded future savings', () => {
    const state = makeState({ hasExistingProperty: false, futureSimulationEnabled: true });
    const out = runMasterPlanner(state, NOW);
    expect(out.purchase.case).toBe(2);
    expect(out.futureSavings).not.toBeNull();
    expect(out.purchase.depositPool).toBe(out.futureSavings!.endingPool);
    expect(out.futureSavings!.endingPool).toBeGreaterThan(
      state.cashSavings + out.shares.netProceeds + state.otherAssets,
    );
  });

  it('Case 3 (future simulation + existing property): STRICT zero double-counting', () => {
    const state = makeState({ futureSimulationEnabled: true, exitScenarioChoice: 'A' });
    const out = runMasterPlanner(state, NOW);
    expect(out.purchase.case).toBe(3);
    expect(out.phase1).not.toBeNull();
    expect(out.activePhase1).not.toBeNull();

    // The Phase 2 deposit pool MUST equal the exact consolidated ending
    // deployable equity from Phase 1 (+ other assets, which never entered
    // Phase 1). Starting cash/shares are REPLACED, never added on top.
    const otherIncluded = state.includeOtherAssets ? state.otherAssets : 0;
    expect(out.purchase.depositPool).toBe(out.activePhase1!.deployableEquity + otherIncluded);

    // Anti double-count assertion: the pool must NOT equal the naive sum of
    // starting pool + ending wealth (which would count the starting cash twice).
    const naiveDoubleCount =
      state.cashSavings + out.shares.netProceeds + otherIncluded + out.activePhase1!.deployableEquity;
    expect(out.purchase.depositPool).not.toBeCloseTo(naiveDoubleCount, 0);

    // And the starting cash must have flowed through exactly once: raising
    // starting cash by $10k must raise the pool by exactly the Phase-1
    // passthrough of that $10k (compounded), never by $10k + passthrough.
    const stateB = makeState({ futureSimulationEnabled: true, exitScenarioChoice: 'A', cashSavings: 160_000 });
    const outB = runMasterPlanner(stateB, NOW);
    const passthrough = outB.activePhase1!.deployableEquity - out.activePhase1!.deployableEquity;
    expect(outB.purchase.depositPool - out.purchase.depositPool).toBeCloseTo(passthrough, 0);
    expect(passthrough).toBeGreaterThan(10_000); // 10k compounded + interest over 24 months
    expect(passthrough).toBeLessThan(11_500); // ...but far less than 20k (no double count)
  });

  it('Case 3 with Scenario D active: retained IP debt enters serviceability', () => {
    const state = makeState({ futureSimulationEnabled: true, exitScenarioChoice: 'D' });
    const out = runMasterPlanner(state, NOW);
    expect(out.purchase.case).toBe(3);
    // DTI must include the retained existing-property loan (380k) + new loan.
    const expectedDebt = out.purchase.totalLoan + state.existing.loanBalance + state.familyLoanAmount;
    expect(out.viability.dti).toBeCloseTo(expectedDebt / out.householdTax.householdGross, 1);
  });

  it('future mode inflates the target price, which flows into duty dynamically', () => {
    const base = makeState({ hasExistingProperty: false, futureSimulationEnabled: true, inflateTargetPropertyPrice: true });
    const inflated = runMasterPlanner(base, NOW);
    const notInflated = runMasterPlanner({ ...base, inflateTargetPropertyPrice: false }, NOW);
    // 24 months at 5.5% suburb growth
    expect(inflated.purchase.effectivePrice).toBeCloseTo(base.targetPurchasePrice * Math.pow(1.055, 2), 0);
    expect(inflated.purchase.duty.netDuty).toBeGreaterThan(notInflated.purchase.duty.netDuty);
    expect(inflated.futureSavings!.futureTargetPrice).toBe(inflated.purchase.effectivePrice);
  });

  it('produces a full viability + mortgage + equity-curve output', () => {
    const out = runMasterPlanner(makeState(), NOW);
    expect(out.viability.rating).toBeOneOf(['secure', 'caution', 'high']);
    expect(out.viability.explanations.length).toBeGreaterThanOrEqual(4);
    expect(out.mortgage.baseMonthlyPayment).toBeGreaterThan(0);
    expect(out.mortgage.rows.length).toBeGreaterThan(0);
    expect(out.equityCurve.length).toBe(31);
    expect(out.equityCurve[30].year).toBe(30);
    expect(out.equityCurve[30].propertyValue).toBeGreaterThan(out.equityCurve[0].propertyValue);
    expect(out.rateSensitivity.length).toBe(3);
    expect(out.rateSensitivity[0].ratePct).toBeLessThan(out.rateSensitivity[1].ratePct);
    expect(out.rateSensitivity[2].ratePct).toBeGreaterThan(out.rateSensitivity[1].ratePct);
  });

  it('one-click surplus optimisation sweeps (unallocated - buffer) into extra repayments', () => {
    const state = makeState({ optimizeSurplus: true, extraMonthlyRepayment: 0 });
    const out = runMasterPlanner(state, NOW);
    const expectedSweep = Math.max(0, out.finalUnallocatedMonthly - state.monthlyUnallocatedBuffer);
    expect(out.optimisedExtraMonthly).toBeCloseTo(Math.max(expectedSweep, 0), 0);
    if (out.finalUnallocatedMonthly > state.monthlyUnallocatedBuffer) {
      expect(out.mortgage.acceleratedPayoffMonth!).toBeLessThan(360);
    }
  });
});

describe('Persistence — schema migration & sync codes', () => {
  it('a partial/older JSON payload loads cleanly without crashing (missing keys merge with defaults)', () => {
    const migrated = migrateState({ schemaVersion: 0, primaryIncome: 99_999 });
    expect(migrated.primaryIncome).toBe(99_999);
    expect(migrated.schemaVersion).toBe(1);
    // Every other key falls back to defaults.
    expect(migrated.suburb).toBe('Penrith');
    expect(migrated.existing.value).toBe(950_000);
    expect(migrated.holdingCosts.strata.period).toBe('annual');
    expect(migrated.ai.lmStudioBaseUrl).toBe('http://localhost:1234/v1');
  });

  it('a deeply nested partial object merges safely', () => {
    const migrated = migrateState({ holdingCosts: { strata: { value: 123 } } });
    expect(migrated.holdingCosts.strata.value).toBe(123);
    expect(migrated.holdingCosts.strata.period).toBe('annual');
    expect(migrated.holdingCosts.council.value).toBe(2_800);
  });

  it('wrong-typed values fall back to defaults instead of crashing', () => {
    const migrated = migrateState({ primaryIncome: 'not-a-number', cashSavings: null });
    expect(migrated.primaryIncome).toBe(120_000);
    expect(migrated.cashSavings).toBe(150_000);
  });

  it('garbage and null payloads return full defaults', () => {
    expect(migrateState(null).suburb).toBe('Penrith');
    expect(migrateState('garbage').cashSavings).toBe(150_000);
    expect(migrateState([1, 2, 3]).fy).toBe('2026-27');
  });

  it('wireless sync code round-trips with checksum validation', () => {
    const state = makeState({ primaryIncome: 77_777, suburb: 'Parramatta' });
    const code = encodeSyncCode(state);
    expect(code.startsWith('NSWPP1.')).toBe(true);
    const decoded = decodeSyncCode(code);
    expect(decoded.primaryIncome).toBe(77_777);
    expect(decoded.suburb).toBe('Parramatta');
    expect(decoded.cashSavings).toBe(150_000);
  });

  it('sync code rejects corruption (checksum mismatch)', () => {
    const state = makeState();
    const code = encodeSyncCode(state);
    const [prefix, sum, compressed] = code.split('.');
    // Flip a character in the checksum.
    const badSum = (sum[0] === 'a' ? 'b' : 'a') + sum.slice(1);
    expect(() => decodeSyncCode(`${prefix}.${badSum}.${compressed}`)).toThrow(/checksum/i);
  });

  it('sync code rejects foreign/garbage strings', () => {
    expect(() => decodeSyncCode('hello world')).toThrow();
    expect(() => decodeSyncCode('NSWPP1.deadbeef.!!!not-base64!!!')).toThrow();
  });
});
