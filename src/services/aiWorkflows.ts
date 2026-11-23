/**
 * Three local AI capabilities (LM Studio + optional search):
 *  1. Private AI Scenario Review — serializes deterministic financial
 *     outputs into a structured prompt, streamed from LM Studio.
 *  2. AI NSW Suburb Lookup — search snippets -> GBNF json_schema
 *     extraction -> validation/clamping -> local-DB offline fallback.
 *  3. Safe Tax & Duty Update Checker — structured extraction of latest
 *     ATO/Revenue NSW figures, diffed against built-in tables. Changes are
 *     NEVER applied without explicit user confirmation.
 */

import { TAX_TABLES, type FinancialYear } from '../data/taxTables';
import { findSuburb, NSW_SUBURBS, type Suburb } from '../data/nswSuburbs';
import type { AiSettings, AiSuburbResult, OrchestratorOutput, TaxDiffRow } from '../types/planner';
import { chatCompletion, parseJsonLoose, type ChatMessage } from './lmStudioClient';
import { webSearch } from './searchClient';

const fmt = (n: number): string => `$${Math.round(n).toLocaleString('en-AU')}`;

// ---------------------------------------------------------------------------
// 1. Private AI Scenario Review
// ---------------------------------------------------------------------------

export const QUICK_PROMPTS = [
  'Audit my winning Exit Strategy & identify the #1 risk',
  'Find tax or cashflow inefficiencies in my setup',
  'Stress-test my plan against a +1.5% rate hike',
] as const;

/** Serialize deterministic outputs into a compact, self-contained prompt. */
export function buildScenarioReviewPrompt(
  output: OrchestratorOutput,
  question: string,
  lifeEvents: { label: string }[] = [],
): string {
  const t = output.householdTax;
  const p = output.purchase;
  const m = output.mortgage;
  const v = output.viability;
  const lines: string[] = [
    'You are a senior Australian financial planner specialising in NSW property. Be precise, quantitative and concise. Cite the numbers given below; do not invent data.',
    '',
    '== HOUSEHOLD (FY ' + t.fy + ') ==',
    `Gross income: primary ${fmt(t.primary.gross)}, partner ${fmt(t.partner.gross)}; household net take-home ${fmt(t.householdNet)}/yr (${fmt(t.netMonthly)}/mo).`,
    `Tax: income tax ${fmt(t.householdIncomeTax)}, Medicare ${fmt(t.householdMedicare)}, MLS ${fmt(t.householdMls)}, HECS ${fmt(t.householdHecs)}.`,
    '',
    '== PHASE 2 PURCHASE ==',
    `Case ${p.case}. Effective price ${fmt(p.effectivePrice)}; deposit pool ${fmt(p.depositPool)} (${p.poolSource}); deposit ${fmt(p.deposit)}; loan ${fmt(p.totalLoan)}; LVR ${(p.lvr * 100).toFixed(1)}%; duty ${fmt(p.duty.netDuty)}; LMI ${fmt(p.duty.lmiTotal)}; settlement cash required ${fmt(p.cashRequiredAtSettlement)}.`,
    `Min monthly P&I ${fmt(m.baseMonthlyPayment)}; standard payoff ${m.standardPayoffMonth ? `${Math.floor(m.standardPayoffMonth / 12)}y ${m.standardPayoffMonth % 12}m` : '>50y'}; accelerated payoff ${m.acceleratedPayoffMonth ? `${Math.floor(m.acceleratedPayoffMonth / 12)}y ${m.acceleratedPayoffMonth % 12}m` : 'not within 50y'}; lifetime interest saved ${fmt(m.lifetimeInterestSaved)}.`,
    `Viability: ${v.rating.toUpperCase()} — DTI ${v.dti}x, stress ${(v.repaymentStress * 100).toFixed(1)}%, APRA ${v.apraStatus} (${v.apraSurplus >= 0 ? '+' : '-'}${fmt(Math.abs(v.apraSurplus))}/mo), surplus cushion ${fmt(v.surplusCushion)}/mo.`,
  ];

  if (output.phase1) {
    const s = output.phase1.scenarios;
    lines.push(
      '',
      '== PHASE 1 EXIT PLANNER ==',
      `Winner: Scenario ${output.phase1.winnerId} (${s[output.phase1.winnerId].name}) by ${fmt(output.phase1.winnerAdvantage)} over 2nd place.`,
      `Ending wealth — A: ${fmt(s.A.endingWealth)} | B: ${fmt(s.B.endingWealth)} | C: ${fmt(s.C.endingWealth)} | D: ${fmt(s.D.endingWealth)}.`,
      `Breakeven growth rate: ${output.phase1.breakevenGrowthPct === null ? 'n/a' : output.phase1.breakevenGrowthPct + '%'}; breakeven interest rate: ${output.phase1.breakevenRatePct === null ? 'n/a' : output.phase1.breakevenRatePct + '%'}.`,
    );
  }
  if (output.futureSavings) {
    const f = output.futureSavings;
    lines.push(`Future savings: ending pool ${fmt(f.endingPool)} (pre-tax gains ${fmt(f.preTaxGains)}, tax ${fmt(f.taxPaid)}); inflated target price ${fmt(f.futureTargetPrice)}.`);
  }
  if (output.householdTax.householdHecs > 0) lines.push(`HECS/HELP repayments: ${fmt(output.householdTax.householdHecs)}/yr.`);
  if (lifeEvents.length > 0) lines.push(`Active life events: ${lifeEvents.map((e) => e.label).join('; ')}.`);
  lines.push('', '== QUESTION ==', question);
  return lines.join('\n');
}

export interface AiReviewStream {
  run: (question: string, onToken: (t: string) => void, signal?: AbortSignal) => Promise<string>;
}

/** Streaming scenario review against the user's local LM Studio. */
export function createScenarioReview(
  baseUrl: string,
  model: string,
  output: OrchestratorOutput,
  lifeEvents: { label: string }[] = [],
): AiReviewStream {
  return {
    async run(question: string, onToken: (t: string) => void, signal?: AbortSignal): Promise<string> {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a private, local Australian financial-planning assistant. All data is provided in the user message. Answer with concrete numbers and ranked recommendations.' },
        { role: 'user', content: buildScenarioReviewPrompt(output, question, lifeEvents) },
      ];
      return chatCompletion(baseUrl, { model, messages, temperature: 0.2, stream: true, onToken, signal });
    },
  };
}

// ---------------------------------------------------------------------------
// 2. AI NSW Suburb Lookup
// ---------------------------------------------------------------------------

const SUBURB_QUERY = (suburb: string): string =>
  `${suburb} NSW median house price median unit price 5 year growth rental yield domain realestate`;

const SUBURB_SCHEMA = {
  name: 'suburb_facts',
  schema: {
    type: 'object',
    properties: {
      suburb: { type: 'string' },
      region: { type: 'string' },
      medianHousePrice: { type: 'number' },
      medianUnitPrice: { type: 'number' },
      historicalGrowthRate: { type: 'number' },
      grossRentalYield: { type: 'number' },
      sources: { type: 'array', items: { type: 'string' } },
    },
    required: ['suburb', 'medianHousePrice', 'medianUnitPrice', 'historicalGrowthRate', 'grossRentalYield', 'sources'],
  },
  strict: true,
} as const;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function regionFor(suburb: string): string {
  return findSuburb(suburb)?.region ?? 'NSW (other)';
}

/**
 * Step 1: search snippets. Step 2: LM Studio GBNF structured extraction.
 * Step 3: validate/clamp + offline fallback to the local suburb database
 * with an explicit "Offline Estimate" badge.
 */
export async function suburbLookup(suburb: string, settings: AiSettings): Promise<AiSuburbResult> {
  const outcome = await webSearch(SUBURB_QUERY(suburb), settings);

  if (outcome.hits.length > 0 && settings.selectedModel) {
    const snippets = outcome.hits
      .slice(0, 6)
      .map((h, i) => `${i + 1}. ${h.title} — ${h.snippet} (source: ${h.url})`)
      .join('\n');
    try {
      const raw = await chatCompletion(settings.lmStudioBaseUrl, {
        model: settings.selectedModel,
        temperature: 0,
        maxTokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'Extract NSW suburb market facts from the search snippets. Return ONLY the JSON object. Rates are annual fractions (0.045 = 4.5%). Prices are AUD.',
          },
          {
            role: 'user',
            content: `Suburb: ${suburb} NSW\n\nSnippets:\n${snippets}\n\nReturn JSON with keys: suburb, region, medianHousePrice, medianUnitPrice, historicalGrowthRate, grossRentalYield, sources (URLs used).`,
          },
        ],
        responseFormat: { type: 'json_schema', json_schema: SUBURB_SCHEMA },
      });
      const parsed = parseJsonLoose<{
        suburb: string;
        region?: string;
        medianHousePrice: number;
        medianUnitPrice: number;
        historicalGrowthRate: number;
        grossRentalYield: number;
        sources?: string[];
      }>(raw);
      return {
        suburb: parsed.suburb || suburb,
        region: parsed.region || regionFor(suburb),
        medianHousePrice: clamp(Number(parsed.medianHousePrice) || 0, 300_000, 15_000_000),
        medianUnitPrice: clamp(Number(parsed.medianUnitPrice) || 0, 300_000, 15_000_000),
        historicalGrowthRate: clamp(Number(parsed.historicalGrowthRate) || 0, -0.05, 0.2),
        grossRentalYield: clamp(Number(parsed.grossRentalYield) || 0, 0, 0.1),
        sources: (parsed.sources ?? []).slice(0, 6),
        offlineEstimate: false,
      };
    } catch {
      // Fall through to offline fallback.
    }
  }

  // Offline fallback: local curated database + regional benchmark.
  const local = findSuburb(suburb);
  if (local) {
    return {
      suburb: local.name,
      region: local.region,
      medianHousePrice: local.medianHousePrice,
      medianUnitPrice: local.medianUnitPrice,
      historicalGrowthRate: local.historicalGrowthRate,
      grossRentalYield: local.grossRentalYield,
      sources: [],
      offlineEstimate: true,
    };
  }
  // Regional benchmark estimation from the closest region average.
  const regional = NSW_SUBURBS.slice(0, 10);
  const avg = (f: (s: Suburb) => number): number => regional.reduce((a, s) => a + f(s), 0) / regional.length;
  return {
    suburb,
    region: 'NSW (regional benchmark)',
    medianHousePrice: Math.round(avg((s) => s.medianHousePrice) / 1000) * 1000,
    medianUnitPrice: Math.round(avg((s) => s.medianUnitPrice) / 1000) * 1000,
    historicalGrowthRate: avg((s) => s.historicalGrowthRate),
    grossRentalYield: avg((s) => s.grossRentalYield),
    sources: [],
    offlineEstimate: true,
  };
}

// ---------------------------------------------------------------------------
// 3. Safe AI Tax & Duty Update Checker (diff preview, never auto-applied)
// ---------------------------------------------------------------------------

const TAX_SCHEMA = {
  name: 'tax_update',
  schema: {
    type: 'object',
    properties: {
      fy: { type: 'string' },
      brackets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'number' },
            to: { type: 'number' },
            baseTax: { type: 'number' },
            rate: { type: 'number' },
          },
          required: ['from', 'to', 'baseTax', 'rate'],
        },
      },
      medicareLevyRate: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['fy', 'brackets'],
  },
  strict: true,
} as const;

export interface TaxUpdateProposal {
  fy: string;
  brackets: { from: number; to: number; baseTax: number; rate: number }[];
  medicareLevyRate: number | null;
  notes: string;
  diff: TaxDiffRow[];
}

const money = (n: number): string => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-AU')}` : '∞');
const pct = (n: number): string => `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2)}%`;

/**
 * Fetch latest ATO figures via search + LM Studio, then build a side-by-side
 * diff against the built-in table for the same FY (or the closest one).
 */
export async function taxUpdateCheck(targetFy: string, settings: AiSettings): Promise<TaxUpdateProposal> {
  const outcome = await webSearch(
    `ATO ${targetFy} resident tax brackets income tax table medicare levy rate Australia`,
    settings,
  );
  if (outcome.hits.length === 0 || !settings.selectedModel) {
    throw new Error('Search unavailable — start the local search proxy or configure Serper, then retry.');
  }
  const snippets = outcome.hits
    .slice(0, 6)
    .map((h, i) => `${i + 1}. ${h.title} — ${h.snippet} (source: ${h.url})`)
    .join('\n');
  const raw = await chatCompletion(settings.lmStudioBaseUrl, {
    model: settings.selectedModel,
    temperature: 0,
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content:
          'Extract Australian resident income tax brackets from the snippets. Rates are fractions (0.3 = 30%). Use to: -1 for the top bracket. Return ONLY the JSON object.',
      },
      { role: 'user', content: `Target FY: ${targetFy}\n\nSnippets:\n${snippets}` },
    ],
    responseFormat: { type: 'json_schema', json_schema: TAX_SCHEMA },
  });
  const parsed = parseJsonLoose<{
    fy: string;
    brackets: { from: number; to: number; baseTax: number; rate: number }[];
    medicareLevyRate?: number;
    notes?: string;
  }>(raw);

  // Diff against built-in (same FY if present, else the default FY).
  const builtIn = TAX_TABLES[(targetFy in TAX_TABLES ? targetFy : '2026-27') as FinancialYear];
  const diff: TaxDiffRow[] = [];
  const maxLen = Math.max(parsed.brackets.length, builtIn.brackets.length);
  for (let i = 0; i < maxLen; i++) {
    const b = parsed.brackets[i];
    const o = builtIn.brackets[i];
    const label = `Tier ${i + 1}: ${money(b ? b.from : o?.from ?? 0)}–${money(b ? (b.to < 0 ? Infinity : b.to) : o?.to ?? 0)}`;
    const proposed = b ? `${pct(b.rate)} over ${money(b.from)} (base ${money(b.baseTax)})` : '—';
    const builtInStr = o ? `${pct(o.rate)} over ${money(o.from)} (base ${money(o.baseTax)})` : '—';
    diff.push({
      label,
      builtIn: builtInStr,
      proposed,
      changed: !b || !o || b.from !== o.from || b.to < 0 !== (o.to === Infinity) || b.baseTax !== o.baseTax || b.rate !== o.rate,
    });
  }
  const medicareLine =
    parsed.medicareLevyRate !== undefined
      ? { label: 'Medicare levy rate', builtIn: pct(builtIn.medicare.rate), proposed: pct(parsed.medicareLevyRate), changed: parsed.medicareLevyRate !== builtIn.medicare.rate }
      : null;
  if (medicareLine) diff.push(medicareLine);

  return {
    fy: parsed.fy || targetFy,
    brackets: parsed.brackets,
    medicareLevyRate: parsed.medicareLevyRate ?? null,
    notes: parsed.notes ?? '',
    diff,
  };
}
