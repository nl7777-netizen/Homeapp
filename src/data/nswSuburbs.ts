/**
 * Curated baseline list of 35+ NSW suburbs with indicative market data.
 * Values are a curated 2026 baseline for planning estimates only — not
 * investment advice. The AI Suburb Lookup can refresh figures and save
 * custom suburbs on top of this list.
 */

export type SuburbRegion =
  | 'Sydney CBD & Inner West'
  | 'Eastern Suburbs'
  | 'Northern Beaches'
  | 'Inner North'
  | 'Hills & Western Sydney'
  | 'Parramatta & CBD West'
  | 'Central Coast'
  | 'Hunter Valley'
  | 'Illawarra'
  | 'Central Tablelands'
  | 'Northern NSW'
  | 'Regional NSW';

export interface Suburb {
  name: string;
  region: SuburbRegion;
  medianHousePrice: number;
  medianUnitPrice: number;
  /** Indicative annual median price growth, fraction (0.045 = 4.5% p.a.). */
  historicalGrowthRate: number;
  /** Indicative gross rental yield, fraction. */
  grossRentalYield: number;
  /** True when the suburb came from AI lookup or user entry, not the baseline. */
  custom?: boolean;
  /** Source URLs when AI-derived. */
  sources?: string[];
}

export const NSW_SUBURBS: Suburb[] = [
  { name: 'Sydney (CBD)', region: 'Sydney CBD & Inner West', medianHousePrice: 1_450_000, medianUnitPrice: 950_000, historicalGrowthRate: 0.045, grossRentalYield: 0.03 },
  { name: 'Surry Hills', region: 'Sydney CBD & Inner West', medianHousePrice: 2_300_000, medianUnitPrice: 1_350_000, historicalGrowthRate: 0.04, grossRentalYield: 0.028 },
  { name: 'Newtown', region: 'Sydney CBD & Inner West', medianHousePrice: 1_650_000, medianUnitPrice: 980_000, historicalGrowthRate: 0.042, grossRentalYield: 0.031 },
  { name: 'Bondi', region: 'Eastern Suburbs', medianHousePrice: 3_200_000, medianUnitPrice: 1_900_000, historicalGrowthRate: 0.04, grossRentalYield: 0.027 },
  { name: 'Bronte', region: 'Eastern Suburbs', medianHousePrice: 2_900_000, medianUnitPrice: 1_700_000, historicalGrowthRate: 0.04, grossRentalYield: 0.027 },
  { name: 'Mosman', region: 'Eastern Suburbs', medianHousePrice: 4_200_000, medianUnitPrice: 2_600_000, historicalGrowthRate: 0.035, grossRentalYield: 0.025 },
  { name: 'Woollahra', region: 'Eastern Suburbs', medianHousePrice: 3_800_000, medianUnitPrice: 2_400_000, historicalGrowthRate: 0.035, grossRentalYield: 0.025 },
  { name: 'Manly', region: 'Northern Beaches', medianHousePrice: 3_000_000, medianUnitPrice: 1_750_000, historicalGrowthRate: 0.04, grossRentalYield: 0.028 },
  { name: 'Dee Why', region: 'Northern Beaches', medianHousePrice: 3_600_000, medianUnitPrice: 2_200_000, historicalGrowthRate: 0.036, grossRentalYield: 0.026 },
  { name: 'Chatswood', region: 'Inner North', medianHousePrice: 1_600_000, medianUnitPrice: 1_050_000, historicalGrowthRate: 0.045, grossRentalYield: 0.032 },
  { name: 'Hornsby', region: 'Inner North', medianHousePrice: 2_100_000, medianUnitPrice: 1_250_000, historicalGrowthRate: 0.04, grossRentalYield: 0.03 },
  { name: 'Crows Nest', region: 'Inner North', medianHousePrice: 1_750_000, medianUnitPrice: 1_150_000, historicalGrowthRate: 0.042, grossRentalYield: 0.031 },
  { name: 'Epping', region: 'Hills & Western Sydney', medianHousePrice: 1_550_000, medianUnitPrice: 950_000, historicalGrowthRate: 0.045, grossRentalYield: 0.033 },
  { name: 'Eastwood', region: 'Hills & Western Sydney', medianHousePrice: 1_450_000, medianUnitPrice: 900_000, historicalGrowthRate: 0.045, grossRentalYield: 0.033 },
  { name: 'Castle Hill', region: 'Hills & Western Sydney', medianHousePrice: 1_900_000, medianUnitPrice: 1_100_000, historicalGrowthRate: 0.04, grossRentalYield: 0.031 },
  { name: 'Baulkham Hills', region: 'Hills & Western Sydney', medianHousePrice: 1_750_000, medianUnitPrice: 1_000_000, historicalGrowthRate: 0.04, grossRentalYield: 0.032 },
  { name: 'Blacktown', region: 'Hills & Western Sydney', medianHousePrice: 1_350_000, medianUnitPrice: 780_000, historicalGrowthRate: 0.05, grossRentalYield: 0.035 },
  { name: 'Schofields', region: 'Hills & Western Sydney', medianHousePrice: 1_150_000, medianUnitPrice: 700_000, historicalGrowthRate: 0.055, grossRentalYield: 0.036 },
  { name: 'Marsden Park', region: 'Hills & Western Sydney', medianHousePrice: 1_100_000, medianUnitPrice: 650_000, historicalGrowthRate: 0.055, grossRentalYield: 0.037 },
  { name: 'Penrith', region: 'Hills & Western Sydney', medianHousePrice: 1_050_000, medianUnitPrice: 620_000, historicalGrowthRate: 0.055, grossRentalYield: 0.038 },
  { name: 'Campbelltown', region: 'Hills & Western Sydney', medianHousePrice: 1_100_000, medianUnitPrice: 600_000, historicalGrowthRate: 0.05, grossRentalYield: 0.038 },
  { name: 'Liverpool', region: 'Hills & Western Sydney', medianHousePrice: 1_000_000, medianUnitPrice: 560_000, historicalGrowthRate: 0.05, grossRentalYield: 0.039 },
  { name: 'Bankstown', region: 'Hills & Western Sydney', medianHousePrice: 1_150_000, medianUnitPrice: 650_000, historicalGrowthRate: 0.05, grossRentalYield: 0.037 },
  { name: 'Fairfield', region: 'Hills & Western Sydney', medianHousePrice: 950_000, medianUnitPrice: 520_000, historicalGrowthRate: 0.055, grossRentalYield: 0.04 },
  { name: 'Parramatta', region: 'Parramatta & CBD West', medianHousePrice: 1_500_000, medianUnitPrice: 900_000, historicalGrowthRate: 0.045, grossRentalYield: 0.034 },
  { name: 'Rhodes', region: 'Parramatta & CBD West', medianHousePrice: 1_600_000, medianUnitPrice: 1_000_000, historicalGrowthRate: 0.045, grossRentalYield: 0.033 },
  { name: 'Richmond', region: 'Parramatta & CBD West', medianHousePrice: 1_300_000, medianUnitPrice: 750_000, historicalGrowthRate: 0.045, grossRentalYield: 0.035 },
  { name: 'Windsor', region: 'Parramatta & CBD West', medianHousePrice: 1_100_000, medianUnitPrice: 650_000, historicalGrowthRate: 0.045, grossRentalYield: 0.036 },
  { name: 'Gosford', region: 'Central Coast', medianHousePrice: 1_100_000, medianUnitPrice: 650_000, historicalGrowthRate: 0.045, grossRentalYield: 0.037 },
  { name: 'Wyong', region: 'Central Coast', medianHousePrice: 1_050_000, medianUnitPrice: 620_000, historicalGrowthRate: 0.045, grossRentalYield: 0.038 },
  { name: 'Umina Beach', region: 'Central Coast', medianHousePrice: 1_250_000, medianUnitPrice: 750_000, historicalGrowthRate: 0.042, grossRentalYield: 0.036 },
  { name: 'Newcastle', region: 'Hunter Valley', medianHousePrice: 850_000, medianUnitPrice: 520_000, historicalGrowthRate: 0.045, grossRentalYield: 0.039 },
  { name: 'Maitland', region: 'Hunter Valley', medianHousePrice: 720_000, medianUnitPrice: 440_000, historicalGrowthRate: 0.045, grossRentalYield: 0.041 },
  { name: 'Lake Macquarie', region: 'Hunter Valley', medianHousePrice: 800_000, medianUnitPrice: 480_000, historicalGrowthRate: 0.04, grossRentalYield: 0.04 },
  { name: 'Wollongong', region: 'Illawarra', medianHousePrice: 950_000, medianUnitPrice: 560_000, historicalGrowthRate: 0.045, grossRentalYield: 0.038 },
  { name: 'Shellharbour', region: 'Illawarra', medianHousePrice: 750_000, medianUnitPrice: 440_000, historicalGrowthRate: 0.045, grossRentalYield: 0.041 },
  { name: 'Nowra', region: 'Illawarra', medianHousePrice: 850_000, medianUnitPrice: 500_000, historicalGrowthRate: 0.044, grossRentalYield: 0.039 },
  { name: 'Orange', region: 'Central Tablelands', medianHousePrice: 780_000, medianUnitPrice: 450_000, historicalGrowthRate: 0.045, grossRentalYield: 0.042 },
  { name: 'Bathurst', region: 'Central Tablelands', medianHousePrice: 620_000, medianUnitPrice: 380_000, historicalGrowthRate: 0.04, grossRentalYield: 0.045 },
  { name: 'Tamworth', region: 'Northern NSW', medianHousePrice: 600_000, medianUnitPrice: 380_000, historicalGrowthRate: 0.045, grossRentalYield: 0.044 },
  { name: 'Armidale', region: 'Northern NSW', medianHousePrice: 520_000, medianUnitPrice: 320_000, historicalGrowthRate: 0.035, grossRentalYield: 0.046 },
  { name: 'Coffs Harbour', region: 'Northern NSW', medianHousePrice: 700_000, medianUnitPrice: 430_000, historicalGrowthRate: 0.04, grossRentalYield: 0.043 },
  { name: 'Port Macquarie', region: 'Northern NSW', medianHousePrice: 750_000, medianUnitPrice: 450_000, historicalGrowthRate: 0.04, grossRentalYield: 0.043 },
  { name: 'Dubbo', region: 'Regional NSW', medianHousePrice: 560_000, medianUnitPrice: 350_000, historicalGrowthRate: 0.04, grossRentalYield: 0.045 },
];

/** Structural record accepted for both built-in Suburb[] and user SuburbLike[]. */
export interface SuburbRecord {
  name: string;
  region: string;
  medianHousePrice: number;
  medianUnitPrice: number;
  historicalGrowthRate: number;
  grossRentalYield: number;
  custom?: boolean;
  sources?: string[];
}

export function findSuburb(name: string, customs: SuburbRecord[] = []): SuburbRecord | undefined {
  return customs.find((s) => s.name.toLowerCase() === name.toLowerCase())
    ?? NSW_SUBURBS.find((s) => s.name.toLowerCase() === name.toLowerCase());
}
