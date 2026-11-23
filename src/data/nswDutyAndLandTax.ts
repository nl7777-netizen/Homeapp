/**
 * NSW Revenue constants — FY 2026-27 Transfer (Stamp) Duty schedule,
 * First Home Buyer Assistance Scheme (FHBAS) and NSW Land Tax thresholds.
 *
 * Transfer duty uses the "per $100 or part thereof" rule:
 * `Math.ceil((price - threshold) / 100) * ratePer100`.
 */

export interface DutyTier {
  from: number;
  to: number;
  base: number;
  ratePer100: number;
}

/** FY 2026-27 NSW residential transfer duty tiers (Revenue NSW). */
export const NSW_TRANSFER_DUTY_TIERS: DutyTier[] = [
  { from: 0, to: 18_000, base: 0, ratePer100: 1.25 },
  { from: 18_001, to: 38_000, base: 225, ratePer100: 1.5 },
  { from: 38_001, to: 103_000, base: 525, ratePer100: 1.75 },
  { from: 103_001, to: 387_000, base: 1_662, ratePer100: 3.5 },
  { from: 387_001, to: 1_290_000, base: 11_602, ratePer100: 4.5 },
  { from: 1_290_001, to: 3_870_000, base: 52_237, ratePer100: 5.5 },
  { from: 3_870_001, to: Infinity, base: 194_137, ratePer100: 7.0 },
];

/** Minimum duty on the lowest tier (Revenue NSW charges at least $20). */
export const NSW_DUTY_MINIMUM = 20;

/** FHBAS: $0 duty up to this price. */
export const FHBAS_FREE_CEILING = 800_000;
/** FHBAS: full duty from this price; linear phase-in between the two. */
export const FHBAS_FULL_CEILING = 1_000_000;

/** NSW Land Tax (unimproved land value). */
export const LAND_TAX_THRESHOLD = 1_075_000;
export const LAND_TAX_BASE = 100;
export const LAND_TAX_RATE_1 = 0.016;
export const LAND_TAX_THRESHOLD_2 = 6_571_000;
export const LAND_TAX_BASE_2 = 88_036;
export const LAND_TAX_RATE_2 = 0.02;

/** NSW stamp duty on LMI premiums. */
export const LMI_STAMP_DUTY_RATE = 0.09;

/**
 * Tiered Australian LMI premium estimate as a fraction of the loan amount,
 * by LVR band. Realistic mid-market lender pricing (indicative only).
 */
export interface LmiBand {
  label: string;
  minLvr: number; // inclusive
  maxLvr: number; // exclusive (Infinity for the top band)
  premiumOfLoan: number;
}

export const LMI_BANDS: LmiBand[] = [
  { label: '80–85% LVR', minLvr: 0.8, maxLvr: 0.85, premiumOfLoan: 0.0175 },
  { label: '85–88% LVR', minLvr: 0.85, maxLvr: 0.88, premiumOfLoan: 0.021 },
  { label: '88–90% LVR', minLvr: 0.88, maxLvr: 0.9, premiumOfLoan: 0.025 },
  { label: '90–92% LVR', minLvr: 0.9, maxLvr: 0.92, premiumOfLoan: 0.03 },
  { label: '92–95% LVR', minLvr: 0.92, maxLvr: 0.95, premiumOfLoan: 0.0375 },
  { label: '95%+ LVR', minLvr: 0.95, maxLvr: Infinity, premiumOfLoan: 0.045 },
];

/** Default itemised NSW acquisition costs (editable in the UI). */
export const DEFAULT_ACQUISITION_COSTS = {
  conveyancing: 1_800,
  buildingPestStrata: 800,
  pexaTitleMortgage: 550,
  councilWaterMisc: 650,
} as const;

export const DEFAULT_ACQUISITION_TOTAL =
  DEFAULT_ACQUISITION_COSTS.conveyancing +
  DEFAULT_ACQUISITION_COSTS.buildingPestStrata +
  DEFAULT_ACQUISITION_COSTS.pexaTitleMortgage +
  DEFAULT_ACQUISITION_COSTS.councilWaterMisc; // $3,800
