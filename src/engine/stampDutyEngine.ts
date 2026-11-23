/**
 * NSW Transfer (Stamp) Duty engine — FY 2026-27 Revenue NSW schedule with
 * the "per $100 or part thereof" rule, FHBAS concession, itemised
 * acquisition costs and a banded LMI estimator (incl. 9% NSW duty on LMI).
 *
 * Duty is ALWAYS computed dynamically against the actual (or inflated
 * future) purchase price — never a hardcoded benchmark.
 */

import {
  FHBAS_FREE_CEILING,
  FHBAS_FULL_CEILING,
  LMI_BANDS,
  LMI_STAMP_DUTY_RATE,
  NSW_DUTY_MINIMUM,
  NSW_TRANSFER_DUTY_TIERS,
} from '../data/nswDutyAndLandTax';
import type { AcquisitionCosts, StampDutyInput, StampDutyResult } from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Gross NSW transfer duty for a residential property price (FY 2026-27). */
export function nswTransferDuty(price: number): number {
  if (price <= 0) return 0;
  for (const tier of NSW_TRANSFER_DUTY_TIERS) {
    if (price <= tier.to) {
      if (tier.from === 0) {
        return Math.max(NSW_DUTY_MINIMUM, Math.ceil(price / 100) * tier.ratePer100);
      }
      return round2(tier.base + Math.ceil((price - tier.from + 1) / 100) * tier.ratePer100);
    }
  }
  return 0;
}

/**
 * FHBAS-concessional duty: $0 up to $800k, linear phase-in to full duty
 * between $800,001 and $999,999, full duty at/above $1,000,000.
 */
export function fhabasConcessionalDuty(price: number): number {
  if (price <= FHBAS_FREE_CEILING) return 0;
  if (price >= FHBAS_FULL_CEILING) return nswTransferDuty(price);
  const fullDuty = nswTransferDuty(price);
  return round2(fullDuty * ((price - FHBAS_FREE_CEILING) / (FHBAS_FULL_CEILING - FHBAS_FREE_CEILING)));
}

/** Banded LMI premium estimate for a loan amount at a given LVR. */
export function lmiEstimate(loanAmount: number, lvr: number): { premium: number; bandLabel: string } {
  if (loanAmount <= 0 || lvr <= 0.8) return { premium: 0, bandLabel: '' };
  const band = LMI_BANDS.find((b) => lvr >= b.minLvr && lvr < b.maxLvr) ?? LMI_BANDS[LMI_BANDS.length - 1];
  return { premium: round2(loanAmount * band.premiumOfLoan), bandLabel: band.label };
}

/**
 * Full acquisition computation: duty (with FHBAS), LVR, LMI (banded or
 * overridden, capitalised or upfront) and cash required at settlement.
 */
export function computeAcquisition(input: StampDutyInput): StampDutyResult {
  const { purchasePrice, fhabasEnabled, baseLoan, lmiCapitalize, lmiOverride, acquisitionCosts } = input;

  const grossDuty = nswTransferDuty(purchasePrice);
  const fhabasConcession = fhabasEnabled ? round2(grossDuty - fhabasConcessionalDuty(purchasePrice)) : 0;
  const netDuty = round2(grossDuty - fhabasConcession);

  const lvr = purchasePrice > 0 ? baseLoan / purchasePrice : 0;
  const banded = lmiEstimate(baseLoan, lvr);
  const lmiPremium = lmiOverride !== null && lmiOverride >= 0 ? round2(lmiOverride) : banded.premium;
  const lmiStampDuty = round2(lmiPremium * LMI_STAMP_DUTY_RATE);
  const lmiTotal = round2(lmiPremium + lmiStampDuty);
  const lmiFlagged = lvr > 0.8 && lmiTotal > 0;

  const totalAcquisitionCosts = round2(
    acquisitionCosts.conveyancing +
      acquisitionCosts.buildingPestStrata +
      acquisitionCosts.pexaTitleMortgage +
      acquisitionCosts.councilWaterMisc,
  );

  const totalLoan = round2(baseLoan + (lmiCapitalize ? lmiTotal : 0));
  const cashRequiredAtSettlement = round2(
    Math.max(0, purchasePrice - baseLoan) + netDuty + (lmiCapitalize ? 0 : lmiTotal) + totalAcquisitionCosts,
  );

  return {
    purchasePrice: round2(purchasePrice),
    grossDuty,
    fhabasConcession,
    netDuty,
    lvr,
    lmiBandLabel: lmiFlagged ? banded.bandLabel : null,
    lmiPremium,
    lmiStampDuty,
    lmiTotal,
    lmiFlagged,
    totalAcquisitionCosts,
    cashRequiredAtSettlement,
    totalLoan,
  };
}

/** NSW Land Tax on unimproved land value (FY 2026-27). */
export function nswLandTax(unimprovedLandValue: number): number {
  if (unimprovedLandValue <= 1_075_000) return 0;
  if (unimprovedLandValue <= 6_571_000) {
    return round2(100 + (unimprovedLandValue - 1_075_000) * 0.016);
  }
  return round2(88_036 + (unimprovedLandValue - 6_571_000) * 0.02);
}
