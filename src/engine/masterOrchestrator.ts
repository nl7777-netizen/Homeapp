/**
 * Master Orchestrator — pure top-level pipeline connecting Phase 1 (Exit
 * Strategy) to Phase 2 (Target NSW Purchase, Viability & 30-Year Payoff).
 *
 * STRICT ZERO-DOUBLE-COUNTING HANDOFF:
 *  Case 1 (Buying Today + Existing Property):
 *    pool = liquid cash + net share proceeds + included other assets
 *           + existing property net sale proceeds (Month 0, A/C)
 *           OR usable equity (D). Scenario B keeps the property → liquid only.
 *  Case 2 (Future Simulation + No Existing Property):
 *    pool = compounded starting liquid pool + after-tax savings (Future Mode).
 *  Case 3 (Future Simulation + Existing Property):
 *    pool = EXACT consolidated ending deployable equity/cash from the active
 *    Phase 1 scenario — Phase 2 REPLACES (never adds onto) the starting
 *    cash/shares/equity. Other assets (not part of Phase 1) are added once.
 */

import { getTable, type YearTaxTable } from '../data/taxTables';
import {
  computeHouseholdTax,
  computeShareCgt,
} from './taxEngine';
import { computeAcquisition } from './stampDutyEngine';
import { runExitPlanner } from './exitPlannerEngine';
import { simulateFutureSavings } from './futureSavingsEngine';
import { monthlyPayment, simulateMortgage } from './mortgageEngine';
import { assessViability } from './viabilityEngine';
import type {
  EquityCurvePoint,
  HouseholdTaxResult,
  MortgageSimResult,
  OrchestratorOutput,
  PlannerState,
  PurchaseCase,
  RateSensitivityRow,
  ScenarioResult,
  StampDutyResult,
  ViabilityResult,
} from '../types/planner';
import { ownershipPrimaryFraction } from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Months from now until 1 Jul 2027 (negative = already past). */
export function monthsUntilGearingReform(now: Date = new Date()): number {
  const reform = Date.UTC(2027, 6, 1);
  return Math.round((reform - now.getTime()) / (30.44 * 24 * 3600 * 1000));
}

function parseCustomTables(raw: Record<string, string>): Record<string, YearTaxTable> {
  const out: Record<string, YearTaxTable> = {};
  for (const [label, json] of Object.entries(raw)) {
    try {
      out[label] = JSON.parse(json) as YearTaxTable;
    } catch {
      // Ignore malformed custom tables rather than crashing the planner.
    }
  }
  return out;
}

function holdingCostsMonthly(state: PlannerState): number {
  const toMonthly = (v: number, period: 'annual' | 'quarterly' | 'monthly'): number =>
    period === 'annual' ? v / 12 : period === 'quarterly' ? v / 3 : v;
  const hc = state.holdingCosts;
  return (
    toMonthly(hc.strata.value, hc.strata.period) +
    toMonthly(hc.council.value, hc.council.period) +
    toMonthly(hc.insurance.value, hc.insurance.period) +
    toMonthly(hc.water.value, hc.water.period) +
    toMonthly(hc.utilities.value, hc.utilities.period)
  );
}

export function runMasterPlanner(state: PlannerState, now: Date = new Date()): OrchestratorOutput {
  const warnings: string[] = [];
  const customTables = parseCustomTables(state.customTaxTables);

  // ------------------------------------------------------------------
  // Step 1 — Household tax (exact ATO engine).
  // ------------------------------------------------------------------
  const householdTax: HouseholdTaxResult = computeHouseholdTax(
    {
      fy: state.fy,
      primary: { grossAnnualIncome: state.primaryIncome, hasHecsDebt: state.primaryHecs },
      partner: { grossAnnualIncome: state.partnerIncome, hasHecsDebt: state.partnerHecs },
      hasPrivateHospitalCover: state.hasPrivateHospitalCover,
      dependentChildren: state.dependentChildren,
    },
    customTables,
  );

  // ------------------------------------------------------------------
  // Step 2 — Share portfolio CGT (net usable proceeds).
  // ------------------------------------------------------------------
  const primaryFraction = ownershipPrimaryFraction(state.ownershipSplit);
  const shares = computeShareCgt({
    portfolioValue: state.sharePortfolioValue,
    costBase: state.sharePortfolioCostBase,
    heldOver12Months: state.sharesHeldOver12Months,
    primaryFraction,
    primaryMarginalRate: householdTax.primary.marginalRateExclMedicare,
    partnerMarginalRate: householdTax.partner.marginalRateExclMedicare,
  });

  const N = Math.max(1, Math.round(state.holdingPeriodMonths));
  const netMonthly = householdTax.netMonthly;

  // ------------------------------------------------------------------
  // Step 3 — Phase 1 (only when an existing property exists).
  // ------------------------------------------------------------------
  let phase1 = null;
  let activePhase1: ScenarioResult | null = null;

  if (state.hasExistingProperty) {
    const ex = state.existing;
    const exitResult = runExitPlanner({
      existing: ex,
      holdingPeriodMonths: N,
      growthMode: state.growthMode,
      annualGrowthPct: state.annualGrowthPct,
      fixedFutureSalePrice: state.fixedFutureSalePrice,
      startingLiquidPool: state.cashSavings + shares.netProceeds,
      householdNetMonthly: netMonthly,
      pureLifestyleMonthly: state.pureLifestyleMonthly,
      livingWithParentsMonthly: state.livingWithParentsMonthly,
      scenarioBRepayment: state.scenarioBRepayment,
      savingsReturnRatePct: state.savingsReturnRatePct,
      primaryMarginalRate: householdTax.primary.marginalRateExclMedicare,
      partnerMarginalRate: householdTax.partner.marginalRateExclMedicare,
      primaryFraction,
      monthsUntilGearingReform: monthsUntilGearingReform(now),
      cpiPct: state.annualLivingExpenseCpiPct / 100,
    });
    phase1 = exitResult;
    activePhase1 =
      state.exitScenarioChoice === 'auto'
        ? exitResult.scenarios[exitResult.winnerId]
        : exitResult.scenarios[state.exitScenarioChoice];
  }

  // ------------------------------------------------------------------
  // Step 4 — Purchase case, deposit pool & effective price.
  // ------------------------------------------------------------------
  const otherAssetsIncluded = state.includeOtherAssets ? state.otherAssets : 0;
  let purchaseCase: PurchaseCase;
  let depositPool: number;
  let poolSource: string;
  let futureSavings = null;
  let retainedIpDebt = 0;
  let retainedRentalMonthly = 0;

  const effectivePrice =
    state.futureSimulationEnabled && state.inflateTargetPropertyPrice
      ? state.targetPurchasePrice * Math.pow(1 + state.suburbGrowthPct / 100, N / 12)
      : state.targetPurchasePrice;

  if (!state.futureSimulationEnabled && state.hasExistingProperty) {
    // Case 1 — buying today with an existing property.
    purchaseCase = 1;
    const active = activePhase1!;
    if (active.id === 'A' || active.id === 'C') {
      depositPool = state.cashSavings + shares.netProceeds + otherAssetsIncluded + active.monthZeroSaleNet;
      poolSource = 'Cash + net shares + other assets + existing property net sale proceeds (Month 0)';
    } else if (active.id === 'D') {
      depositPool = state.cashSavings + shares.netProceeds + otherAssetsIncluded + active.usableEquityNow;
      poolSource = 'Cash + net shares + other assets + usable equity (80% LVR) — property retained';
      retainedIpDebt = state.existing.loanBalance;
      const grossRent = state.existing.weeklyRent * (52 / 12);
      const effectiveRent = grossRent * (1 - state.existing.vacancyWeeksPerYear / 52) * (1 - state.existing.pmFeePct);
      const ex = state.existing;
      const monthlyExp =
        ex.strataMonthly + ex.councilMonthly + ex.insuranceMonthly + ex.waterMonthly + ex.utilitiesMonthly +
        ex.maintenanceAnnual / 12;
      retainedRentalMonthly = effectiveRent - monthlyExp - ex.loanBalance * (ex.loanRatePct / 100 / 12);
    } else {
      // Scenario B keeps the property — no sale proceeds available today.
      depositPool = state.cashSavings + shares.netProceeds + otherAssetsIncluded;
      poolSource = 'Liquid assets only (Scenario B retains the existing property)';
      warnings.push(
        'Scenario B keeps the existing home, so no sale proceeds fund this purchase. Choose Scenario A/C (sell) or D (rentvest equity) to include property funds.',
      );
    }
  } else if (state.futureSimulationEnabled && !state.hasExistingProperty) {
    // Case 2 — deferred purchase, no existing property.
    purchaseCase = 2;
    const fs = simulateFutureSavings({
      startingPool: state.cashSavings + shares.netProceeds + otherAssetsIncluded,
      months: N,
      fy: state.fy,
      primaryGross: state.primaryIncome,
      partnerGross: state.partnerIncome,
      primaryHecs: state.primaryHecs,
      partnerHecs: state.partnerHecs,
      hasPrivateHospitalCover: state.hasPrivateHospitalCover,
      dependentChildren: state.dependentChildren,
      livingExpensesMonthly: state.pureLifestyleMonthly,
      savingsReturnRatePct: state.savingsReturnRatePct,
      investmentMode: state.investmentMode,
      etfDividendYieldPct: state.etfDividendYieldPct,
      sharesHeldOver12Months: state.sharesHeldOver12Months,
      annualWageGrowthPct: state.wageGrowthEnabled ? state.annualWageGrowthPct : 0,
      annualCpiPct: state.cpiEnabled ? state.annualLivingExpenseCpiPct : 0,
      targetPrice: state.targetPurchasePrice,
      priceGrowthPct: state.inflateTargetPropertyPrice ? state.suburbGrowthPct : 0,
      primaryMarginalRate: householdTax.primary.marginalRateExclMedicare,
      partnerMarginalRate: householdTax.partner.marginalRateExclMedicare,
      primaryFraction,
    });
    futureSavings = fs;
    depositPool = fs.endingPool;
    poolSource = 'Compounded starting liquid pool + after-tax savings over the holding horizon';
  } else {
    // Case 3 — deferred purchase WITH an existing property: Phase 2
    // REPLACES the starting cash/shares/equity with the exact consolidated
    // ending deployable equity from the active Phase 1 scenario.
    purchaseCase = 3;
    const active = activePhase1!;
    depositPool = active.deployableEquity + otherAssetsIncluded;
    poolSource =
      active.id === 'D'
        ? 'Phase 1 ending: retained property equity (80% LVR usable) + accumulated cash — replaces starting pool'
        : 'Phase 1 ending: net sale proceeds + accumulated after-tax cash — replaces starting pool';
    if (active.id === 'D') {
      retainedIpDebt = state.existing.loanBalance;
      const grossRent = state.existing.weeklyRent * (52 / 12);
      const effectiveRent = grossRent * (1 - state.existing.vacancyWeeksPerYear / 52) * (1 - state.existing.pmFeePct);
      const ex = state.existing;
      const monthlyExp =
        ex.strataMonthly + ex.councilMonthly + ex.insuranceMonthly + ex.waterMonthly + ex.utilitiesMonthly +
        ex.maintenanceAnnual / 12;
      retainedRentalMonthly = effectiveRent - monthlyExp - ex.loanBalance * (ex.loanRatePct / 100 / 12);
    }
  }

  // ------------------------------------------------------------------
  // Step 5 — Deposit, loan, duty, LMI.
  // ------------------------------------------------------------------
  const maxDeposit = Math.max(0, Math.min(depositPool - state.emergencyCashFloor, effectivePrice));
  const baseLoan = Math.max(0, effectivePrice - maxDeposit);
  const duty: StampDutyResult = computeAcquisition({
    purchasePrice: effectivePrice,
    fhabasEnabled: state.fhabas,
    baseLoan,
    lmiCapitalize: state.lmiCapitalize,
    lmiOverride: state.lmiOverride,
    acquisitionCosts: state.acquisitionCosts,
  });

  if (duty.lmiFlagged) {
    warnings.push(
      `LVR ${Math.round(duty.lvr * 100)}% exceeds 80% — estimated LMI $${duty.lmiTotal.toLocaleString()} (${state.lmiCapitalize ? 'capitalised into the loan' : 'payable at settlement'}).`,
    );
  }
  if (depositPool < state.emergencyCashFloor) {
    warnings.push('Liquid pool cannot cover the emergency cash floor — the deposit would dip into your buffer.');
  }
  if (state.familyLoanAmount > 0) {
    warnings.push(
      'Lender assessment: Australian lenders count repayable family loans as a debt commitment (reducing borrowing capacity) unless structured as a non-repayable gift.',
    );
  }

  // The family co-loan is NOT part of the bank loan; it is tracked
  // separately in DTI/APRA and in the mortgage simulator's snowball.
  const bankLoan = duty.totalLoan;

  // ------------------------------------------------------------------
  // Step 6 — Cashflow, surplus optimisation, mortgage simulation.
  // ------------------------------------------------------------------
  const minPI = monthlyPayment(bankLoan, state.loanInterestRatePct, 30);
  const familyLoanMonthly = round2(state.familyLoanAnnualRepayment / 12);
  const targetHoldingCosts = holdingCostsMonthly(state);
  const livingExpenses = state.pureLifestyleMonthly + targetHoldingCosts;

  const finalUnallocatedMonthly = round2(
    netMonthly - livingExpenses - minPI - familyLoanMonthly + retainedRentalMonthly,
  );

  const sweep = state.optimizeSurplus ? Math.max(0, finalUnallocatedMonthly - state.monthlyUnallocatedBuffer) : 0;
  const optimisedExtraMonthly = round2(Math.max(sweep, state.extraMonthlyRepayment));

  const mortgage: MortgageSimResult = simulateMortgage({
    principal: bankLoan,
    annualRatePct: state.loanInterestRatePct,
    termYears: 30,
    extraMonthly: optimisedExtraMonthly,
    offsetInitial: Math.min(state.emergencyCashFloor, Math.max(0, depositPool)),
    offsetMonthlyContribution: state.offsetMonthlyContribution,
    familyLoan: {
      amount: state.familyLoanAmount,
      monthlyRepayment: familyLoanMonthly,
      snowball: state.familyLoanSnowball,
    },
    partnerNetMonthly: householdTax.partner.netMonthly,
    lifeEvents: state.lifeEvents,
    maxMonths: 600,
  });

  if (mortgage.bufferWentNegative) {
    warnings.push('Cash buffer (offset) dipped negative during the simulation — a life event or withdrawal exceeds available cash.');
  }

  // ------------------------------------------------------------------
  // Step 7 — Viability (APRA +3.0%, DTI, stress, cushion).
  // ------------------------------------------------------------------
  const apraRate = state.loanInterestRatePct + 3.0;
  let apraPI = monthlyPayment(bankLoan, apraRate, 30);
  if (retainedIpDebt > 0) {
    const ex = state.existing;
    apraPI += monthlyPayment(retainedIpDebt, ex.loanRatePct + 3.0, Math.max(1, ex.loanTermMonthsRemaining / 12));
  }
  const hecsMonthly = round2((householdTax.householdHecs) / 12);

  const viability: ViabilityResult = {
    ...assessViability({
      householdGrossAnnual: householdTax.householdGross,
      householdNetMonthly: netMonthly,
      totalBankDebt: bankLoan + retainedIpDebt + state.familyLoanAmount,
      minMonthlyPI: minPI,
      apraMonthlyPI: apraPI,
      hecsMonthly,
      familyLoanMonthly,
      livingExpensesMonthly: livingExpenses,
      apraBufferPct: 3.0,
      retainedRentalMonthly,
    }),
    apraAssessmentRatePct: apraRate,
  };

  // ------------------------------------------------------------------
  // Step 8 — Rate sensitivity (low / primary / high).
  // ------------------------------------------------------------------
  const n30 = 30 * 12;
  const retainedIpApraPI =
    retainedIpDebt > 0
      ? monthlyPayment(retainedIpDebt, state.existing.loanRatePct + 3.0, Math.max(1, state.existing.loanTermMonthsRemaining / 12))
      : 0;
  const rateRow = (label: string, ratePct: number): RateSensitivityRow => {
    const pi = monthlyPayment(bankLoan, ratePct, 30);
    const totalInterest = round2(Math.max(0, pi * n30 - bankLoan));
    const apraPi = monthlyPayment(bankLoan, ratePct + 3.0, 30) + retainedIpApraPI;
    const surplus = netMonthly - livingExpenses + retainedRentalMonthly - apraPi - hecsMonthly - familyLoanMonthly;
    const apraStatus: 'pass' | 'marginal' | 'fail' =
      surplus >= 0 ? 'pass' : surplus >= -0.1 * netMonthly ? 'marginal' : 'fail';
    return {
      label,
      ratePct,
      monthlyPI: pi,
      totalLifetimeInterest: totalInterest,
      apraStatus,
      deltaVsPrimaryMonthly: round2(pi - minPI),
      deltaVsPrimaryInterest: round2(totalInterest - (minPI * n30 - bankLoan)),
    };
  };
  const rateSensitivity: RateSensitivityRow[] = [
    rateRow('Low Rate', Math.max(0, state.loanInterestRatePct - 1.0)),
    rateRow('Primary Rate', state.loanInterestRatePct),
    rateRow('High Rate', state.loanInterestRatePct + 1.0),
  ];

  // ------------------------------------------------------------------
  // Step 9 — 30-year equity curve.
  // ------------------------------------------------------------------
  const equityCurve: EquityCurvePoint[] = [];
  for (let year = 0; year <= 30; year++) {
    const m = year * 12;
    const row = mortgage.rows.find((x) => x.month === m);
    const pv = effectivePrice * Math.pow(1 + state.suburbGrowthPct / 100, year);
    const stdBal = row ? row.standardBalance : bankLoan;
    const accBal = row ? row.acceleratedBalance : bankLoan;
    equityCurve.push({
      year,
      propertyValue: round2(pv),
      standardBalance: stdBal,
      acceleratedBalance: accBal,
      standardEquity: round2(pv - stdBal),
      acceleratedEquity: round2(pv - accBal),
      offsetBalance: row ? row.offsetBalance : Math.min(state.emergencyCashFloor, Math.max(0, depositPool)),
    });
  }

  return {
    householdTax,
    shares,
    phase1,
    activePhase1,
    futureSavings,
    purchase: {
      case: purchaseCase,
      effectivePrice: round2(effectivePrice),
      duty,
      depositPool: round2(depositPool),
      deposit: round2(maxDeposit),
      baseLoan: round2(baseLoan),
      totalLoan: round2(bankLoan),
      lvr: duty.lvr,
      cashRequiredAtSettlement: duty.cashRequiredAtSettlement,
      poolShortfall: round2(Math.max(0, state.emergencyCashFloor - depositPool)),
      poolSource,
    },
    mortgage,
    viability,
    rateSensitivity,
    equityCurve,
    optimisedExtraMonthly,
    finalUnallocatedMonthly,
    warnings,
  };
}
