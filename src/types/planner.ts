/**
 * Complete TypeScript interfaces for the NSW Property Purchase & Exit
 * Strategy Planner. `SCHEMA_VERSION` drives localStorage migrations.
 */

import type { FinancialYear } from '../data/taxTables';

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Household / tax
// ---------------------------------------------------------------------------

export type OwnershipSplit =
  | { kind: 'joint-5050' }
  | { kind: 'primary-100' }
  | { kind: 'partner-100' }
  | { kind: 'custom'; primaryPct: number }; // partner gets (100 - primaryPct)

/** Fraction of an asset/tax item owned by the primary partner (0..1). */
export function ownershipPrimaryFraction(split: OwnershipSplit): number {
  switch (split.kind) {
    case 'joint-5050':
      return 0.5;
    case 'primary-100':
      return 1;
    case 'partner-100':
      return 0;
    case 'custom':
      return Math.min(1, Math.max(0, split.primaryPct / 100));
  }
}

export interface PartnerTaxInput {
  grossAnnualIncome: number;
  hasHecsDebt: boolean;
}

export interface HouseholdTaxInput {
  fy: string; // FinancialYear or a custom AI-updated label
  primary: PartnerTaxInput;
  partner: PartnerTaxInput;
  /** Household-level: ALL family members must be covered for MLS to be avoided. */
  hasPrivateHospitalCover: boolean;
  dependentChildren: number;
}

export interface PartnerTaxResult {
  gross: number;
  incomeTax: number;
  medicareLevy: number;
  mls: number;
  hecs: number;
  wato: number;
  totalTax: number;
  netPay: number;
  netMonthly: number;
  /** Marginal income tax rate (excl. Medicare) at current income. */
  marginalRateExclMedicare: number;
  /** Marginal rate incl. 2% Medicare Levy. */
  marginalRateInclMedicare: number;
  effectiveRate: number;
}

export interface HouseholdTaxResult {
  fy: string;
  primary: PartnerTaxResult;
  partner: PartnerTaxResult;
  householdGross: number;
  householdIncomeTax: number;
  householdMedicare: number;
  householdMls: number;
  householdHecs: number;
  householdWato: number;
  householdTotalTax: number;
  householdNet: number;
  netMonthly: number;
  netFortnightly: number;
  netWeekly: number;
  mlsApplied: boolean;
  mlsRate: number;
  isSingleMls: boolean;
}

// ---------------------------------------------------------------------------
// Acquisition costs / stamp duty
// ---------------------------------------------------------------------------

export interface AcquisitionCosts {
  conveyancing: number;
  buildingPestStrata: number;
  pexaTitleMortgage: number;
  councilWaterMisc: number;
}

export interface StampDutyInput {
  /** Actual active target purchase price (or inflated future price). */
  purchasePrice: number;
  fhabasEnabled: boolean;
  /** Loan before LMI capitalisation = price - deposit. */
  baseLoan: number;
  lmiCapitalize: boolean;
  /** Manual LMI override in AUD; null = use banded estimate. */
  lmiOverride: number | null;
  acquisitionCosts: AcquisitionCosts;
}

export interface StampDutyResult {
  purchasePrice: number;
  grossDuty: number;
  fhabasConcession: number;
  netDuty: number;
  lvr: number;
  lmiBandLabel: string | null;
  lmiPremium: number;
  lmiStampDuty: number;
  lmiTotal: number;
  lmiFlagged: boolean;
  totalAcquisitionCosts: number;
  /** Cash needed at settlement: (price - baseLoan) + duty + LMI (if upfront) + costs. */
  cashRequiredAtSettlement: number;
  /** Total loan after LMI capitalisation (if enabled). */
  totalLoan: number;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface ShareCgtInput {
  portfolioValue: number;
  costBase: number;
  heldOver12Months: boolean;
  primaryFraction: number;
  primaryMarginalRate: number;
  partnerMarginalRate: number;
  medicareRate: number;
}

export interface ShareCgtResult {
  grossGain: number;
  discountApplied: boolean;
  taxableGain: number;
  cgtTax: number;
  netProceeds: number;
}

// ---------------------------------------------------------------------------
// Life events
// ---------------------------------------------------------------------------

export type LifeEventType = 'income-shock' | 'offset-deposit' | 'offset-withdrawal';

export interface LifeEvent {
  id: string;
  type: LifeEventType;
  label: string;
  /** 1-based month the event starts. */
  startMonth: number;
  /** Inclusive end month (equals startMonth for one-off events). */
  endMonth: number;
  /**
   * income-shock: partner income share during the event (0.5 = 50%).
   * offset-deposit / offset-withdrawal: one-off AUD amount.
   */
  value: number;
}

// ---------------------------------------------------------------------------
// Mortgage simulation
// ---------------------------------------------------------------------------

export interface MortgageSimInput {
  principal: number;
  annualRatePct: number;
  termYears: number;
  /** Extra monthly repayment on top of the base P&I. */
  extraMonthly: number;
  /** Initial 100% offset balance. */
  offsetInitial: number;
  /** Monthly contribution growing the offset balance. */
  offsetMonthlyContribution: number;
  familyLoan: {
    amount: number;
    monthlyRepayment: number;
    /** When true, freed family-loan repayment rolls into extra bank repayments. */
    snowball: boolean;
  };
  /** Partner net monthly take-home (used by income-shock life events). */
  partnerNetMonthly: number;
  lifeEvents: LifeEvent[];
  maxMonths: number;
}

export interface MortgageMonthRow {
  month: number;
  standardBalance: number;
  acceleratedBalance: number;
  offsetBalance: number;
  familyLoanBalance: number;
  standardInterestToDate: number;
  acceleratedInterestToDate: number;
}

export interface MortgageSimResult {
  baseMonthlyPayment: number;
  standardPayoffMonth: number | null;
  acceleratedPayoffMonth: number | null;
  /** Years (fractional) the accelerated path pays off earlier. */
  yearsSaved: number;
  lifetimeInterestSaved: number;
  standardTotalInterest: number;
  acceleratedTotalInterest: number;
  familyLoanSnowballMonth: number | null;
  bufferWentNegative: boolean;
  minBuffer: number;
  rows: MortgageMonthRow[];
}

// ---------------------------------------------------------------------------
// Exit planner (Phase 1)
// ---------------------------------------------------------------------------

export type CgtMode = 'ppor-always' | 'ppor-rented' | 'investment';
export type CgtRegime = 'standard' | 'post2027';
export type ScenarioBRepayment = 'pi' | 'io' | 'offset';
export type ScenarioId = 'A' | 'B' | 'C' | 'D';

export interface ExistingPropertyInput {
  value: number;
  originalPurchasePrice: number;
  /** Purchase stamp duty + costs added to the cost base (investment mode). */
  purchaseCosts: number;
  loanBalance: number;
  loanRatePct: number;
  loanTermMonthsRemaining: number;
  weeklyRent: number;
  vacancyWeeksPerYear: number;
  /** Property management fee, fraction of gross rent (0.1 = 10%). */
  pmFeePct: number;
  maintenanceAnnual: number;
  /** Non-cash Div 40/43 depreciation claimed annually. */
  depreciationAnnual: number;
  unimprovedLandValue: number;
  strataMonthly: number;
  councilMonthly: number;
  insuranceMonthly: number;
  waterMonthly: number;
  utilitiesMonthly: number;
  agentCommissionPct: number;
  marketingCost: number;
  legalCost: number;
  dischargeFee: number;
  cgtMode: CgtMode;
  /** Months the property was rented before the planned sale (6-year rule). */
  monthsRentedBeforeSale: number;
  /** Market value on the date first rented (s.118-192 cost base reset). */
  valueAtFirstRental: number;
  /** Total months owned (drives the 50% CGT discount). */
  heldMonths: number;
  cgtRegime: CgtRegime;
  /** Grandfathered negative gearing (held prior to 12 May 2026). */
  grandfatheredGearing: boolean;
}

export interface ExitPlannerInput {
  existing: ExistingPropertyInput;
  holdingPeriodMonths: number;
  /** Property growth mode for future value. */
  growthMode: 'annual' | 'fixed';
  annualGrowthPct: number;
  fixedFutureSalePrice: number;
  /** Starting liquid pool: cash + net share proceeds. */
  startingLiquidPool: number;
  householdNetMonthly: number;
  pureLifestyleMonthly: number;
  livingWithParentsMonthly: number;
  scenarioBRepayment: ScenarioBRepayment;
  savingsReturnRatePct: number;
  /** Marginal tax rates (incl. Medicare) used to tax investment returns. */
  primaryMarginalRate: number;
  partnerMarginalRate: number;
  primaryFraction: number;
  /** Months from "now" until 1 Jul 2027 (negative = already past). */
  monthsUntilGearingReform: number;
  /** CPI used by the post-2027 CGT reform mode (cost base indexation). */
  cpiPct: number;
}

export interface WealthPoint {
  month: number;
  wealth: number;
}

export interface LedgerLine {
  label: string;
  amount: number;
}

export interface ScenarioResult {
  id: ScenarioId;
  name: string;
  /** Total consolidated ending net wealth at month N (apples-to-apples). */
  endingWealth: number;
  /** Portion deployable toward the Phase 2 deposit. */
  deployableEquity: number;
  cgtPaid: number;
  totalInterestPaid: number;
  totalTaxPaid: number;
  wealthPath: WealthPoint[];
  ledger: LedgerLine[];
  /**
   * Case 1 (buying today) handoff: net sale proceeds if the property were
   * sold at Month 0 (scenarios A/C). 0 for B/D.
   */
  monthZeroSaleNet: number;
  /** Usable equity at Month 0 for Scenario D (80% LVR cap). */
  usableEquityNow: number;
}

export interface ExitPlannerResult {
  scenarios: Record<ScenarioId, ScenarioResult>;
  winnerId: ScenarioId;
  /** Exact dollar advantage of the winner over 2nd place. */
  winnerAdvantage: number;
  breakevenGrowthPct: number | null;
  breakevenRatePct: number | null;
}

// ---------------------------------------------------------------------------
// Future savings (Phase 2 deferred purchase)
// ---------------------------------------------------------------------------

export interface FutureSavingsInput {
  startingPool: number;
  months: number;
  fy: string;
  primaryGross: number;
  partnerGross: number;
  primaryHecs: boolean;
  partnerHecs: boolean;
  hasPrivateHospitalCover: boolean;
  dependentChildren: number;
  livingExpensesMonthly: number;
  savingsReturnRatePct: number;
  investmentMode: 'hisa' | 'etf';
  etfDividendYieldPct: number;
  sharesHeldOver12Months: boolean;
  annualWageGrowthPct: number;
  annualCpiPct: number;
  targetPrice: number;
  priceGrowthPct: number;
  primaryMarginalRate: number;
  partnerMarginalRate: number;
  primaryFraction: number;
}

export interface FutureSavingsResult {
  endingPool: number;
  preTaxGains: number;
  taxPaid: number;
  netAfterTaxGains: number;
  futureTargetPrice: number;
  months: number;
  path: { month: number; pool: number; targetPrice: number }[];
}

// ---------------------------------------------------------------------------
// Viability
// ---------------------------------------------------------------------------

export interface ViabilityInput {
  householdGrossAnnual: number;
  householdNetMonthly: number;
  /** New loan + retained IP debt (Scenario D) + family co-loan. */
  totalBankDebt: number;
  minMonthlyPI: number;
  apraMonthlyPI: number;
  hecsMonthly: number;
  familyLoanMonthly: number;
  livingExpensesMonthly: number;
  apraBufferPct: number;
  /** Net rental cashflow if a retained IP feeds Phase 2 (Scenario D). */
  retainedRentalMonthly: number;
}

export type ViabilityRating = 'secure' | 'caution' | 'high';

export interface ViabilityResult {
  dti: number;
  dtiStatus: 'ok' | 'tight' | 'high';
  repaymentStress: number;
  stressStatus: 'ok' | 'tight' | 'high';
  apraStatus: 'pass' | 'marginal' | 'fail';
  apraSurplus: number;
  apraAssessmentRatePct: number;
  surplusCushion: number;
  rating: ViabilityRating;
  explanations: string[];
}

// ---------------------------------------------------------------------------
// Master orchestrator
// ---------------------------------------------------------------------------

export type PurchaseCase = 1 | 2 | 3;

export interface RateSensitivityRow {
  label: string;
  ratePct: number;
  monthlyPI: number;
  totalLifetimeInterest: number;
  apraStatus: 'pass' | 'marginal' | 'fail';
  deltaVsPrimaryMonthly: number;
  deltaVsPrimaryInterest: number;
}

export interface EquityCurvePoint {
  year: number;
  propertyValue: number;
  standardBalance: number;
  acceleratedBalance: number;
  standardEquity: number;
  acceleratedEquity: number;
  offsetBalance: number;
}

export interface OrchestratorOutput {
  householdTax: HouseholdTaxResult;
  shares: ShareCgtResult;
  phase1: ExitPlannerResult | null;
  activePhase1: ScenarioResult | null;
  futureSavings: FutureSavingsResult | null;
  purchase: {
    case: PurchaseCase;
    effectivePrice: number;
    duty: StampDutyResult;
    depositPool: number;
    deposit: number;
    baseLoan: number;
    totalLoan: number;
    lvr: number;
    cashRequiredAtSettlement: number;
    poolShortfall: number;
    poolSource: string;
  };
  mortgage: MortgageSimResult;
  viability: ViabilityResult;
  rateSensitivity: RateSensitivityRow[];
  equityCurve: EquityCurvePoint[];
  /** Extra monthly swept by one-click surplus optimisation. */
  optimisedExtraMonthly: number;
  finalUnallocatedMonthly: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Saved scenarios / sync
// ---------------------------------------------------------------------------

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string; // ISO date
  state: PlannerState;
}

// ---------------------------------------------------------------------------
// AI settings
// ---------------------------------------------------------------------------

export type SearchProvider = 'none' | 'local-proxy' | 'serper';

export interface AiSettings {
  lmStudioBaseUrl: string;
  selectedModel: string;
  searchProvider: SearchProvider;
  localProxyUrl: string;
  serperApiKey: string;
}

export interface AiSuburbResult {
  suburb: string;
  region: string;
  medianHousePrice: number;
  medianUnitPrice: number;
  historicalGrowthRate: number;
  grossRentalYield: number;
  sources: string[];
  offlineEstimate: boolean;
}

export interface TaxDiffRow {
  label: string;
  builtIn: string;
  proposed: string;
  changed: boolean;
}

// ---------------------------------------------------------------------------
// Full planner state (persisted with schemaVersion)
// ---------------------------------------------------------------------------

export interface HoldingCostInput {
  value: number;
  period: 'annual' | 'quarterly' | 'monthly';
}

export interface PlannerState {
  schemaVersion: number;

  // Income & budget
  fy: string;
  primaryIncome: number;
  partnerIncome: number;
  primaryHecs: boolean;
  partnerHecs: boolean;
  hasPrivateHospitalCover: boolean;
  dependentChildren: number;
  pureLifestyleMonthly: number;
  livingWithParentsMonthly: number;
  holdingCosts: {
    strata: HoldingCostInput;
    council: HoldingCostInput;
    insurance: HoldingCostInput;
    water: HoldingCostInput;
    utilities: HoldingCostInput;
  };
  emergencyCashFloor: number;
  monthlyUnallocatedBuffer: number;
  optimizeSurplus: boolean;
  lifeEvents: LifeEvent[];

  // Assets & ownership
  cashSavings: number;
  sharePortfolioValue: number;
  sharePortfolioCostBase: number;
  sharesHeldOver12Months: boolean;
  otherAssets: number;
  includeOtherAssets: boolean;
  ownershipSplit: OwnershipSplit;
  familyLoanAmount: number;
  familyLoanAnnualRepayment: number;
  familyLoanSnowball: boolean;

  // Target property & loan
  suburb: string;
  suburbGrowthPct: number;
  targetPurchasePrice: number;
  fhabas: boolean;
  acquisitionCosts: AcquisitionCosts;
  lmiCapitalize: boolean;
  lmiOverride: number | null;
  loanInterestRatePct: number;
  offsetMonthlyContribution: number;
  extraMonthlyRepayment: number;

  // Future simulation (Phase 2 deferred purchase)
  futureSimulationEnabled: boolean;
  holdingPeriodMonths: number;
  startYear: number;
  startMonth: number;
  targetYear: number;
  targetMonth: number;
  inflateTargetPropertyPrice: boolean;
  wageGrowthEnabled: boolean;
  annualWageGrowthPct: number;
  cpiEnabled: boolean;
  annualLivingExpenseCpiPct: number;
  savingsReturnRatePct: number;
  investmentMode: 'hisa' | 'etf';
  etfDividendYieldPct: number;

  // Existing property (Phase 1)
  hasExistingProperty: boolean;
  existing: ExistingPropertyInput;
  exitScenarioChoice: 'auto' | ScenarioId;
  scenarioBRepayment: ScenarioBRepayment;
  growthMode: 'annual' | 'fixed';
  annualGrowthPct: number;
  fixedFutureSalePrice: number;

  // Saved scenarios & custom data
  savedScenarios: SavedScenario[];
  customSuburbs: SuburbLike[];
  customTaxTables: Record<string, string>; // label -> serialized YearTaxTable
  ai: AiSettings;
  theme: 'dark' | 'light';
}

/** Structural alias so the state file does not import data/ directly. */
export interface SuburbLike {
  name: string;
  region: string;
  medianHousePrice: number;
  medianUnitPrice: number;
  historicalGrowthRate: number;
  grossRentalYield: number;
  custom?: boolean;
  sources?: string[];
}

export type FinancialYearAlias = FinancialYear;
