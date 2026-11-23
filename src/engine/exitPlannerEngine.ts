/**
 * Phase 1 — Existing Property Exit Decision Planner.
 *
 * Four competing scenarios (A: sell now & live with parents, B: hold & live
 * in (PPOR), C: rent out & live with parents, D: keep & extract usable
 * equity) simulated month-by-month over the holding horizon from the exact
 * same starting household wealth (apples-to-apples). Includes the ATO
 * CGT rules engine (PPOR exemption, 6-year absence rule s.118-145 with
 * s.118-192 cost-base reset, investment full CGT, 50% discount vs
 * post-1-Jul-2027 reform mode), NSW land tax, negative gearing with
 * grandfathering, and binary-search breakeven solvers.
 */

import type {
  CgtMode,
  CgtRegime,
  ExitPlannerInput,
  ExitPlannerResult,
  LedgerLine,
  ScenarioId,
  ScenarioResult,
  WealthPoint,
} from '../types/planner';
import { nswLandTax } from './stampDutyEngine';
import { monthlyPayment } from './mortgageEngine';

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// CGT rules engine
// ---------------------------------------------------------------------------

export interface CgtInput {
  salePrice: number;
  /** For investment mode: original purchase price + purchase costs - Div 43 claimed. */
  costBase: number;
  heldMonths: number;
  mode: CgtMode;
  /** Months rented (ppor-rented mode; 6-year absence rule = 72 months). */
  monthsRented: number;
  /** Market value on the date first rented (s.118-192 reset). */
  valueAtFirstRental: number;
  regime: CgtRegime;
  /** CPI fraction for post-2027 cost-base indexation. */
  cpiPct: number;
  /** Months from sale to 1 Jul 2027 (negative = sale after the reform). */
  monthsUntilReform: number;
}

export interface CgtResult {
  grossGain: number;
  taxableGain: number;
  discountApplied: boolean;
  exempt: boolean;
  cgtTax: number;
  detail: string;
}

/**
 * Australian CGT on the sale of the existing property.
 * Taxed at the weighted marginal rate of the legal owners (Medicare is NOT
 * levied on capital gains).
 */
export function computeCgt(
  input: CgtInput,
  primaryFraction: number,
  primaryRate: number,
  partnerRate: number,
): CgtResult {
  const weightedRate = primaryFraction * primaryRate + (1 - primaryFraction) * partnerRate;

  // Mode 1: always lived in — full PPOR exemption.
  if (input.mode === 'ppor-always') {
    return { grossGain: 0, taxableGain: 0, discountApplied: false, exempt: true, cgtTax: 0, detail: 'PPOR exemption: always lived in (0% CGT).' };
  }

  let gain: number;
  let detail: string;

  if (input.mode === 'ppor-rented') {
    if (input.monthsRented <= 72) {
      // 6-year absence rule (s.118-145): fully exempt.
      return {
        grossGain: Math.max(0, input.salePrice - input.costBase),
        taxableGain: 0,
        discountApplied: false,
        exempt: true,
        cgtTax: 0,
        detail: `6-year absence rule (s.118-145): rented ${input.monthsRented} months <= 72 — 0% CGT.`,
      };
    }
    // s.118-192: cost base resets to market value on the date first rented.
    gain = Math.max(0, input.salePrice - input.valueAtFirstRental);
    detail = `Rented ${input.monthsRented} months > 72 — s.118-192 reset: only post-exemption gain ($${round2(input.salePrice - input.valueAtFirstRental).toLocaleString()}) is taxable.`;
  } else {
    gain = Math.max(0, input.salePrice - input.costBase);
    detail = 'Investment property from day 1: full CGT on (sale - cost base).';
  }

  let taxableGain = gain;
  let discountApplied = false;

  if (input.regime === 'standard') {
    if (input.heldMonths > 12) {
      taxableGain = gain * 0.5;
      discountApplied = true;
      detail += ' 50% CGT discount applied (held > 12 months).';
    }
  } else {
    // Post-1-Jul-2027 reform mode: no discount, cost-base CPI indexation for
    // years after the reform, and a 30% minimum CGT rate floor.
    const yearsAfterReform = Math.max(0, -input.monthsUntilReform) / 12;
    const indexation = input.costBase * input.cpiPct * yearsAfterReform;
    taxableGain = Math.max(0, gain - indexation);
    detail += ` Post-2027 reform: no discount, CPI indexation $${round2(indexation).toLocaleString()}, 30% rate floor.`;
  }

  const rate = input.regime === 'post2027' ? Math.max(weightedRate, 0.3) : weightedRate;
  const cgtTax = round2(taxableGain * rate);

  return {
    grossGain: round2(gain),
    taxableGain: round2(taxableGain),
    discountApplied,
    exempt: false,
    cgtTax,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Shared scenario helpers
// ---------------------------------------------------------------------------

interface SimCtx {
  input: ExitPlannerInput;
  /** Override annual growth (used by the breakeven solver). */
  growthOverridePct: number | null;
  /** Override existing mortgage rate (used by the breakeven solver). */
  rateOverridePct: number | null;
}

function monthlyGrowthFactor(ctx: SimCtx): number {
  const annual = ctx.growthOverridePct ?? ctx.input.annualGrowthPct;
  if (ctx.input.growthMode === 'fixed') return 1; // fixed price path handles it
  return Math.pow(1 + annual / 100, 1 / 12) - 1;
}

function propertyValueAt(ctx: SimCtx, month: number): number {
  const ex = ctx.input.existing;
  if (ctx.input.growthMode === 'fixed') {
    if (month === 0) return ex.value;
    if (month >= ctx.input.holdingPeriodMonths) return ctx.input.fixedFutureSalePrice;
    // Linear interpolation for the path display.
    const t = month / ctx.input.holdingPeriodMonths;
    return ex.value + (ctx.input.fixedFutureSalePrice - ex.value) * t;
  }
  return ex.value * Math.pow(1 + (ctx.growthOverridePct ?? ctx.input.annualGrowthPct) / 100, month / 12);
}

function sellingCostsFor(value: number, input: ExitPlannerInput): number {
  const ex = input.existing;
  return value * ex.agentCommissionPct + ex.marketingCost + ex.legalCost + ex.dischargeFee;
}

function cgtAtSale(ctx: SimCtx, month: number, monthsRentedTotal: number): CgtResult {
  const { input } = ctx;
  const ex = input.existing;
  const salePrice = propertyValueAt(ctx, month);
  const costBase = ex.originalPurchasePrice + ex.purchaseCosts - ex.depreciationAnnual * Math.floor(ex.heldMonths / 12);
  return computeCgt(
    {
      salePrice,
      costBase,
      heldMonths: ex.heldMonths + month,
      mode: ex.cgtMode,
      monthsRented: monthsRentedTotal,
      valueAtFirstRental: ex.valueAtFirstRental,
      regime: ex.cgtRegime,
      cpiPct: input.cpiPct,
      monthsUntilReform: input.monthsUntilGearingReform - month,
    },
    input.primaryFraction,
    input.primaryMarginalRate,
    input.partnerMarginalRate,
  );
}

function ctx0(input: ExitPlannerInput): SimCtx {
  return { input, growthOverridePct: null, rateOverridePct: null };
}

function existingHoldingCostsMonthly(input: ExitPlannerInput): number {
  const ex = input.existing;
  return ex.strataMonthly + ex.councilMonthly + ex.insuranceMonthly + ex.waterMonthly + ex.utilitiesMonthly;
}

function rentalCashflowMonthly(input: ExitPlannerInput, loanBalance: number, ratePct: number): number {
  const ex = input.existing;
  const grossRent = ex.weeklyRent * (52 / 12);
  const effectiveRent = grossRent * (1 - ex.vacancyWeeksPerYear / 52) * (1 - ex.pmFeePct);
  const expenses =
    ex.strataMonthly +
    ex.councilMonthly +
    ex.insuranceMonthly +
    ex.waterMonthly +
    ex.utilitiesMonthly +
    ex.maintenanceAnnual / 12;
  const interest = loanBalance * (ratePct / 100 / 12);
  return effectiveRent - expenses - interest;
}

function rentalTaxableAnnual(input: ExitPlannerInput, loanBalance: number, ratePct: number): number {
  return rentalCashflowMonthly(input, loanBalance, ratePct) * 12 - input.existing.depreciationAnnual;
}

function gearingAllowedAtMonth(input: ExitPlannerInput, month: number): boolean {
  if (input.existing.grandfatheredGearing) return true;
  // Non-grandfathered established residential: losses quarantined from 1 Jul 2027.
  return month < input.monthsUntilGearingReform;
}

function weightedMarginalRate(input: ExitPlannerInput): number {
  return input.primaryFraction * input.primaryMarginalRate + (1 - input.primaryFraction) * input.partnerMarginalRate;
}

function recordPath(path: WealthPoint[], month: number, wealth: number, finalMonth: number): void {
  if (month === 0 || month === finalMonth || month % 12 === 0) {
    path.push({ month, wealth: round2(wealth) });
  }
}

// ---------------------------------------------------------------------------
// Scenario A — Sell now & live with parents
// ---------------------------------------------------------------------------

function scenarioA(ctx: SimCtx): ScenarioResult {
  const { input } = ctx;
  const ex = input.existing;
  const N = input.holdingPeriodMonths;

  const saleValue = ex.value;
  const cgt = cgtAtSale(ctx, 0, ex.monthsRentedBeforeSale);
  const saleNet = saleValue - sellingCostsFor(saleValue, input) - ex.loanBalance - cgt.cgtTax;

  const r = input.savingsReturnRatePct / 100 / 12;
  const taxRate = weightedMarginalRate(input) + 0.02; // marginal + Medicare on interest
  let account = input.startingLiquidPool + saleNet;
  let yearInterest = 0;
  let totalTax = cgt.cgtTax;
  const path: WealthPoint[] = [{ month: 0, wealth: round2(account) }];

  for (let m = 1; m <= N; m++) {
    const interest = account * r;
    account += interest;
    yearInterest += interest;
    account += input.householdNetMonthly - input.livingWithParentsMonthly;
    if (m % 12 === 0) {
      const tax = yearInterest * taxRate;
      account -= tax;
      totalTax += tax;
      yearInterest = 0;
    }
    recordPath(path, m, account, N);
  }

  const ledger: LedgerLine[] = [
    { label: 'Existing property value', amount: round2(saleValue) },
    { label: 'Agent commission + marketing + legal + discharge', amount: -round2(sellingCostsFor(saleValue, input)) },
    { label: 'Existing mortgage balance', amount: -round2(ex.loanBalance) },
    { label: 'CGT', amount: -cgt.cgtTax },
    { label: 'Net sale proceeds (Month 0)', amount: round2(saleNet) },
    { label: 'Starting liquid pool', amount: round2(input.startingLiquidPool) },
    { label: 'Monthly surplus banked (after-tax)', amount: round2((input.householdNetMonthly - input.livingWithParentsMonthly) * N) },
    { label: 'Investment income tax', amount: round2(-(totalTax - cgt.cgtTax)) },
  ];

  return {
    id: 'A',
    name: 'Sell Now & Live with Parents',
    endingWealth: round2(account),
    deployableEquity: round2(account),
    cgtPaid: cgt.cgtTax,
    totalInterestPaid: 0,
    totalTaxPaid: round2(totalTax),
    wealthPath: path,
    ledger,
    monthZeroSaleNet: round2(saleNet),
    usableEquityNow: 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario B — Hold & live in (PPOR)
// ---------------------------------------------------------------------------

function scenarioB(ctx: SimCtx): ScenarioResult {
  const { input } = ctx;
  const ex = input.existing;
  const N = input.holdingPeriodMonths;
  const rate = (ctx.rateOverridePct ?? ex.loanRatePct) / 100 / 12;

  const basePI =
    ex.loanTermMonthsRemaining > 0
      ? monthlyPayment(ex.loanBalance, ctx.rateOverridePct ?? ex.loanRatePct, ex.loanTermMonthsRemaining / 12)
      : ex.loanBalance * rate;

  let loan = ex.loanBalance;
  let offset = 0;
  const r = input.savingsReturnRatePct / 100 / 12;
  const taxRate = weightedMarginalRate(input) + 0.02;
  let cash = input.startingLiquidPool;
  let yearInterest = 0;
  let totalTax = 0;
  let totalInterest = 0;
  const path: WealthPoint[] = [];

  for (let m = 0; m <= N; m++) {
    const pv = propertyValueAt(ctx, m);
    if (m > 0) {
      let payment: number;
      let interest: number;
      if (loan <= 0.005) {
        payment = 0;
        interest = 0;
      } else if (input.scenarioBRepayment === 'io') {
        interest = loan * rate;
        payment = interest;
      } else if (input.scenarioBRepayment === 'offset') {
        interest = Math.max(0, loan - offset) * rate;
        payment = Math.min(basePI, loan + interest);
      } else {
        interest = loan * rate;
        payment = Math.min(basePI, loan + interest);
      }
      loan = Math.max(0, loan + interest - payment);
      totalInterest += interest;

      const surplus =
        input.householdNetMonthly - input.pureLifestyleMonthly - existingHoldingCostsMonthly(input) - payment;
      if (input.scenarioBRepayment === 'offset') {
        offset = Math.max(0, offset + surplus);
      } else {
        const interestAccrued = cash * r;
        cash += interestAccrued;
        yearInterest += interestAccrued;
        cash += surplus;
        if (m % 12 === 0) {
          const tax = yearInterest * taxRate;
          cash -= tax;
          totalTax += tax;
          yearInterest = 0;
        }
      }
    }
    recordPath(path, m, pv - loan + cash + (input.scenarioBRepayment === 'offset' ? offset : 0), N);
  }

  const saleValue = propertyValueAt(ctx, N);
  const cgt = cgtAtSale(ctx, N, ex.monthsRentedBeforeSale);
  const saleNet = saleValue - sellingCostsFor(saleValue, input) - loan - cgt.cgtTax;
  const ending = saleNet + cash + (input.scenarioBRepayment === 'offset' ? offset : 0);

  return {
    id: 'B',
    name: 'Hold & Live In (PPOR)',
    endingWealth: round2(ending),
    deployableEquity: round2(ending),
    cgtPaid: cgt.cgtTax,
    totalInterestPaid: round2(totalInterest),
    totalTaxPaid: round2(totalTax + cgt.cgtTax),
    wealthPath: path,
    ledger: [
      { label: 'Property value (Month 0)', amount: round2(ex.value) },
      { label: `Property value (Month ${N})`, amount: round2(saleValue) },
      { label: 'Mortgage interest paid', amount: -round2(totalInterest) },
      { label: 'Remaining loan at exit', amount: -round2(loan) },
      { label: 'Selling costs', amount: -round2(sellingCostsFor(saleValue, input)) },
      { label: 'CGT at exit', amount: -cgt.cgtTax },
      { label: 'Accumulated cash / offset', amount: round2(cash + (input.scenarioBRepayment === 'offset' ? offset : 0)) },
    ],
    monthZeroSaleNet: 0,
    usableEquityNow: 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario C — Rent out & live with parents (convert to IP)
// ---------------------------------------------------------------------------

function scenarioC(ctx: SimCtx, opts: { sellAtEnd: boolean }): ScenarioResult {
  const { input } = ctx;
  const ex = input.existing;
  const N = input.holdingPeriodMonths;
  const rate = (ctx.rateOverridePct ?? ex.loanRatePct) / 100 / 12;
  const basePI =
    ex.loanTermMonthsRemaining > 0
      ? monthlyPayment(ex.loanBalance, ctx.rateOverridePct ?? ex.loanRatePct, ex.loanTermMonthsRemaining / 12)
      : ex.loanBalance * rate;

  let loan = ex.loanBalance;
  const r = input.savingsReturnRatePct / 100 / 12;
  const taxRate = weightedMarginalRate(input) + 0.02;
  let cash = input.startingLiquidPool;
  let yearInterest = 0;
  let totalTax = 0;
  let totalInterest = 0;
  let totalGearingRefund = 0;
  let totalRentalProfitTax = 0;
  let yearRentalTaxable = 0;
  const path: WealthPoint[] = [];
  const id: ScenarioId = opts.sellAtEnd ? 'C' : 'D';
  const name = opts.sellAtEnd ? 'Rent Out & Live with Parents' : 'Keep & Extract Usable Equity (Rentvest)';

  for (let m = 0; m <= N; m++) {
    const pv = propertyValueAt(ctx, m);
    if (m > 0) {
      const interest = Math.min(loan * rate, loan);
      const payment = loan > 0.005 ? Math.min(basePI, loan + interest) : 0;
      loan = Math.max(0, loan + interest - payment);
      totalInterest += interest;

      const rentCash = rentalCashflowMonthly(input, loan, ctx.rateOverridePct ?? ex.loanRatePct);
      yearRentalTaxable += rentalTaxableAnnual(input, loan, ctx.rateOverridePct ?? ex.loanRatePct) / 12;

      const interestAccrued = cash * r;
      cash += interestAccrued;
      yearInterest += interestAccrued;
      cash += input.householdNetMonthly - input.livingWithParentsMonthly + rentCash;

      if (m % 12 === 0) {
        const invTax = yearInterest * taxRate;
        cash -= invTax;
        totalTax += invTax;
        yearInterest = 0;

        const annualRental = yearRentalTaxable;
        yearRentalTaxable = 0;
        if (annualRental < 0) {
          const allowed = gearingAllowedAtMonth(input, m);
          const refund = allowed ? Math.abs(annualRental) * weightedMarginalRate(input) : 0;
          cash += refund;
          totalGearingRefund += refund;
        } else if (annualRental > 0) {
          const tax = annualRental * weightedMarginalRate(input);
          cash -= tax;
          totalRentalProfitTax += tax;
          totalTax += tax;
        }
        // NSW land tax (taxable unimproved land value).
        const lt = nswLandTax(ex.unimprovedLandValue);
        cash -= lt;
        totalTax += lt;
      }
    }
    recordPath(path, m, pv - loan + cash, N);
  }

  if (!opts.sellAtEnd) {
    // Scenario D: keep the property, extract usable equity at Month N.
    const pv = propertyValueAt(ctx, N);
    const equity = pv - loan;
    const usable = Math.max(0, pv * 0.8 - loan);
    return {
      id,
      name,
      endingWealth: round2(equity + cash),
      deployableEquity: round2(usable + cash),
      cgtPaid: 0,
      totalInterestPaid: round2(totalInterest),
      totalTaxPaid: round2(totalTax - totalGearingRefund),
      wealthPath: path,
      ledger: [
        { label: `Property value (Month ${N})`, amount: round2(pv) },
        { label: 'Remaining loan', amount: -round2(loan) },
        { label: 'Equity', amount: round2(equity) },
        { label: 'Usable equity (80% LVR cap)', amount: round2(usable) },
        { label: 'Mortgage interest paid', amount: -round2(totalInterest) },
        { label: 'Negative gearing tax refunds', amount: round2(totalGearingRefund) },
        { label: 'Rental profit tax + land tax', amount: -round2(totalRentalProfitTax) },
        { label: 'Accumulated cash', amount: round2(cash) },
      ],
      monthZeroSaleNet: 0,
      usableEquityNow: round2(Math.max(0, ex.value * 0.8 - ex.loanBalance)),
    };
  }

  const saleValue = propertyValueAt(ctx, N);
  const cgt = cgtAtSale(ctx, N, ex.monthsRentedBeforeSale + N);
  const saleNet = saleValue - sellingCostsFor(saleValue, input) - loan - cgt.cgtTax;
  const ending = saleNet + cash;

  return {
    id,
    name,
    endingWealth: round2(ending),
    deployableEquity: round2(ending),
    cgtPaid: cgt.cgtTax,
    totalInterestPaid: round2(totalInterest),
    totalTaxPaid: round2(totalTax - totalGearingRefund + cgt.cgtTax),
    wealthPath: path,
    ledger: [
      { label: `Property value (Month ${N})`, amount: round2(saleValue) },
      { label: 'Selling costs', amount: -round2(sellingCostsFor(saleValue, input)) },
      { label: 'Remaining loan at exit', amount: -round2(loan) },
      { label: 'CGT at exit', amount: -cgt.cgtTax },
      { label: 'Net rental cashflow (total)', amount: round2(rentalCashflowMonthly(input, ex.loanBalance, ex.loanRatePct) * N) },
      { label: 'Negative gearing tax refunds', amount: round2(totalGearingRefund) },
      { label: 'Rental profit tax + land tax', amount: -round2(totalRentalProfitTax) },
      { label: 'Accumulated cash', amount: round2(cash) },
    ],
    monthZeroSaleNet: round2(ex.value - sellingCostsFor(ex.value, input) - ex.loanBalance - cgtAtSale(ctx, 0, ex.monthsRentedBeforeSale).cgtTax),
    usableEquityNow: 0,
  };
}

// ---------------------------------------------------------------------------
// Top-level runner + breakeven solvers
// ---------------------------------------------------------------------------

function runScenarios(ctx: SimCtx): Record<ScenarioId, ScenarioResult> {
  return {
    A: scenarioA(ctx),
    B: scenarioB(ctx),
    C: scenarioC(ctx, { sellAtEnd: true }),
    D: scenarioC(ctx, { sellAtEnd: false }),
  };
}

function winnerOf(scenarios: Record<ScenarioId, ScenarioResult>): { id: ScenarioId; advantage: number } {
  const ids: ScenarioId[] = ['A', 'B', 'C', 'D'];
  const sorted = [...ids].sort((a, b) => scenarios[b].endingWealth - scenarios[a].endingWealth);
  return { id: sorted[0], advantage: round2(scenarios[sorted[0]].endingWealth - scenarios[sorted[1]].endingWealth) };
}

/**
 * Binary search for the breakeven property growth rate where the best
 * hold/rent strategy (B/C/D) ties Scenario A (sell now).
 */
function breakevenGrowth(ctx: SimCtx): number | null {
  const base = runScenarios(ctx);
  const aWealth = base.A.endingWealth;
  const holdAt = (g: number): number => {
    const c: SimCtx = { ...ctx, growthOverridePct: g };
    const s = runScenarios(c);
    return Math.max(s.B.endingWealth, s.C.endingWealth, s.D.endingWealth);
  };
  const f = (g: number): number => holdAt(g) - aWealth;
  let lo = 0;
  let hi = 25;
  const fLo = f(lo);
  const fHi = f(hi);
  if (fLo >= 0) return 0; // holding already wins at 0% growth
  if (fHi <= 0) return null; // holding never wins up to 25%
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return round2((lo + hi) / 2 * 100) / 100;
}

/**
 * Binary search for the breakeven existing-mortgage rate at which the
 * current winner flips against the best alternative.
 */
function breakevenRate(ctx: SimCtx): number | null {
  const base = runScenarios(ctx);
  const { id: winnerId } = winnerOf(base);
  const at = (r: number): { winner: ScenarioId; gap: number } => {
    const s = runScenarios({ ...ctx, rateOverridePct: r });
    const w = winnerOf(s);
    // gap = winner wealth - best non-winner wealth
    const ids: ScenarioId[] = ['A', 'B', 'C', 'D'];
    const bestOther = Math.max(...ids.filter((x) => x !== w.id).map((x) => s[x].endingWealth));
    return { winner: w.id, gap: s[w.id].endingWealth - bestOther };
  };
  // Find a rate where the winner is NOT the current winner.
  let flip: number | null = null;
  for (let r = 0; r <= 15.001; r += 0.25) {
    if (at(r).winner !== winnerId) {
      flip = r;
      break;
    }
  }
  if (flip === null) return null; // never flips in 0–15%
  // Binary search between the current rate and the flip point.
  let a = Math.min(ctx.input.existing.loanRatePct, flip);
  let b = Math.max(ctx.input.existing.loanRatePct, flip);
  for (let i = 0; i < 50; i++) {
    const mid = (a + b) / 2;
    if (at(mid).winner !== winnerId) b = mid;
    else a = mid;
  }
  return round2((a + b) / 2 * 100) / 100;
}

export function runExitPlanner(input: ExitPlannerInput): ExitPlannerResult {
  const ctx = ctx0(input);
  const scenarios = runScenarios(ctx);
  const { id, advantage } = winnerOf(scenarios);
  return {
    scenarios,
    winnerId: id,
    winnerAdvantage: advantage,
    breakevenGrowthPct: breakevenGrowth(ctx),
    breakevenRatePct: breakevenRate(ctx),
  };
}
