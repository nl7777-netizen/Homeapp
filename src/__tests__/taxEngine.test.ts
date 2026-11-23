import { describe, expect, it } from 'vitest';
import {
  computeHouseholdTax,
  computeShareCgt,
  hecsRepayment,
  incomeTaxForYear,
  marginalRate,
  medicareLevy,
  medicareLevySurcharge,
  watoOffset,
} from '../engine/taxEngine';

describe('ATO resident income tax — exact tables across FYs', () => {
  it('2023-24: $190,000 -> $56,167 (51,667 + 45% over 180,000)', () => {
    expect(incomeTaxForYear('2023-24', 190_000)).toBe(56_167);
  });

  it('2023-24: $150,000 -> $40,567 (29,467 + 37% over 120,000)', () => {
    expect(incomeTaxForYear('2023-24', 150_000)).toBe(40_567);
  });

  it('2025-26: $190,000 boundary -> $51,638', () => {
    expect(incomeTaxForYear('2025-26', 190_000)).toBe(51_638);
  });

  it('2026-27: $190,000 boundary -> $51,370', () => {
    expect(incomeTaxForYear('2026-27', 190_000)).toBe(51_370);
  });

  it('2027-28: $190,000 boundary -> $51,102', () => {
    expect(incomeTaxForYear('2027-28', 190_000)).toBe(51_102);
  });

  it('2026-27: $45,000 bracket boundary -> $4,020', () => {
    expect(incomeTaxForYear('2026-27', 45_000)).toBe(4_020);
  });

  it('2026-27: $135,000 bracket boundary -> $31,020', () => {
    expect(incomeTaxForYear('2026-27', 135_000)).toBe(31_020);
  });

  it('2026-27: $100,000 -> 4,020 + 30% of 55,000 = $20,520', () => {
    expect(incomeTaxForYear('2026-27', 100_000)).toBe(20_520);
  });

  it('2026-27: $18,200 tax-free threshold -> $0', () => {
    expect(incomeTaxForYear('2026-27', 18_200)).toBe(0);
  });

  it('2026-27: $250,000 -> 51,370 + 45% of 60,000 = $78,370', () => {
    expect(incomeTaxForYear('2026-27', 250_000)).toBe(78_370);
  });

  it('marginal rate is exact at the top of each bracket', () => {
    expect(marginalRate('2026-27', 10_000)).toBe(0);
    expect(marginalRate('2026-27', 30_000)).toBe(0.15);
    expect(marginalRate('2026-27', 100_000)).toBe(0.3);
    expect(marginalRate('2026-27', 150_000)).toBe(0.37);
    expect(marginalRate('2026-27', 300_000)).toBe(0.45);
  });
});

describe('HECS/HELP compulsory repayment — exact 2026-27 worked examples', () => {
  it('$86,380 -> $2,527.80 (0.15 x 16,852)', () => {
    expect(hecsRepayment('2026-27', 86_380)).toBe(2_527.8);
  });

  it('$137,064 -> $10,276.99 (9,028 + 0.17 x 7,347)', () => {
    expect(hecsRepayment('2026-27', 137_064)).toBe(10_276.99);
  });

  it('$254,780 -> $25,478.00 (10% of total repayment income)', () => {
    expect(hecsRepayment('2026-27', 254_780)).toBe(25_478);
  });

  it('below threshold -> $0', () => {
    expect(hecsRepayment('2026-27', 69_528)).toBe(0);
  });

  it('2025-26: $86,380 -> 0.15 x 19,380 = $2,907', () => {
    expect(hecsRepayment('2025-26', 86_380)).toBe(2_907);
  });
});

describe('Medicare Levy — 2% with low-income shade-in and family reduction', () => {
  it('below $28,011 -> $0', () => {
    expect(medicareLevy(25_000, false, 25_000, 0, '2026-27')).toBe(0);
  });

  it('shade-in: $30,000 -> min(600, 1,989 x 0.10) = $198.90', () => {
    expect(medicareLevy(30_000, false, 30_000, 0, '2026-27')).toBe(198.9);
  });

  it('above $35,013: $40,000 -> $800', () => {
    expect(medicareLevy(40_000, false, 40_000, 0, '2026-27')).toBe(800);
  });

  it('family: combined $50,000 <= $59,047 upper -> shaded', () => {
    // (50,000 - 47,238) * 0.10 * (30,000/50,000) = 165.72
    expect(medicareLevy(30_000, true, 50_000, 0, '2026-27')).toBe(165.72);
  });

  it('family: combined $45,000 <= $47,238 lower -> exempt', () => {
    expect(medicareLevy(30_000, true, 45_000, 0, '2026-27')).toBe(0);
  });

  it('family thresholds lift with dependent children', () => {
    // 2 children: lower = 47,238 + 2x4,338 = 55,914 -> combined 53,000 exempt
    expect(medicareLevy(30_000, true, 53_000, 2, '2026-27')).toBe(0);
  });
});

describe('Medicare Levy Surcharge — FY 2026-27 tiers', () => {
  it('single: $110,000 (no cover) -> 1.0% = $1,100', () => {
    const { mls, rate } = medicareLevySurcharge(110_000, true, 110_000, 0, 0, '2026-27');
    expect(rate).toBe(0.01);
    expect(mls).toBe(1_100);
  });

  it('single: $105,000 or less -> 0%', () => {
    expect(medicareLevySurcharge(105_000, true, 105_000, 0, 0, '2026-27').mls).toBe(0);
  });

  it('family: combined $220,000 -> 1.0% tier', () => {
    const { rate } = medicareLevySurcharge(200_000, false, 220_000, 0, 20_000, '2026-27');
    expect(rate).toBe(0.01);
  });

  it('couple: low-earning partner (<= $28,011) is exempt even above family threshold', () => {
    const low = medicareLevySurcharge(20_000, false, 340_000, 0, 320_000, '2026-27');
    const high = medicareLevySurcharge(320_000, false, 340_000, 0, 20_000, '2026-27');
    expect(low.mls).toBe(0); // partner earning <= 28,011 exempt
    expect(high.mls).toBe(4_800); // 320,000 x 1.5%
  });

  it('family thresholds lift $1,500 per dependent child after the first', () => {
    // combined 211,000 with 2 children: 210,000 + 1,500 = 211,500 -> still 0%
    expect(medicareLevySurcharge(211_000, false, 211_000, 2, 0, '2026-27').rate).toBe(0);
    // combined 211,000 with 0 children -> 1.0%
    expect(medicareLevySurcharge(211_000, false, 211_000, 0, 0, '2026-27').rate).toBe(0.01);
  });
});

describe('WATO (2027-28)', () => {
  it('$250 offset when income > $18,200 in 2027-28', () => {
    expect(watoOffset('2027-28', 50_000)).toBe(250);
  });
  it('no WATO in other years', () => {
    expect(watoOffset('2026-27', 50_000)).toBe(0);
  });
  it('no WATO below threshold', () => {
    expect(watoOffset('2027-28', 10_000)).toBe(0);
  });
});

describe('Household computation (two partners)', () => {
  const base = {
    fy: '2026-27',
    primary: { grossAnnualIncome: 150_000, hasHecsDebt: false },
    partner: { grossAnnualIncome: 90_000, hasHecsDebt: false },
    hasPrivateHospitalCover: true,
    dependentChildren: 0,
  };

  it('nets each partner exactly and sums the household', () => {
    const r = computeHouseholdTax(base);
    // Primary: 31,020 + 37% x 15,000 = 36,570 income tax; medicare 3,000
    expect(r.primary.incomeTax).toBe(36_570);
    expect(r.primary.medicareLevy).toBe(3_000);
    expect(r.primary.netPay).toBe(150_000 - 36_570 - 3_000);
    // Partner: 4,020 + 30% x 45,000 = 17,520; medicare 1,800
    expect(r.partner.incomeTax).toBe(17_520);
    expect(r.partner.medicareLevy).toBe(1_800);
    expect(r.partner.netPay).toBe(90_000 - 17_520 - 1_800);
    expect(r.householdGross).toBe(240_000);
    expect(r.householdNet).toBe(r.primary.netPay + r.partner.netPay);
    expect(r.netMonthly).toBeCloseTo(r.householdNet / 12, 0);
    expect(r.netFortnightly).toBeCloseTo(r.householdNet / 26, 0);
    expect(r.netWeekly).toBeCloseTo(r.householdNet / 52, 0);
  });

  it('applies MLS per-adult only when no private hospital cover (couple, 1.0% tier)', () => {
    const r = computeHouseholdTax({ ...base, hasPrivateHospitalCover: false });
    // Combined 240,000 -> 1.0% tier; both above 28,011
    expect(r.primary.mls).toBe(1_500);
    expect(r.partner.mls).toBe(900);
    expect(r.mlsApplied).toBe(true);
  });

  it('no MLS when private hospital cover is held by all', () => {
    const r = computeHouseholdTax(base);
    expect(r.primary.mls).toBe(0);
    expect(r.partner.mls).toBe(0);
    expect(r.mlsApplied).toBe(false);
  });

  it('HECS only charged when the partner has a debt', () => {
    const r = computeHouseholdTax({ ...base, partner: { grossAnnualIncome: 90_000, hasHecsDebt: true } });
    expect(r.partner.hecs).toBe(hecsRepayment('2026-27', 90_000));
    expect(r.primary.hecs).toBe(0);
  });

  it('single (partner income $0) uses single MLS thresholds', () => {
    const r = computeHouseholdTax({
      ...base,
      partner: { grossAnnualIncome: 0, hasHecsDebt: false },
      hasPrivateHospitalCover: false,
    });
    // 150,000 single -> 1.25% tier (123,001-164,000)
    expect(r.primary.mls).toBe(1_875);
    expect(r.isSingleMls).toBe(true);
  });
});

describe('Share portfolio CGT (ownership-split aware)', () => {
  it('50% discount when held > 12 months, taxed at weighted marginal rate', () => {
    const r = computeShareCgt({
      portfolioValue: 100_000,
      costBase: 60_000,
      heldOver12Months: true,
      primaryFraction: 0.5,
      primaryMarginalRate: 0.37,
      partnerMarginalRate: 0.3,
    });
    // gain 40,000 -> taxable 20,000 @ (0.5x0.37 + 0.5x0.30) = 0.335 -> 6,700
    expect(r.grossGain).toBe(40_000);
    expect(r.discountApplied).toBe(true);
    expect(r.cgtTax).toBe(6_700);
    expect(r.netProceeds).toBe(93_300);
  });

  it('no discount when held <= 12 months', () => {
    const r = computeShareCgt({
      portfolioValue: 100_000,
      costBase: 60_000,
      heldOver12Months: false,
      primaryFraction: 1,
      primaryMarginalRate: 0.37,
      partnerMarginalRate: 0,
    });
    expect(r.cgtTax).toBe(14_800);
    expect(r.netProceeds).toBe(85_200);
  });

  it('losses produce no CGT', () => {
    const r = computeShareCgt({
      portfolioValue: 40_000,
      costBase: 60_000,
      heldOver12Months: true,
      primaryFraction: 0.5,
      primaryMarginalRate: 0.37,
      partnerMarginalRate: 0.3,
    });
    expect(r.cgtTax).toBe(0);
    expect(r.netProceeds).toBe(40_000);
  });
});
