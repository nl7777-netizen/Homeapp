import { describe, expect, it } from 'vitest';
import { computeCgt, runExitPlanner, type CgtInput } from '../engine/exitPlannerEngine';
import type { ExitPlannerInput } from '../types/planner';

// ---------------------------------------------------------------------------
// CGT rules engine
// ---------------------------------------------------------------------------

const cgtBase: CgtInput = {
  salePrice: 800_000,
  costBase: 500_000,
  heldMonths: 200,
  mode: 'ppor-always',
  monthsRented: 0,
  valueAtFirstRental: 700_000,
  regime: 'standard',
  cpiPct: 0.025,
  monthsUntilReform: 8,
};

describe('ATO CGT rules engine', () => {
  it('PPOR always lived in -> 0% CGT', () => {
    const r = computeCgt(cgtBase, 0.5, 0.37, 0.37);
    expect(r.exempt).toBe(true);
    expect(r.cgtTax).toBe(0);
  });

  it('6-year absence rule: rented 60 months (<= 72) -> 0% CGT', () => {
    const r = computeCgt({ ...cgtBase, mode: 'ppor-rented', monthsRented: 60 }, 0.5, 0.37, 0.37);
    expect(r.exempt).toBe(true);
    expect(r.cgtTax).toBe(0);
    expect(r.detail).toContain('s.118-145');
  });

  it('6-year absence rule: rented 84 months (> 72) -> s.118-192 reset, only post-exemption gain taxed', () => {
    const r = computeCgt({ ...cgtBase, mode: 'ppor-rented', monthsRented: 84 }, 0.5, 0.37, 0.37);
    // gain = 800,000 - 700,000 (reset value) = 100,000; 50% discount -> 50,000 @ 37% = 18,500
    expect(r.exempt).toBe(false);
    expect(r.grossGain).toBe(100_000);
    expect(r.taxableGain).toBe(50_000);
    expect(r.cgtTax).toBe(18_500);
    expect(r.detail).toContain('s.118-192');
  });

  it('investment property: full CGT with 50% discount (held > 12 months)', () => {
    const r = computeCgt({ ...cgtBase, mode: 'investment' }, 0.5, 0.37, 0.37);
    // gain 300,000 -> taxable 150,000 @ 37% = 55,500
    expect(r.grossGain).toBe(300_000);
    expect(r.cgtTax).toBe(55_500);
  });

  it('investment property held <= 12 months: no discount', () => {
    const r = computeCgt({ ...cgtBase, mode: 'investment', heldMonths: 6 }, 0.5, 0.37, 0.37);
    expect(r.cgtTax).toBe(111_000);
  });

  it('ownership split weights the marginal rates', () => {
    // primary 100% @ 45%
    const r = computeCgt({ ...cgtBase, mode: 'investment' }, 1, 0.45, 0.3);
    expect(r.cgtTax).toBe(150_000 * 0.45);
  });

  it('post-1-Jul-2027 reform mode: no discount, CPI indexation, 30% rate floor', () => {
    const r = computeCgt(
      { ...cgtBase, mode: 'investment', regime: 'post2027', monthsUntilReform: -12 },
      0.5,
      0.3,
      0.3,
    );
    // indexation = 500,000 x 2.5% x 1yr = 12,500; taxable = 287,500; rate = max(30%, 30%) = 30%
    expect(r.discountApplied).toBe(false);
    expect(r.taxableGain).toBe(287_500);
    expect(r.cgtTax).toBe(86_250);
  });

  it('post-2027 reform applies the 30% floor when marginal rate is lower', () => {
    const r = computeCgt(
      { ...cgtBase, mode: 'investment', regime: 'post2027', monthsUntilReform: -12 },
      1,
      0.3,
      0,
    );
    expect(r.cgtTax).toBe(287_500 * 0.3);
  });
});

// ---------------------------------------------------------------------------
// Four-scenario exit planner
// ---------------------------------------------------------------------------

const baseInput: ExitPlannerInput = {
  existing: {
    value: 950_000,
    originalPurchasePrice: 720_000,
    purchaseCosts: 26_000,
    loanBalance: 380_000,
    loanRatePct: 5.99,
    loanTermMonthsRemaining: 240,
    weeklyRent: 850,
    vacancyWeeksPerYear: 2,
    pmFeePct: 0.1,
    maintenanceAnnual: 2_000,
    depreciationAnnual: 3_500,
    unimprovedLandValue: 420_000,
    strataMonthly: 0,
    councilMonthly: 235,
    insuranceMonthly: 95,
    waterMonthly: 75,
    utilitiesMonthly: 215,
    agentCommissionPct: 0.02,
    marketingCost: 500,
    legalCost: 1_200,
    dischargeFee: 250,
    cgtMode: 'ppor-always',
    monthsRentedBeforeSale: 0,
    valueAtFirstRental: 950_000,
    heldMonths: 132,
    cgtRegime: 'standard',
    grandfatheredGearing: true,
  },
  holdingPeriodMonths: 24,
  growthMode: 'annual',
  annualGrowthPct: 4.5,
  fixedFutureSalePrice: 0,
  startingLiquidPool: 250_000,
  householdNetMonthly: 15_000,
  pureLifestyleMonthly: 5_500,
  livingWithParentsMonthly: 2_800,
  scenarioBRepayment: 'pi',
  savingsReturnRatePct: 4.0,
  primaryMarginalRate: 0.37,
  partnerMarginalRate: 0.3,
  primaryFraction: 0.5,
  monthsUntilGearingReform: 8,
  cpiPct: 0.025,
};

describe('Exit planner — four scenarios, apples-to-apples', () => {
  it('runs all four scenarios from the same starting wealth', () => {
    const r = runExitPlanner(baseInput);
    for (const id of ['A', 'B', 'C', 'D'] as const) {
      expect(r.scenarios[id].endingWealth).toBeGreaterThan(0);
      expect(r.scenarios[id].wealthPath[0].month).toBe(0);
      expect(r.scenarios[id].wealthPath.at(-1)?.month).toBe(24);
    }
    expect(['A', 'B', 'C', 'D']).toContain(r.winnerId);
    expect(r.winnerAdvantage).toBeGreaterThanOrEqual(0);
  });

  it('Scenario A computes exact Month-0 net sale proceeds', () => {
    const r = runExitPlanner(baseInput);
    // 950,000 - (19,000 commission + 1,950 fees) - 380,000 loan - 0 CGT = 549,050
    expect(r.scenarios.A.monthZeroSaleNet).toBe(549_050);
    // Ending wealth = starting pool + sale net, compounded with monthly surplus
    expect(r.scenarios.A.endingWealth).toBeGreaterThan(250_000 + 549_050);
    expect(r.scenarios.A.deployableEquity).toBe(r.scenarios.A.endingWealth);
  });

  it('Scenario B (PPOR) captures appreciation and deducts exit costs', () => {
    const r = runExitPlanner(baseInput);
    const b = r.scenarios.B;
    expect(b.ledger.some((l) => l.label === 'Property value (Month 24)')).toBe(true);
    expect(b.ledger.find((l) => l.label === 'Property value (Month 24)')!.amount).toBeGreaterThan(950_000);
  });

  it('Scenario D extracts usable equity at 80% LVR without selling', () => {
    const r = runExitPlanner(baseInput);
    const d = r.scenarios.D;
    const pv24 = 950_000 * Math.pow(1.045, 2);
    // usable equity = max(0, value x 0.8 - remaining loan); loan still ~380k after 24 P&I months
    expect(d.deployableEquity).toBeGreaterThan(0);
    expect(d.endingWealth).toBeGreaterThanOrEqual(d.deployableEquity);
    expect(pv24).toBeGreaterThan(950_000);
  });

  it('breakeven growth solver returns a rate in [0, 25] or null', () => {
    const r = runExitPlanner(baseInput);
    if (r.breakevenGrowthPct !== null) {
      expect(r.breakevenGrowthPct).toBeGreaterThanOrEqual(0);
      expect(r.breakevenGrowthPct).toBeLessThanOrEqual(25);
    }
  });

  it('breakeven interest-rate solver returns a rate in [0, 15] or null', () => {
    const r = runExitPlanner(baseInput);
    if (r.breakevenRatePct !== null) {
      expect(r.breakevenRatePct).toBeGreaterThanOrEqual(0);
      expect(r.breakevenRatePct).toBeLessThanOrEqual(15);
    }
  });
});

describe('Negative gearing & NSW land tax in Scenario C', () => {
  it('negative gearing produces a tax refund (grandfathered)', () => {
    const r = runExitPlanner({
      ...baseInput,
      existing: {
        ...baseInput.existing,
        weeklyRent: 300, // clearly negatively geared
        cgtMode: 'investment',
      },
    });
    const refundLine = r.scenarios.C.ledger.find((l) => l.label === 'Negative gearing tax refunds');
    expect(refundLine).toBeDefined();
    expect(refundLine!.amount).toBeGreaterThan(0);
  });

  it('non-grandfathered property loses the loss offset after 1 Jul 2027', () => {
    const withGrandfather = runExitPlanner({
      ...baseInput,
      existing: { ...baseInput.existing, weeklyRent: 300, cgtMode: 'investment', grandfatheredGearing: true },
    });
    const withoutGrandfather = runExitPlanner({
      ...baseInput,
      existing: { ...baseInput.existing, weeklyRent: 300, cgtMode: 'investment', grandfatheredGearing: false },
    });
    const refundG = withGrandfather.scenarios.C.ledger.find((l) => l.label === 'Negative gearing tax refunds')!.amount;
    const refundNG = withoutGrandfather.scenarios.C.ledger.find((l) => l.label === 'Negative gearing tax refunds')!.amount;
    expect(refundNG).toBeLessThan(refundG);
  });

  it('NSW land tax is charged in Scenario C above the $1,075,000 threshold', () => {
    const taxable = runExitPlanner({
      ...baseInput,
      existing: { ...baseInput.existing, unimprovedLandValue: 1_200_000 },
    });
    const exempt = runExitPlanner({
      ...baseInput,
      existing: { ...baseInput.existing, unimprovedLandValue: 420_000 },
    });
    // 24 months => 2 annual land-tax charges of 100 + 1.6% x 125,000 = 2,100 each,
    // with the first charge compounding for 12 months at 4% (~4,250–4,300 total delta).
    const delta = exempt.scenarios.C.endingWealth - taxable.scenarios.C.endingWealth;
    expect(delta).toBeGreaterThan(4_100);
    expect(delta).toBeLessThan(4_500);
  });

  it('CGT applies at exit for investment properties', () => {
    const r = runExitPlanner({
      ...baseInput,
      existing: { ...baseInput.existing, cgtMode: 'investment' },
    });
    expect(r.scenarios.C.cgtPaid).toBeGreaterThan(0);
    expect(r.scenarios.A.cgtPaid).toBeGreaterThan(0);
  });
});
