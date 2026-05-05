/**
 * =============================================================================
 * useAddressFieldStatus — Per-field badge derivation (ADR-332 Phase 1, Layer 4)
 * =============================================================================
 *
 * Translates the current editor state + user input + Nominatim resolved fields
 * into a `Record<field, AddressFieldStatus>` consumed by `<AddressFieldBadge>`
 * (Phase 3). Pure derivation — no side effects.
 *
 * Status rules per field:
 *   - phase=loading        → 'pending'
 *   - user empty + resolved empty → 'not-provided' (no resolvedValue)
 *   - user empty + resolved set   → 'not-provided' (with resolvedValue, suggesting auto-fill)
 *   - user set   + resolved empty → 'unknown'
 *   - user equals resolved  → 'match'
 *   - user differs resolved → 'mismatch'
 *
 * Comparison reuses the same normalization rules as `diffAddressFields`.
 *
 * @module components/shared/addresses/editor/hooks/useAddressFieldStatus
 * @see ADR-332 §3.2 AddressFieldStatus
 */

'use client';

import { useMemo } from 'react';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import type {
  AddressEditorState,
  AddressFieldStatus,
  GeocodingApiResponse,
  ResolvedAddressFields,
} from '../types';

const COMPARABLE_FIELDS: ReadonlyArray<keyof ResolvedAddressFields> = [
  'street',
  'number',
  'postalCode',
  'neighborhood',
  'city',
  'county',
  'region',
  'country',
];

export type AddressFieldStatusMap = Record<keyof ResolvedAddressFields, AddressFieldStatus>;

function normalize(value: string | undefined): string {
  if (!value) return '';
  return normalizeGreekText(value.trim()).toLowerCase();
}

function extractResult(state: AddressEditorState): GeocodingApiResponse | null {
  switch (state.phase) {
    case 'success':
    case 'partial':
    case 'conflict':
      return state.result;
    case 'stale':
      return state.lastResult;
    default:
      return null;
  }
}

function computeStatus(
  userValue: string | undefined,
  resolvedValue: string | undefined,
): AddressFieldStatus {
  const userTrim = (userValue ?? '').trim();
  const resolvedTrim = (resolvedValue ?? '').trim();
  if (userTrim.length === 0 && resolvedTrim.length === 0) {
    return { kind: 'not-provided' };
  }
  if (userTrim.length === 0) {
    return { kind: 'not-provided', resolvedValue: resolvedTrim };
  }
  if (resolvedTrim.length === 0) {
    return { kind: 'unknown', userValue: userTrim };
  }
  if (normalize(userTrim) === normalize(resolvedTrim)) {
    return { kind: 'match', userValue: userTrim, resolvedValue: resolvedTrim };
  }
  return { kind: 'mismatch', userValue: userTrim, resolvedValue: resolvedTrim };
}

function buildPendingMap(): AddressFieldStatusMap {
  const map = {} as AddressFieldStatusMap;
  for (const field of COMPARABLE_FIELDS) {
    map[field] = { kind: 'pending' };
  }
  return map;
}

export function useAddressFieldStatus(
  state: AddressEditorState,
  userInput: ResolvedAddressFields,
): AddressFieldStatusMap {
  return useMemo(() => {
    if (state.phase === 'loading') return buildPendingMap();
    const result = extractResult(state);
    const resolved: ResolvedAddressFields = result?.resolvedFields ?? {};
    const map = {} as AddressFieldStatusMap;
    for (const field of COMPARABLE_FIELDS) {
      map[field] = computeStatus(userInput[field], resolved[field]);
    }
    return map;
  }, [state, userInput]);
}

export const __test__ = { computeStatus, buildPendingMap };
