/**
 * Versioned ATO resident income tax tables, Medicare Levy, MLS and
 * HECS/HELP compulsory repayment thresholds.
 *
 * Supported financial years: 2023-24, 2025-26, 2026-27 (default), 2027-28.
 * All figures in AUD. Tables are data-driven so the AI Tax Update Checker
 * can diff against them and save custom overrides.
 */

export type FinancialYear = '2023-24' | '2025-26' | '2026-27' | '2027-28';

export const SUPPORTED_FY: FinancialYear[] = ['2023-24', '2025-26', '2026-27', '2027-28'];

export const DEFAULT_FY: FinancialYear = '2026-27';

export interface TaxBracket {
  /**
   * The "over $X" threshold: baseTax applies exactly at this income and the
   * marginal rate applies to (income - from). ATO convention, e.g. "31,020
   * plus 37c for each $1 over $135,000" -> from = 135,000.
   */
  from: number;
  /** Upper bound of the bracket (inclusive), AUD. Infinity for the top bracket. */
  to: number;
  /** Base tax at the bottom of the bracket, AUD. */
  baseTax: number;
  /** Marginal rate applied to (income - from), as a fraction (0.19 = 19%). */
  rate: number;
}

export interface HecsBracket {
  from: number;
  to: number;
  baseRepayment: number;
  rate: number;
  /** When true, repayment = rate * total income (flat percentage of income). */
  flatPctOfIncome: boolean;
}

export interface YearTaxTable {
  fy: FinancialYear;
  brackets: TaxBracket[];
  hecs: HecsBracket[];
  /** Working Australians Tax Offset (WATO) max per eligible taxpayer; 0 if none. */
  watoMax: number;
  watoThreshold: number;
  /** Medicare Levy thresholds. */
  medicare: {
    rate: number;
    individualLower: number;
    individualUpper: number;
    familyLowerBase: number;
    familyLowerPerChild: number;
    familyUpperBase: number;
    familyUpperPerChild: number;
    familyShadeRate: number;
  };
  /** MLS thresholds. */
  mls: {
    familyTiers: { upTo: number; rate: number }[];
    singleTiers: { upTo: number; rate: number }[];
    /** Partner earning at/below this amount is exempt from MLS in a couple. */
    partnerExemptIncome: number;
    familyPerChildAfterFirst: number;
  };
}

const b = (from: number, to: number, baseTax: number, rate: number): TaxBracket => ({
  from,
  to,
  baseTax,
  rate,
});

const h = (from: number, to: number, baseRepayment: number, rate: number, flatPctOfIncome = false): HecsBracket => ({
  from,
  to,
  baseRepayment,
  rate,
  flatPctOfIncome,
});

export const TAX_TABLES: Record<FinancialYear, YearTaxTable> = {
  '2023-24': {
    fy: '2023-24',
    brackets: [
      b(0, 18_200, 0, 0),
      b(18_200, 45_000, 0, 0.19),
      b(45_000, 120_000, 5_092, 0.325),
      b(120_000, 180_000, 29_467, 0.37),
      b(180_000, Infinity, 51_667, 0.45),
    ],
    hecs: [
      h(0, 60_037, 0, 0),
      h(60_037, 118_541, 0, 0.15),
      h(118_541, 172_179, 8_775.2, 0.17),
      h(172_179, Infinity, 0, 0.10, true),
    ],
    watoMax: 0,
    watoThreshold: 0,
    medicare: {
      rate: 0.02,
      individualLower: 28_011,
      individualUpper: 35_013,
      familyLowerBase: 47_238,
      familyLowerPerChild: 4_338,
      familyUpperBase: 59_047,
      familyUpperPerChild: 5_423,
      familyShadeRate: 0.1,
    },
    mls: {
      familyTiers: [
        { upTo: 210_000, rate: 0 },
        { upTo: 246_000, rate: 0.01 },
        { upTo: 328_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      singleTiers: [
        { upTo: 105_000, rate: 0 },
        { upTo: 123_000, rate: 0.01 },
        { upTo: 164_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      partnerExemptIncome: 28_011,
      familyPerChildAfterFirst: 1_500,
    },
  },
  '2025-26': {
    fy: '2025-26',
    brackets: [
      b(0, 18_200, 0, 0),
      b(18_200, 45_000, 0, 0.16),
      b(45_000, 135_000, 4_288, 0.3),
      b(135_000, 190_000, 31_288, 0.37),
      b(190_000, Infinity, 51_638, 0.45),
    ],
    hecs: [
      h(0, 67_000, 0, 0),
      h(67_000, 124_999, 0, 0.15),
      h(124_999, 179_285, 8_700, 0.17),
      h(179_285, Infinity, 0, 0.1, true),
    ],
    watoMax: 0,
    watoThreshold: 0,
    medicare: {
      rate: 0.02,
      individualLower: 28_011,
      individualUpper: 35_013,
      familyLowerBase: 47_238,
      familyLowerPerChild: 4_338,
      familyUpperBase: 59_047,
      familyUpperPerChild: 5_423,
      familyShadeRate: 0.1,
    },
    mls: {
      familyTiers: [
        { upTo: 210_000, rate: 0 },
        { upTo: 246_000, rate: 0.01 },
        { upTo: 328_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      singleTiers: [
        { upTo: 105_000, rate: 0 },
        { upTo: 123_000, rate: 0.01 },
        { upTo: 164_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      partnerExemptIncome: 28_011,
      familyPerChildAfterFirst: 1_500,
    },
  },
  '2026-27': {
    fy: '2026-27',
    brackets: [
      b(0, 18_200, 0, 0),
      b(18_200, 45_000, 0, 0.15),
      b(45_000, 135_000, 4_020, 0.3),
      b(135_000, 190_000, 31_020, 0.37),
      b(190_000, Infinity, 51_370, 0.45),
    ],
    hecs: [
      h(0, 69_528, 0, 0),
      h(69_528, 129_717, 0, 0.15),
      h(129_717, 186_050, 9_028, 0.17),
      h(186_050, Infinity, 0, 0.1, true),
    ],
    watoMax: 0,
    watoThreshold: 0,
    medicare: {
      rate: 0.02,
      individualLower: 28_011,
      individualUpper: 35_013,
      familyLowerBase: 47_238,
      familyLowerPerChild: 4_338,
      familyUpperBase: 59_047,
      familyUpperPerChild: 5_423,
      familyShadeRate: 0.1,
    },
    mls: {
      familyTiers: [
        { upTo: 210_000, rate: 0 },
        { upTo: 246_000, rate: 0.01 },
        { upTo: 328_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      singleTiers: [
        { upTo: 105_000, rate: 0 },
        { upTo: 123_000, rate: 0.01 },
        { upTo: 164_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      partnerExemptIncome: 28_011,
      familyPerChildAfterFirst: 1_500,
    },
  },
  '2027-28': {
    fy: '2027-28',
    brackets: [
      b(0, 18_200, 0, 0),
      b(18_200, 45_000, 0, 0.14),
      b(45_000, 135_000, 3_752, 0.3),
      b(135_000, 190_000, 30_752, 0.37),
      b(190_000, Infinity, 51_102, 0.45),
    ],
    hecs: [
      h(0, 69_528, 0, 0),
      h(69_528, 129_717, 0, 0.15),
      h(129_717, 186_050, 9_028, 0.17),
      h(186_050, Infinity, 0, 0.1, true),
    ],
    watoMax: 250,
    watoThreshold: 18_200,
    medicare: {
      rate: 0.02,
      individualLower: 28_011,
      individualUpper: 35_013,
      familyLowerBase: 47_238,
      familyLowerPerChild: 4_338,
      familyUpperBase: 59_047,
      familyUpperPerChild: 5_423,
      familyShadeRate: 0.1,
    },
    mls: {
      familyTiers: [
        { upTo: 210_000, rate: 0 },
        { upTo: 246_000, rate: 0.01 },
        { upTo: 328_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      singleTiers: [
        { upTo: 105_000, rate: 0 },
        { upTo: 123_000, rate: 0.01 },
        { upTo: 164_000, rate: 0.0125 },
        { upTo: Infinity, rate: 0.015 },
      ],
      partnerExemptIncome: 28_011,
      familyPerChildAfterFirst: 1_500,
    },
  },
};

/**
 * Custom (AI-updated) tables keyed by synthetic FY label, e.g. "2028-29 (AI)".
 * Stored in localStorage; always override built-ins for the same label.
 */
export type CustomTaxTable = YearTaxTable & { fy: string };

export function getTable(fy: string, custom: Record<string, YearTaxTable> = {}): YearTaxTable {
  if (custom[fy]) return custom[fy];
  const builtIn = TAX_TABLES[fy as FinancialYear];
  if (!builtIn) {
    // Unknown FY — fall back to the default year rather than crashing.
    return TAX_TABLES[DEFAULT_FY];
  }
  return builtIn;
}
