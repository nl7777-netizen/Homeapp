/**
 * Australian personal income tax engine.
 * Pure, deterministic functions: resident income tax (4 FY tables),
 * Medicare Levy with low-income shade-in + family reduction, Medicare Levy
 * Surcharge (single/family tiers), HECS/HELP marginal repayment and the
 * Working Australians Tax Offset (WATO, 2027-28).
 */

import { getTable, type YearTaxTable } from '../data/taxTables';
import type {
  HouseholdTaxInput,
  HouseholdTaxResult,
  PartnerTaxInput,
  PartnerTaxResult,
} from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Resident income tax payable (before offsets) for a financial year. */
export function incomeTaxForYear(fy: string, taxableIncome: number, custom: Record<string, YearTaxTable> = {}): number {
  const table = getTable(fy, custom);
  if (taxableIncome <= 0) return 0;
  for (const br of table.brackets) {
    if (taxableIncome <= br.to) {
      return round2(br.baseTax + (taxableIncome - br.from) * br.rate);
    }
  }
  const top = table.brackets[table.brackets.length - 1];
  return round2(top.baseTax + (taxableIncome - top.from) * top.rate);
}

/** Marginal income tax rate (excl. Medicare) at a given income. */
export function marginalRate(fy: string, income: number, custom: Record<string, YearTaxTable> = {}): number {
  const table = getTable(fy, custom);
  for (const br of table.brackets) {
    if (income <= br.to) return br.rate;
  }
  return table.brackets[table.brackets.length - 1].rate;
}

/**
 * Medicare Levy (2%) with individual low-income shade-in and family
 * reduction. `combinedIncome` is the household total; family logic only
 * applies when `isFamily` is true.
 */
export function medicareLevy(
  income: number,
  isFamily: boolean,
  combinedIncome: number,
  dependentChildren: number,
  fy: string,
  custom: Record<string, YearTaxTable> = {},
): number {
  const m = getTable(fy, custom).medicare;
  if (income <= 0) return 0;

  if (isFamily) {
    const lower = m.familyLowerBase + dependentChildren * m.familyLowerPerChild;
    const upper = m.familyUpperBase + dependentChildren * m.familyUpperPerChild;
    if (combinedIncome <= lower) return 0;
    if (combinedIncome <= upper) {
      // Shade-in across the family band, apportioned by income share.
      const share = combinedIncome > 0 ? income / combinedIncome : 0;
      const familyShade = (combinedIncome - lower) * m.familyShadeRate * share;
      return round2(Math.min(income * m.rate, familyShade));
    }
  }

  if (income <= m.individualLower) return 0;
  if (income <= m.individualUpper) {
    return round2(Math.min(income * 0.02, (income - m.individualLower) * 0.1));
  }
  return round2(income * m.rate);
}

/**
 * Medicare Levy Surcharge for one adult.
 * Family tiers use combined family income (each dependent child after the
 * first lifts thresholds by $1,500). A partner earning at/below the
 * exempt income pays $0 even when the family tier is non-zero.
 * Returns { mls, rate, isSingle }.
 */
export function medicareLevySurcharge(
  income: number,
  isSingle: boolean,
  combinedIncome: number,
  dependentChildren: number,
  partnerIncome: number,
  fy: string,
  custom: Record<string, YearTaxTable> = {},
): { mls: number; rate: number } {
  const t = getTable(fy, custom).mls;
  if (income <= 0) return { mls: 0, rate: 0 };

  let rate: number;
  if (isSingle) {
    const tier = t.singleTiers.find((x) => income <= x.upTo) ?? t.singleTiers[t.singleTiers.length - 1];
    rate = tier.rate;
  } else {
    const thresholdLift = Math.max(0, dependentChildren - 1) * t.familyPerChildAfterFirst;
    const tier =
      t.familyTiers.find((x) => combinedIncome <= x.upTo + thresholdLift) ??
      t.familyTiers[t.familyTiers.length - 1];
    rate = tier.rate;
    // Low-earning partner exemption in a couple.
    if (partnerIncome > 0 && income <= t.partnerExemptIncome && partnerIncome > t.partnerExemptIncome) {
      rate = 0;
    }
  }
  return { mls: round2(income * rate), rate };
}

/** HECS/HELP compulsory repayment (marginal system). */
export function hecsRepayment(fy: string, income: number, custom: Record<string, YearTaxTable> = {}): number {
  const table = getTable(fy, custom);
  if (income <= 0) return 0;
  for (const br of table.hecs) {
    if (income <= br.to) {
      if (br.flatPctOfIncome) return round2(br.rate * income);
      return round2(br.baseRepayment + (income - br.from) * br.rate);
    }
  }
  const top = table.hecs[table.hecs.length - 1];
  return top.flatPctOfIncome ? round2(top.rate * income) : round2(top.baseRepayment + (income - top.from) * top.rate);
}

/** Working Australians Tax Offset (2027-28): up to $250, income > $18,200. */
export function watoOffset(fy: string, income: number, custom: Record<string, YearTaxTable> = {}): number {
  const t = getTable(fy, custom);
  if (t.watoMax <= 0) return 0;
  if (income <= t.watoThreshold) return 0;
  return t.watoMax;
}

export interface PartnerTaxContext {
  fy: string;
  isFamily: boolean;
  combinedIncome: number;
  dependentChildren: number;
  isSingleMls: boolean;
  hasPrivateHospitalCover: boolean;
  partnerIncome: number;
  custom: Record<string, YearTaxTable>;
}

/** Full tax computation for one partner given the household context. */
export function computePartnerTax(input: PartnerTaxInput, ctx: PartnerTaxContext): PartnerTaxResult {
  const gross = Math.max(0, input.grossAnnualIncome);
  let incomeTax = incomeTaxForYear(ctx.fy, gross, ctx.custom);
  const wato = watoOffset(ctx.fy, gross, ctx.custom);
  incomeTax = Math.max(0, incomeTax - wato);
  const medicare = medicareLevy(gross, ctx.isFamily, ctx.combinedIncome, ctx.dependentChildren, ctx.fy, ctx.custom);
  const mls = ctx.hasPrivateHospitalCover
    ? { mls: 0, rate: 0 }
    : medicareLevySurcharge(gross, ctx.isSingleMls, ctx.combinedIncome, ctx.dependentChildren, ctx.partnerIncome, ctx.fy, ctx.custom);
  const hecs = input.hasHecsDebt ? hecsRepayment(ctx.fy, gross, ctx.custom) : 0;

  const totalTax = round2(incomeTax + medicare + mls.mls + hecs);
  const netPay = round2(gross - totalTax);
  const margExcl = marginalRate(ctx.fy, gross, ctx.custom);

  return {
    gross: round2(gross),
    incomeTax: round2(incomeTax),
    medicareLevy: medicare,
    mls: mls.mls,
    hecs,
    wato,
    totalTax,
    netPay,
    netMonthly: round2(netPay / 12),
    marginalRateExclMedicare: margExcl,
    marginalRateInclMedicare: Math.min(1, margExcl + 0.02),
    effectiveRate: gross > 0 ? totalTax / gross : 0,
  };
}

/**
 * Share portfolio liquidation CGT estimate.
 * Gain = value - cost base; 50% discount when held > 12 months; taxed at
 * the weighted marginal rate of the legal owners (no Medicare on CGT).
 */
export function computeShareCgt(input: {
  portfolioValue: number;
  costBase: number;
  heldOver12Months: boolean;
  primaryFraction: number;
  primaryMarginalRate: number;
  partnerMarginalRate: number;
}): {
  grossGain: number;
  discountApplied: boolean;
  taxableGain: number;
  cgtTax: number;
  netProceeds: number;
} {
  const grossGain = Math.max(0, input.portfolioValue - input.costBase);
  const discountApplied = input.heldOver12Months && grossGain > 0;
  const taxableGain = discountApplied ? grossGain * 0.5 : grossGain;
  const weightedRate =
    input.primaryFraction * input.primaryMarginalRate + (1 - input.primaryFraction) * input.partnerMarginalRate;
  const cgtTax = round2(taxableGain * weightedRate);
  return {
    grossGain: round2(grossGain),
    discountApplied,
    taxableGain: round2(taxableGain),
    cgtTax,
    netProceeds: round2(input.portfolioValue - cgtTax),
  };
}

/** Household-level tax computation for both partners. */
export function computeHouseholdTax(input: HouseholdTaxInput, custom: Record<string, YearTaxTable> = {}): HouseholdTaxResult {
  const primary = input.primary;
  const partner = input.partner;
  const combined = Math.max(0, primary.grossAnnualIncome) + Math.max(0, partner.grossAnnualIncome);

  // Single for MLS purposes: one earner with $0 partner income.
  const isSingleMls = partner.grossAnnualIncome === 0;
  const isFamily = !isSingleMls;

  const ctx: PartnerTaxContext = {
    fy: input.fy,
    isFamily,
    combinedIncome: combined,
    dependentChildren: input.dependentChildren,
    isSingleMls,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
    partnerIncome: partner.grossAnnualIncome,
    custom,
  };

  const p = computePartnerTax(primary, ctx);
  const ctxPartner: PartnerTaxContext = { ...ctx, partnerIncome: primary.grossAnnualIncome };
  const q = computePartnerTax(partner, ctxPartner);

  const householdGross = round2(p.gross + q.gross);
  const householdNet = round2(p.netPay + q.netPay);
  const mlsApplied = !input.hasPrivateHospitalCover && p.mls + q.mls > 0;

  return {
    fy: input.fy,
    primary: p,
    partner: q,
    householdGross,
    householdIncomeTax: round2(p.incomeTax + q.incomeTax),
    householdMedicare: round2(p.medicareLevy + q.medicareLevy),
    householdMls: round2(p.mls + q.mls),
    householdHecs: round2(p.hecs + q.hecs),
    householdWato: round2(p.wato + q.wato),
    householdTotalTax: round2(p.totalTax + q.totalTax),
    householdNet,
    netMonthly: round2(householdNet / 12),
    netFortnightly: round2(householdNet / 26),
    netWeekly: round2(householdNet / 52),
    mlsApplied,
    mlsRate: isSingleMls ? q.mls : Math.max(p.mls, q.mls) > 0 ? (p.mls + q.mls) / Math.max(1, combined) : 0,
    isSingleMls,
  };
}
