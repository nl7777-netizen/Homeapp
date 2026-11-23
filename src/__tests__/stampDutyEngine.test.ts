import { describe, expect, it } from 'vitest';
import {
  computeAcquisition,
  fhabasConcessionalDuty,
  lmiEstimate,
  nswLandTax,
  nswTransferDuty,
} from '../engine/stampDutyEngine';
import { DEFAULT_ACQUISITION_COSTS } from '../data/nswDutyAndLandTax';

describe('NSW Transfer Duty — FY 2026-27 exact worked examples', () => {
  it('$450,000 -> $14,437 (11,602 + ceil(63,000/100) x 4.50)', () => {
    expect(nswTransferDuty(450_000)).toBe(14_437);
  });

  it('$1,350,000 -> $55,537 (52,237 + 600 x 5.50)', () => {
    expect(nswTransferDuty(1_350_000)).toBe(55_537);
  });

  it('$4,000,000 -> $203,237 (194,137 + 1,300 x 7.00) — premium residential tier', () => {
    expect(nswTransferDuty(4_000_000)).toBe(203_237);
  });

  it('$10,000 -> minimum $20 (max(20, ceil(100) x 1.25 = 125) is 125; check low tier)', () => {
    // ceil(10,000/100) = 100 x 1.25 = 125 -> above the $20 minimum
    expect(nswTransferDuty(10_000)).toBe(125);
  });

  it('$500 -> $20 minimum duty floor', () => {
    expect(nswTransferDuty(500)).toBe(20);
  });

  it('tier boundary: $18,001 -> 225 + 1.50 = $226.50', () => {
    expect(nswTransferDuty(18_001)).toBe(226.5);
  });

  it('duty updates dynamically when the purchase price changes', () => {
    const d1 = nswTransferDuty(800_000);
    const d2 = nswTransferDuty(1_100_000);
    const d3 = nswTransferDuty(1_400_000);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
    // Exact recomputation:
    // 800,000 -> 11,602 + ceil(413,000/100=4,130) x 4.5 = 30,187
    expect(d1).toBe(11_602 + 4_130 * 4.5);
    // 1,100,000 -> 11,602 + ceil(713,000/100=7,130) x 4.5 = 43,687
    expect(d2).toBe(11_602 + 7_130 * 4.5);
    // 1,400,000 -> 52,237 + ceil(110,000/100=1,100) x 5.5 = 58,287
    expect(d3).toBe(52_237 + 1_100 * 5.5);
  });
});

describe('FHBAS concession', () => {
  it('$0 duty at or below $800,000', () => {
    expect(fhabasConcessionalDuty(800_000)).toBe(0);
    expect(fhabasConcessionalDuty(500_000)).toBe(0);
  });

  it('linear phase-in between $800,001 and $999,999 (midpoint $900k = 50% of full duty)', () => {
    const full = nswTransferDuty(900_000);
    expect(fhabasConcessionalDuty(900_000)).toBeCloseTo(full * 0.5, 0);
  });

  it('full duty at/above $1,000,000', () => {
    expect(fhabasConcessionalDuty(1_000_000)).toBe(nswTransferDuty(1_000_000));
  });
});

describe('LMI estimation', () => {
  it('LVR <= 80% -> no LMI', () => {
    expect(lmiEstimate(500_000, 0.8).premium).toBe(0);
    expect(lmiEstimate(500_000, 0.75).premium).toBe(0);
  });

  it('80-85% band: $500k loan @ 82.5% -> 1.75% of loan = $8,750', () => {
    const { premium, bandLabel } = lmiEstimate(500_000, 0.825);
    expect(premium).toBe(8_750);
    expect(bandLabel).toBe('80–85% LVR');
  });

  it('92-95% band: $500k loan @ 93% -> 3.75% of loan = $18,750', () => {
    expect(lmiEstimate(500_000, 0.93).premium).toBe(18_750);
  });

  it('computeAcquisition flags LMI above 80% LVR and adds 9% NSW duty on the premium', () => {
    const r = computeAcquisition({
      purchasePrice: 1_000_000,
      fhabasEnabled: false,
      baseLoan: 890_000, // 89% LVR -> 88-90% band
      lmiCapitalize: true,
      lmiOverride: null,
      acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    });
    expect(r.lvr).toBeCloseTo(0.89, 5);
    expect(r.lmiFlagged).toBe(true);
    // 88-90% band -> 2.5% of 890,000 = 22,250; +9% duty = 2,002.50 -> total 24,252.50
    expect(r.lmiPremium).toBe(22_250);
    expect(r.lmiStampDuty).toBe(2_002.5);
    expect(r.lmiTotal).toBe(24_252.5);
    expect(r.totalLoan).toBe(890_000 + 24_252.5);
  });

  it('custom LMI override replaces the banded estimate', () => {
    const r = computeAcquisition({
      purchasePrice: 1_000_000,
      fhabasEnabled: false,
      baseLoan: 900_000,
      lmiCapitalize: false,
      lmiOverride: 15_000,
      acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    });
    expect(r.lmiPremium).toBe(15_000);
    expect(r.totalLoan).toBe(900_000); // not capitalised
  });
});

describe('Acquisition cash required at settlement', () => {
  it('deposit + duty + costs (no LMI at 80% LVR)', () => {
    const r = computeAcquisition({
      purchasePrice: 1_000_000,
      fhabasEnabled: false,
      baseLoan: 800_000,
      lmiCapitalize: true,
      lmiOverride: null,
      acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    });
    // 200,000 deposit + duty (11,602 + ceil(613,000/100=6,130)x4.5=27,187) + 3,800 costs
    expect(r.netDuty).toBe(11_602 + 6_130 * 4.5);
    expect(r.totalAcquisitionCosts).toBe(3_800);
    expect(r.cashRequiredAtSettlement).toBe(200_000 + r.netDuty + 3_800);
  });

  it('FHBAS reduces the settlement duty for a $750k first home', () => {
    const withFhabas = computeAcquisition({
      purchasePrice: 750_000,
      fhabasEnabled: true,
      baseLoan: 600_000,
      lmiCapitalize: true,
      lmiOverride: null,
      acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    });
    const without = computeAcquisition({
      purchasePrice: 750_000,
      fhabasEnabled: false,
      baseLoan: 600_000,
      lmiCapitalize: true,
      lmiOverride: null,
      acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    });
    expect(withFhabas.netDuty).toBe(0);
    expect(without.netDuty).toBeGreaterThan(0);
    expect(withFhabas.cashRequiredAtSettlement).toBeLessThan(without.cashRequiredAtSettlement);
  });
});

describe('NSW Land Tax — exact worked example', () => {
  it('$1,100,000 -> $500 (100 + 1.6% x 25,000)', () => {
    expect(nswLandTax(1_100_000)).toBe(500);
  });

  it('below threshold -> $0', () => {
    expect(nswLandTax(1_075_000)).toBe(0);
    expect(nswLandTax(500_000)).toBe(0);
  });

  it('upper tier: $7,000,000 -> 88,036 + 2% x 429,000 = $96,616', () => {
    expect(nswLandTax(7_000_000)).toBe(88_036 + 0.02 * 429_000);
  });
});
