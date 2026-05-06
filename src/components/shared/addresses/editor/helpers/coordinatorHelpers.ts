/**
 * Pure helpers used by the AddressEditor coordinator (ADR-332 Layer 6).
 * Extracted to keep AddressEditor.tsx ≤500 lines (N.7.1).
 *
 * @module components/shared/addresses/editor/helpers/coordinatorHelpers
 */

import type { CorrectionAction, FieldActionsMap } from '@/services/geocoding/address-corrections-telemetry.service';
import type { ReconciliationDecisionMap } from '../hooks/useAddressReconciliation';
import type { AddressEditorState, GeocodingApiResponse, ResolvedAddressFields } from '../types';

export function extractResult(state: AddressEditorState): GeocodingApiResponse | null {
  if (
    state.phase === 'success' ||
    state.phase === 'partial' ||
    state.phase === 'conflict'
  ) {
    return state.result;
  }
  if (state.phase === 'stale') return state.lastResult;
  return null;
}

export function buildFieldActionsMap(decisions: ReconciliationDecisionMap): FieldActionsMap {
  const map: FieldActionsMap = {};
  for (const [field, decision] of Object.entries(decisions) as Array<[keyof ResolvedAddressFields, 'apply' | 'keep']>) {
    map[field] = decision === 'apply' ? 'corrected-to-resolved' : 'kept';
  }
  return map;
}

export function resolveReconciliationAction(decisions: ReconciliationDecisionMap): CorrectionAction {
  const vals = Object.values(decisions);
  if (vals.every(v => v === 'keep')) return 'kept-user';
  return 'mixed-correction';
}
