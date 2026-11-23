/**
 * Planner state store (Zustand). Clean separation: pure state + actions;
 * auto-save to localStorage is wired in main.tsx via subscribe.
 * The holding horizon (holdingPeriodMonths) is kept in bi-directional sync
 * with the Phase 2 start/target dates.
 */

import { create } from 'zustand';
import {
  defaultState,
  decodeSyncCode,
  importJson,
  loadPersistedState,
  persistState,
  snapshotScenario,
} from '../services/persistence';
import type {
  AiSettings,
  ExistingPropertyInput,
  HoldingCostInput,
  LifeEvent,
  PlannerState,
  SuburbLike,
} from '../types/planner';

function monthsBetween(startYear: number, startMonth: number, targetYear: number, targetMonth: number): number {
  return Math.max(1, (targetYear - startYear) * 12 + (targetMonth - startMonth));
}

function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export interface PlannerStore {
  state: PlannerState;

  set: (patch: Partial<PlannerState>) => void;
  setExisting: (patch: Partial<ExistingPropertyInput>) => void;
  setHoldingCost: (key: keyof PlannerState['holdingCosts'], patch: Partial<HoldingCostInput>) => void;
  setAi: (patch: Partial<AiSettings>) => void;

  /** Phase 1 <-> Phase 2 horizon sync (target date -> months). */
  setTargetDate: (year: number, month: number) => void;
  /** Phase 2 -> Phase 1 horizon sync (months -> target date). */
  setHoldingPeriodMonths: (n: number) => void;

  addLifeEvent: (e: Omit<LifeEvent, 'id'>) => void;
  updateLifeEvent: (id: string, patch: Partial<LifeEvent>) => void;
  removeLifeEvent: (id: string) => void;

  saveScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;

  importPayload: (raw: unknown) => void;
  importJsonText: (text: string) => void;
  applySyncCode: (code: string) => string | null;
  addCustomSuburb: (s: SuburbLike) => void;
  saveCustomTaxTable: (label: string, tableJson: string) => void;

  toggleTheme: () => void;
  resetToDefaults: () => void;
  persistNow: () => void;
}

export const usePlannerStore = create<PlannerStore>((set, get) => ({
  state: loadPersistedState(),

  set: (patch) => set((s) => ({ state: { ...s.state, ...patch } })),

  setExisting: (patch) =>
    set((s) => ({ state: { ...s.state, existing: { ...s.state.existing, ...patch } } })),

  setHoldingCost: (key, patch) =>
    set((s) => ({
      state: {
        ...s.state,
        holdingCosts: { ...s.state.holdingCosts, [key]: { ...s.state.holdingCosts[key], ...patch } },
      },
    })),

  setAi: (patch) => set((s) => ({ state: { ...s.state, ai: { ...s.state.ai, ...patch } } })),

  setTargetDate: (year, month) =>
    set((s) => {
      const n = monthsBetween(s.state.startYear, s.state.startMonth, year, month);
      return { state: { ...s.state, targetYear: year, targetMonth: month, holdingPeriodMonths: n } };
    }),

  setHoldingPeriodMonths: (n) =>
    set((s) => {
      const t = addMonths(s.state.startYear, s.state.startMonth, Math.max(1, Math.round(n)));
      return { state: { ...s.state, holdingPeriodMonths: Math.max(1, Math.round(n)), targetYear: t.year, targetMonth: t.month } };
    }),

  addLifeEvent: (e) =>
    set((s) => ({
      state: {
        ...s.state,
        lifeEvents: [
          ...s.state.lifeEvents,
          { ...e, id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        ].slice(0, 5), // up to 5 life events
      },
    })),

  updateLifeEvent: (id, patch) =>
    set((s) => ({
      state: {
        ...s.state,
        lifeEvents: s.state.lifeEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    })),

  removeLifeEvent: (id) =>
    set((s) => ({ state: { ...s.state, lifeEvents: s.state.lifeEvents.filter((e) => e.id !== id) } })),

  saveScenario: (name) =>
    set((s) => ({
      state: {
        ...s.state,
        savedScenarios: [...s.state.savedScenarios, snapshotScenario(name || `Scenario ${s.state.savedScenarios.length + 1}`, s.state)],
      },
    })),

  loadScenario: (id) => {
    const sc = get().state.savedScenarios.find((x) => x.id === id);
    if (sc) set({ state: { ...get().state, ...sc.state, savedScenarios: get().state.savedScenarios } });
  },

  deleteScenario: (id) =>
    set((s) => ({
      state: { ...s.state, savedScenarios: s.state.savedScenarios.filter((x) => x.id !== id) },
    })),

  importPayload: (raw) => set({ state: importJson(JSON.stringify(raw)) }),

  importJsonText: (text) => set({ state: importJson(text) }),

  applySyncCode: (code) => {
    try {
      const st = decodeSyncCode(code);
      set({ state: st });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid sync code.';
    }
  },

  addCustomSuburb: (sub) =>
    set((s) => ({
      state: {
        ...s.state,
        customSuburbs: [
          ...s.state.customSuburbs.filter((x) => x.name.toLowerCase() !== sub.name.toLowerCase()),
          { ...sub, custom: true },
        ],
        suburb: sub.name,
      },
    })),

  saveCustomTaxTable: (label, tableJson) =>
    set((s) => ({
      state: {
        ...s.state,
        customTaxTables: { ...s.state.customTaxTables, [label]: tableJson },
        fy: label,
      },
    })),

  toggleTheme: () =>
    set((s) => {
      const theme = s.state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      return { state: { ...s.state, theme } };
    }),

  resetToDefaults: () => set({ state: defaultState() }),

  persistNow: () => persistState(get().state),
}));

/** Convenience selectors. */
export const selectState = (s: PlannerStore): PlannerState => s.state;
