/**
 * Persistence: localStorage hydration with resilient schema migrations
 * (missing keys always merge safely with defaults), JSON import/export,
 * and compact lz-string "Wireless Sync Codes" (version header + checksum).
 */

import LZString from 'lz-string';
import { DEFAULT_ACQUISITION_COSTS } from '../data/nswDutyAndLandTax';
import { DEFAULT_FY } from '../data/taxTables';
import { SCHEMA_VERSION, type PlannerState, type SavedScenario } from '../types/planner';

const STORAGE_KEY = 'nsw-property-planner-v1';

// ---------------------------------------------------------------------------
// Defaults (single source of truth for migrations)
// ---------------------------------------------------------------------------

export function defaultState(): PlannerState {
  return {
    schemaVersion: SCHEMA_VERSION,
    // Income & budget
    fy: DEFAULT_FY,
    primaryIncome: 120_000,
    partnerIncome: 85_000,
    primaryHecs: false,
    partnerHecs: false,
    hasPrivateHospitalCover: true,
    dependentChildren: 0,
    pureLifestyleMonthly: 5_500,
    livingWithParentsMonthly: 2_800,
    holdingCosts: {
      strata: { value: 2_400, period: 'annual' },
      council: { value: 2_800, period: 'annual' },
      insurance: { value: 1_600, period: 'annual' },
      water: { value: 900, period: 'annual' },
      utilities: { value: 2_600, period: 'annual' },
    },
    emergencyCashFloor: 25_000,
    monthlyUnallocatedBuffer: 500,
    optimizeSurplus: true,
    lifeEvents: [],
    // Assets & ownership
    cashSavings: 150_000,
    sharePortfolioValue: 80_000,
    sharePortfolioCostBase: 60_000,
    sharesHeldOver12Months: true,
    otherAssets: 20_000,
    includeOtherAssets: true,
    ownershipSplit: { kind: 'joint-5050' },
    familyLoanAmount: 0,
    familyLoanAnnualRepayment: 0,
    familyLoanSnowball: true,
    // Target property & loan
    suburb: 'Penrith',
    suburbGrowthPct: 5.5,
    targetPurchasePrice: 1_050_000,
    fhabas: false,
    acquisitionCosts: { ...DEFAULT_ACQUISITION_COSTS },
    lmiCapitalize: true,
    lmiOverride: null,
    loanInterestRatePct: 6.25,
    offsetMonthlyContribution: 0,
    extraMonthlyRepayment: 0,
    // Future simulation
    futureSimulationEnabled: false,
    holdingPeriodMonths: 24,
    startYear: 2026,
    startMonth: 11,
    targetYear: 2028,
    targetMonth: 11,
    inflateTargetPropertyPrice: true,
    wageGrowthEnabled: true,
    annualWageGrowthPct: 3.0,
    cpiEnabled: true,
    annualLivingExpenseCpiPct: 2.5,
    savingsReturnRatePct: 4.0,
    investmentMode: 'hisa',
    etfDividendYieldPct: 3.5,
    // Existing property (Phase 1)
    hasExistingProperty: true,
    existing: {
      value: 950_000,
      originalPurchasePrice: 720_000,
      purchaseCosts: 26_000,
      loanBalance: 380_000,
      loanRatePct: 5.99,
      loanTermMonthsRemaining: 240,
      weeklyRent: 850,
      vacancyWeeksPerYear: 2,
      pmFeePct: 0.1,
      maintenanceAnnual: 2_000,
      depreciationAnnual: 3_500,
      unimprovedLandValue: 420_000,
      strataMonthly: 0,
      councilMonthly: 235,
      insuranceMonthly: 95,
      waterMonthly: 75,
      utilitiesMonthly: 215,
      agentCommissionPct: 0.02,
      marketingCost: 500,
      legalCost: 1_200,
      dischargeFee: 250,
      cgtMode: 'ppor-always',
      monthsRentedBeforeSale: 0,
      valueAtFirstRental: 950_000,
      heldMonths: 132,
      cgtRegime: 'standard',
      grandfatheredGearing: true,
    },
    exitScenarioChoice: 'auto',
    scenarioBRepayment: 'offset',
    growthMode: 'annual',
    annualGrowthPct: 4.5,
    fixedFutureSalePrice: 0,
    // Saved & custom
    savedScenarios: [],
    customSuburbs: [],
    customTaxTables: {},
    ai: {
      lmStudioBaseUrl: 'http://localhost:1234/v1',
      selectedModel: '',
      searchProvider: 'none',
      localProxyUrl: 'http://localhost:8787/search',
      serperApiKey: '',
    },
    theme: 'dark',
  };
}

// ---------------------------------------------------------------------------
// Migration: deep-merge unknown/partial payloads onto defaults.
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recursively merges `partial` onto `defaults`. Missing keys take default
 * values; unknown keys are dropped. Arrays are replaced wholesale. This is
 * what makes older/partial JSON payloads load cleanly (forward migration).
 */
export function deepMerge<T>(defaults: T, partial: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(partial) ? partial : defaults) as T;
  }
  if (isPlainObject(defaults)) {
    const out: Record<string, unknown> = {};
    const src = isPlainObject(partial) ? partial : {};
    for (const key of Object.keys(defaults)) {
      out[key] = deepMerge((defaults as Record<string, unknown>)[key], src[key]);
    }
    return out as T;
  }
  // Primitives: use the partial value only when its type matches.
  if (partial !== undefined && partial !== null && typeof partial === typeof defaults) {
    return partial as T;
  }
  return defaults;
}

/** Hydrate state from a raw payload (localStorage JSON, file import, sync code). */
export function migrateState(raw: unknown): PlannerState {
  const defaults = defaultState();
  if (!isPlainObject(raw)) return defaults;
  const migrated = deepMerge(defaults, raw);
  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

export function loadPersistedState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function persistState(state: PlannerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/unavailable — non-fatal.
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// JSON export / import
// ---------------------------------------------------------------------------

export function exportJson(state: PlannerState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): PlannerState {
  return migrateState(JSON.parse(text));
}

// ---------------------------------------------------------------------------
// Wireless Sync Codes (lz-string Base64 + version header + checksum)
// ---------------------------------------------------------------------------

const SYNC_PREFIX = 'NSWPP1';

/** djb2 checksum of a string, as a base36 token. */
function checksum(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function encodeSyncCode(state: PlannerState): string {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToBase64(json);
  return `${SYNC_PREFIX}.${checksum(json)}.${compressed}`;
}

export function decodeSyncCode(code: string): PlannerState {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== SYNC_PREFIX) {
    throw new Error('Not a valid NSW Planner sync code.');
  }
  const [, sum, compressed] = parts;
  const json = LZString.decompressFromBase64(compressed);
  if (!json) throw new Error('Sync code failed to decompress.');
  if (checksum(json) !== sum) throw new Error('Sync code checksum mismatch — data may be corrupted.');
  return migrateState(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Saved scenario helpers
// ---------------------------------------------------------------------------

export function snapshotScenario(name: string, state: PlannerState): SavedScenario {
  return {
    id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: new Date().toISOString(),
    // Strip the scenario list itself from the snapshot to avoid nesting.
    state: { ...state, savedScenarios: [] },
  };
}
