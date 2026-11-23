/**
 * Month-by-month mortgage amortization engine.
 *
 * Simulates up to 600 months comparing:
 *  - Standard Schedule: fixed P&I over the term at the primary rate.
 *  - Accelerated Path: base P&I + extra monthly repayments + 100% offset
 *    interest saving + automatic Family Co-Loan Snowball (freed repayment
 *    rolls into extra bank repayments the month the family loan hits $0)
 *    + life-event modifiers (income shocks, one-off offset deposits and
 *    withdrawals with negative-buffer flagging).
 */

import type { LifeEvent, MortgageMonthRow, MortgageSimInput, MortgageSimResult } from '../types/planner';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Standard fixed P&I monthly payment (r = 0 falls back to principal/term). */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return round2((principal * r * f) / (f - 1));
}

function eventsAt(lifeEvents: LifeEvent[], month: number): LifeEvent[] {
  return lifeEvents.filter((e) => month >= e.startMonth && month <= e.endMonth);
}

export function simulateMortgage(input: MortgageSimInput): MortgageSimResult {
  const {
    principal,
    annualRatePct,
    termYears,
    extraMonthly,
    offsetInitial,
    offsetMonthlyContribution,
    familyLoan,
    partnerNetMonthly,
    lifeEvents,
    maxMonths,
  } = input;

  const r = annualRatePct / 100 / 12;
  const basePayment = monthlyPayment(principal, annualRatePct, termYears);
  // The simulation amortizes with the UNROUNDED exact payment so the
  // schedule converges to $0 exactly at the term (banks adjust the final
  // payment); the rounded figure is reported for display.
  const n = Math.max(1, Math.round(termYears * 12));
  const exactPayment =
    principal <= 0 ? 0 : r <= 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const maxM = Math.min(maxMonths, 600);

  let stdBalance = principal;
  let accBalance = principal;
  let offset = Math.max(0, offsetInitial);
  let famBalance = Math.max(0, familyLoan.amount);
  let stdInterestToDate = 0;
  let accInterestToDate = 0;
  let snowballMonth: number | null = null;
  let bufferWentNegative = false;
  let minBuffer = offset;
  let stdPayoff: number | null = null;
  let accPayoff: number | null = null;
  const rows: MortgageMonthRow[] = [];

  for (let m = 1; m <= maxM; m++) {
    // --- Life events (offset one-offs apply at their start month) ---
    let rawOffset = offset;
    for (const e of lifeEvents) {
      if (e.startMonth === m) {
        if (e.type === 'offset-deposit') rawOffset += e.value;
        if (e.type === 'offset-withdrawal') rawOffset -= e.value;
      }
    }
    rawOffset += offsetMonthlyContribution;
    // Track the unclamped buffer so a withdrawal that exceeds the offset
    // is flagged as a negative cash buffer dip.
    if (rawOffset < minBuffer) minBuffer = rawOffset;
    if (rawOffset < 0) bufferWentNegative = true;
    offset = Math.max(0, rawOffset);

    // --- Standard path ---
    if (stdBalance > 0.005) {
      const interest = stdBalance * r;
      const pay = Math.min(exactPayment, stdBalance + interest);
      stdBalance = Math.max(0, stdBalance + interest - pay);
      stdInterestToDate += interest;
      if (stdBalance <= 0.005 && stdPayoff === null) stdPayoff = m;
    }

    // --- Accelerated path ---
    if (accBalance > 0.005) {
      // Family co-loan repayment + snowball.
      let effectiveExtra = extraMonthly;
      if (famBalance > 0.005) {
        const famPay = Math.min(familyLoan.monthlyRepayment, famBalance);
        famBalance = Math.max(0, famBalance - famPay);
        if (famBalance <= 0.005 && familyLoan.snowball && snowballMonth === null) {
          snowballMonth = m;
        }
      }
      if (snowballMonth !== null && familyLoan.snowball) {
        effectiveExtra += familyLoan.monthlyRepayment;
      }
      // Income-shock life events reduce the available extra repayment.
      for (const e of eventsAt(lifeEvents, m)) {
        if (e.type === 'income-shock') {
          effectiveExtra = Math.max(0, effectiveExtra - (1 - e.value) * partnerNetMonthly);
        }
      }

      // 100% offset: interest only on (balance - offset).
      const interest = Math.max(0, accBalance - offset) * r;
      const pay = Math.min(exactPayment + effectiveExtra, accBalance + interest);
      accBalance = Math.max(0, accBalance + interest - pay);
      accInterestToDate += interest;
      if (accBalance <= 0.005 && accPayoff === null) accPayoff = m;
    } else if (famBalance > 0.005) {
      const famPay = Math.min(familyLoan.monthlyRepayment, famBalance);
      famBalance = Math.max(0, famBalance - famPay);
      if (famBalance <= 0.005 && familyLoan.snowball && snowballMonth === null) {
        snowballMonth = m;
      }
    }

    rows.push({
      month: m,
      standardBalance: round2(stdBalance),
      acceleratedBalance: round2(accBalance),
      offsetBalance: round2(offset),
      familyLoanBalance: round2(famBalance),
      standardInterestToDate: round2(stdInterestToDate),
      acceleratedInterestToDate: round2(accInterestToDate),
    });

    if (stdBalance <= 0.005 && accBalance <= 0.005 && famBalance <= 0.005) break;
  }

  const standardTotalInterest = round2(stdInterestToDate);
  const acceleratedTotalInterest = round2(accInterestToDate);

  return {
    baseMonthlyPayment: basePayment,
    standardPayoffMonth: stdPayoff,
    acceleratedPayoffMonth: accPayoff,
    yearsSaved:
      stdPayoff !== null && accPayoff !== null ? round2((stdPayoff - accPayoff) / 12) : 0,
    lifetimeInterestSaved: round2(standardTotalInterest - acceleratedTotalInterest),
    standardTotalInterest,
    acceleratedTotalInterest,
    familyLoanSnowballMonth: snowballMonth,
    bufferWentNegative,
    minBuffer: round2(minBuffer),
    rows,
  };
}
