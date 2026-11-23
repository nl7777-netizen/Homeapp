/**
 * Deferred purchase compounding engine (Phase 2 Future Mode, no existing
 * property). Compounds the starting liquid pool plus after-tax monthly
 * savings over the holding horizon with:
 *  - annual wage growth (household tax recomputed each year via the tax
 *    engine, so brackets/Medicare/MLS stay exact),
 *  - annual CPI growth on living expenses,
 *  - differentiated investment return tax:
 *      HISA/Cash: interest taxed annually at marginal rate + Medicare;
 *      ETF/Shares: only the dividend yield taxed annually at the marginal
 *      rate; capital growth deferred to liquidation at purchase date with
 *      the 50% CGT discount when held > 12 months.
 */

import { computeHouseholdTax } from './taxEngine';
import type { FutureSavingsInput, FutureSavingsResult } from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function simulateFutureSavings(input: FutureSavingsInput): FutureSavingsResult {
  const {
    startingPool,
    months,
    savingsReturnRatePct,
    investmentMode,
    etfDividendYieldPct,
    sharesHeldOver12Months,
    annualWageGrowthPct,
    annualCpiPct,
    targetPrice,
    priceGrowthPct,
    primaryFraction,
  } = input;

  const r = savingsReturnRatePct / 100 / 12;
  const dy = etfDividendYieldPct / 100 / 12;
  const weightedMarginal =
    primaryFraction * input.primaryMarginalRate + (1 - primaryFraction) * input.partnerMarginalRate;
  const medicareRate = 0.02;

  let pool = startingPool;
  let totalTax = 0;
  let totalDividends = 0;
  let totalSavings = 0;
  let yearInterest = 0;
  let yearDividends = 0;
  let year = 0;
  const path: { month: number; pool: number; targetPrice: number }[] = [];

  const priceAt = (m: number): number => targetPrice * Math.pow(1 + priceGrowthPct / 100, m / 12);

  path.push({ month: 0, pool: round2(pool), targetPrice: round2(priceAt(0)) });

  for (let m = 1; m <= months; m++) {
    // Yearly recompute of after-tax income (wage growth) & expenses (CPI).
    if (m % 12 === 1) {
      year = Math.floor((m - 1) / 12);
    }
    const wageFactor = Math.pow(1 + annualWageGrowthPct / 100, year);
    const cpiFactor = Math.pow(1 + annualCpiPct / 100, year);

    const householdNet = computeHouseholdTax({
      fy: input.fy,
      primary: { grossAnnualIncome: input.primaryGross * wageFactor, hasHecsDebt: input.primaryHecs },
      partner: { grossAnnualIncome: input.partnerGross * wageFactor, hasHecsDebt: input.partnerHecs },
      hasPrivateHospitalCover: input.hasPrivateHospitalCover,
      dependentChildren: input.dependentChildren,
    }).netMonthly;

    const expenses = input.livingExpensesMonthly * cpiFactor;
    const savings = householdNet - expenses;

    // Investment growth.
    if (investmentMode === 'hisa') {
      const interest = pool * r;
      pool += interest;
      yearInterest += interest;
    } else {
      // ETF: total return accrues; dividends are the taxable portion.
      const growth = pool * r;
      const dividend = pool * dy;
      pool += growth;
      yearDividends += dividend;
      totalDividends += dividend;
    }

    pool += savings;
    totalSavings += savings;

    // Annual tax events.
    if (m % 12 === 0) {
      if (investmentMode === 'hisa') {
        const tax = yearInterest * (weightedMarginal + medicareRate);
        pool -= tax;
        totalTax += tax;
        yearInterest = 0;
      } else {
        const tax = yearDividends * weightedMarginal;
        pool -= tax;
        totalTax += tax;
        yearDividends = 0;
      }
    }

    if (m % 12 === 0 || m === months) {
      path.push({ month: m, pool: round2(pool), targetPrice: round2(priceAt(m)) });
    }
  }

  // ETF: capital gains taxed at liquidation (purchase date) with 50% discount.
  if (investmentMode === 'etf') {
    const capitalGain = Math.max(0, pool - startingPool - totalSavings - totalDividends);
    const taxable = sharesHeldOver12Months ? capitalGain * 0.5 : capitalGain;
    const cgt = taxable * weightedMarginal;
    pool -= cgt;
    totalTax += cgt;
  }

  const preTaxGains = round2(pool + totalTax - startingPool - totalSavings);
  const netAfterTaxGains = round2(pool - startingPool - totalSavings);

  return {
    endingPool: round2(pool),
    preTaxGains,
    taxPaid: round2(totalTax),
    netAfterTaxGains,
    futureTargetPrice: round2(priceAt(months)),
    months,
    path,
  };
}
