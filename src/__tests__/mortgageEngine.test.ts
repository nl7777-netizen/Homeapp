import { describe, expect, it } from 'vitest';
import { monthlyPayment, simulateMortgage } from '../engine/mortgageEngine';
import type { MortgageSimInput } from '../types/planner';

const base: MortgageSimInput = {
  principal: 500_000,
  annualRatePct: 6.0,
  termYears: 30,
  extraMonthly: 0,
  offsetInitial: 0,
  offsetMonthlyContribution: 0,
  familyLoan: { amount: 0, monthlyRepayment: 0, snowball: true },
  partnerNetMonthly: 0,
  lifeEvents: [],
  maxMonths: 600,
};

describe('Standard P&I payment', () => {
  it('$1M @ 6.0% over 30 years -> $5,995.51/month', () => {
    expect(monthlyPayment(1_000_000, 6.0, 30)).toBeCloseTo(5_995.51, 0);
  });

  it('$500k @ 6.0% over 30 years -> $2,997.75/month', () => {
    expect(monthlyPayment(500_000, 6.0, 30)).toBeCloseTo(2_997.75, 0);
  });

  it('zero rate -> straight-line principal', () => {
    expect(monthlyPayment(120_000, 0, 10)).toBe(1_000);
  });

  it('zero principal -> zero payment', () => {
    expect(monthlyPayment(0, 6, 30)).toBe(0);
  });
});

describe('Amortization convergence', () => {
  it('standard schedule converges to ~$0 at month 360', () => {
    const r = simulateMortgage(base);
    expect(r.standardPayoffMonth).toBe(360);
    const last = r.rows.find((x) => x.month === 360)!;
    expect(last.standardBalance).toBeLessThan(1);
    expect(r.acceleratedPayoffMonth).toBe(360); // no extras -> identical
    expect(r.rows.length).toBe(360);
  });

  it('total interest over the full term matches the payment schedule', () => {
    const r = simulateMortgage(base);
    // Exact (unrounded) payment drives the amortization math.
    const f = Math.pow(1.005, 360);
    const exact = (500_000 * 0.005 * f) / (f - 1);
    expect(r.standardTotalInterest).toBeCloseTo(exact * 360 - 500_000, 0);
    // And the displayed payment is the rounded one.
    expect(r.baseMonthlyPayment).toBe(2_997.75);
  });

  it('extra repayments shorten the term and save interest', () => {
    const r = simulateMortgage({ ...base, extraMonthly: 500 });
    expect(r.acceleratedPayoffMonth).not.toBeNull();
    expect(r.acceleratedPayoffMonth!).toBeLessThan(360);
    expect(r.lifetimeInterestSaved).toBeGreaterThan(0);
    expect(r.yearsSaved).toBeGreaterThan(0);
  });
});

describe('Offset account savings', () => {
  it('100% offset reduces interest vs no offset', () => {
    const noOffset = simulateMortgage(base);
    const withOffset = simulateMortgage({ ...base, offsetInitial: 100_000 });
    expect(withOffset.acceleratedTotalInterest).toBeLessThan(noOffset.acceleratedTotalInterest);
    expect(withOffset.rows[0].offsetBalance).toBe(100_000);
  });

  it('offset contribution grows the balance month by month', () => {
    const r = simulateMortgage({ ...base, offsetInitial: 0, offsetMonthlyContribution: 1_000 });
    expect(r.rows[11].offsetBalance).toBe(12_000);
  });
});

describe('Family co-loan snowball', () => {
  it('snowball activates the month the family loan hits $0', () => {
    const r = simulateMortgage({
      ...base,
      familyLoan: { amount: 60_000, monthlyRepayment: 1_000, snowball: true },
    });
    // 60,000 / 1,000 = 60 months
    expect(r.familyLoanSnowballMonth).toBe(60);
    expect(r.rows.find((x) => x.month === 59)!.familyLoanBalance).toBe(1_000);
    expect(r.rows.find((x) => x.month === 60)!.familyLoanBalance).toBe(0);
  });

  it('snowball frees the repayment into extra bank repayments (faster payoff, more interest saved)', () => {
    const noSnowball = simulateMortgage({
      ...base,
      familyLoan: { amount: 60_000, monthlyRepayment: 1_000, snowball: false },
    });
    const withSnowball = simulateMortgage({
      ...base,
      familyLoan: { amount: 60_000, monthlyRepayment: 1_000, snowball: true },
    });
    expect(withSnowball.acceleratedPayoffMonth!).toBeLessThan(noSnowball.acceleratedPayoffMonth!);
    expect(withSnowball.lifetimeInterestSaved).toBeGreaterThan(noSnowball.lifetimeInterestSaved);
  });

  it('partial-year family loan (amount not a multiple of repayment) still settles at $0', () => {
    const r = simulateMortgage({
      ...base,
      familyLoan: { amount: 60_500, monthlyRepayment: 1_000, snowball: true },
    });
    expect(r.familyLoanSnowballMonth).toBe(61);
  });
});

describe('Life-event modifiers', () => {
  it('one-off offset withdrawal reduces the buffer and flags when it dips negative', () => {
    const ok = simulateMortgage({
      ...base,
      offsetInitial: 50_000,
      lifeEvents: [{ id: 'e1', type: 'offset-withdrawal', label: 'Renovation', startMonth: 24, endMonth: 24, value: 30_000 }],
    });
    expect(ok.bufferWentNegative).toBe(false);
    expect(ok.rows.find((x) => x.month === 24)!.offsetBalance).toBe(20_000);

    const bad = simulateMortgage({
      ...base,
      offsetInitial: 50_000,
      lifeEvents: [{ id: 'e2', type: 'offset-withdrawal', label: 'Big renovation', startMonth: 24, endMonth: 24, value: 100_000 }],
    });
    expect(bad.bufferWentNegative).toBe(true);
    expect(bad.minBuffer).toBeLessThan(0);
  });

  it('one-off offset deposit increases the buffer and speeds payoff', () => {
    const withBonus = simulateMortgage({
      ...base,
      lifeEvents: [{ id: 'e3', type: 'offset-deposit', label: 'Bonus', startMonth: 12, endMonth: 12, value: 50_000 }],
    });
    const without = simulateMortgage(base);
    expect(withBonus.acceleratedPayoffMonth!).toBeLessThan(without.acceleratedPayoffMonth!);
  });

  it('income shock (partner at 50%) reduces extra repayments and slows payoff', () => {
    const withShock = simulateMortgage({
      ...base,
      extraMonthly: 2_000,
      partnerNetMonthly: 3_000,
      lifeEvents: [
        { id: 'e4', type: 'income-shock', label: 'Parental leave', startMonth: 18, endMonth: 30, value: 0.5 },
      ],
    });
    const withoutShock = simulateMortgage({ ...base, extraMonthly: 2_000, partnerNetMonthly: 3_000 });
    // During months 18-30 the shock cuts 0.5 x 3,000 = 1,500 of the 2,000 extra.
    expect(withShock.acceleratedPayoffMonth!).toBeGreaterThan(withoutShock.acceleratedPayoffMonth!);
  });
});
