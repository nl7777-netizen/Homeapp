/**
 * Financial Viability Assessment & Banking KPIs.
 *
 * Four core KPIs: DTI (incl. retained IP debt + family co-loan),
 * Repayment Stress Ratio, APRA +3.0% serviceability check (Pass /
 * Marginal / Fail with surplus/shortfall) and Monthly Surplus Cushion.
 * Produces an overall rating (Secure / Caution / High Risk) with
 * actionable explanation bullets.
 */

import type { ViabilityInput, ViabilityResult } from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function assessViability(input: ViabilityInput): ViabilityResult {
  const {
    householdGrossAnnual,
    householdNetMonthly,
    totalBankDebt,
    minMonthlyPI,
    apraMonthlyPI,
    hecsMonthly,
    familyLoanMonthly,
    livingExpensesMonthly,
    apraBufferPct,
    retainedRentalMonthly,
  } = input;

  // 1. Debt-to-Income.
  const dti = householdGrossAnnual > 0 ? totalBankDebt / householdGrossAnnual : 0;
  const dtiStatus: 'ok' | 'tight' | 'high' = dti >= 6.0 ? 'high' : dti >= 4.5 ? 'tight' : 'ok';

  // 2. Repayment stress ratio.
  const repaymentStress = householdNetMonthly > 0 ? minMonthlyPI / householdNetMonthly : 1;
  const stressStatus: 'ok' | 'tight' | 'high' =
    repaymentStress >= 0.45 ? 'high' : repaymentStress >= 0.3 ? 'tight' : 'ok';

  // 3. APRA serviceability at primary + buffer.
  const available = householdNetMonthly - livingExpensesMonthly + retainedRentalMonthly;
  const required = apraMonthlyPI + hecsMonthly + familyLoanMonthly;
  const apraSurplus = round2(available - required);
  const apraStatus: 'pass' | 'marginal' | 'fail' =
    apraSurplus >= 0 ? 'pass' : apraSurplus >= -0.1 * householdNetMonthly ? 'marginal' : 'fail';

  // 4. Monthly surplus cushion at the primary rate.
  const surplusCushion = round2(
    householdNetMonthly - livingExpensesMonthly - minMonthlyPI - hecsMonthly - familyLoanMonthly + retainedRentalMonthly,
  );

  // Overall rating.
  let rating: ViabilityResult['rating'] = 'secure';
  if (dtiStatus === 'high' || apraStatus === 'fail' || stressStatus === 'high') rating = 'high';
  else if (dtiStatus === 'tight' || apraStatus === 'marginal' || stressStatus === 'tight') rating = 'caution';

  const explanations: string[] = [];
  if (dtiStatus === 'high') {
    explanations.push(`DTI of ${dti.toFixed(2)}x is at/above 6.0x — lenders will likely cap borrowing capacity.`);
  } else if (dtiStatus === 'tight') {
    explanations.push(`DTI of ${dti.toFixed(2)}x is at/above 4.5x — expect tighter lending criteria.`);
  } else {
    explanations.push(`DTI of ${dti.toFixed(2)}x is within typical lender comfort (< 4.5x).`);
  }
  if (stressStatus === 'high') {
    explanations.push(`Min P&I is ${Math.round(repaymentStress * 100)}% of net income (>= 45%) — high housing stress.`);
  } else if (stressStatus === 'tight') {
    explanations.push(`Min P&I is ${Math.round(repaymentStress * 100)}% of net income (>= 30%) — monitor cashflow.`);
  } else {
    explanations.push(`Min P&I is ${Math.round(repaymentStress * 100)}% of net income — below the 30% stress benchmark.`);
  }
  if (apraStatus === 'fail') {
    explanations.push(
      `APRA +${apraBufferPct.toFixed(1)}% stress test FAILS by $${Math.abs(apraSurplus).toLocaleString()}/mo — reduce the loan or increase income.`,
    );
  } else if (apraStatus === 'marginal') {
    explanations.push(
      `APRA +${apraBufferPct.toFixed(1)}% stress test is MARGINAL (shortfall $${Math.abs(apraSurplus).toLocaleString()}/mo).`,
    );
  } else {
    explanations.push(
      `APRA +${apraBufferPct.toFixed(1)}% stress test PASSES with $${apraSurplus.toLocaleString()}/mo surplus.`,
    );
  }
  if (surplusCushion < 0) {
    explanations.push(`Monthly cashflow is NEGATIVE $${Math.abs(surplusCushion).toLocaleString()} at the primary rate — the plan does not close.`);
  } else {
    explanations.push(`Monthly surplus cushion of $${surplusCushion.toLocaleString()} remains after all obligations.`);
  }
  if (familyLoanMonthly > 0) {
    explanations.push(`Family co-loan repayment ($${familyLoanMonthly.toLocaleString()}/mo) is counted as a debt commitment — lenders may reduce borrowing capacity unless structured as a non-repayable gift.`);
  }

  return {
    dti: round2(dti * 100) / 100,
    dtiStatus,
    repaymentStress: round2(repaymentStress * 1000) / 1000,
    stressStatus,
    apraStatus,
    apraSurplus,
    apraAssessmentRatePct: 0, // set by caller for display
    surplusCushion,
    rating,
    explanations,
  };
}
