import { useMemo } from 'react';
import { runMasterPlanner } from '../engine/masterOrchestrator';
import { usePlannerStore } from '../store/usePlannerStore';

/** Deterministic full pipeline output, recomputed only when state changes. */
export function usePlannerOutput() {
  const state = usePlannerStore((s) => s.state);
  return useMemo(() => runMasterPlanner(state), [state]);
}
