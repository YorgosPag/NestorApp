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
 *   - anything else        → the ONE comparison, `lib/geocoding/field-match`
 *
 * 🔴 **Η σύγκριση ΔΕΝ γράφεται πια εδώ** (ADR-332 D28, 2026-09-14). Ήταν δεύτερο αντίγραφο της
 * κρίσης του διακομιστή και είχε αποκλίνει: ο Τ.Κ. «546 24» ⇄ «54624» ήταν `match` στον διακομιστή
 * και **«Ασυμφωνία»** στο badge. Εδώ μένει μόνο η **μετάφραση** της κρίσης σε σχήμα badge.
 *
 * @module components/shared/addresses/editor/hooks/useAddressFieldStatus
 * @see ADR-332 §3.2 AddressFieldStatus
 */

'use client';

import { useMemo } from 'react';
import {
  COMPARABLE_ADDRESS_FIELDS,
  compareAddressField,
  type ComparableAddressField,
} from '@/lib/geocoding/field-match';
import type {
  AddressEditorState,
  AddressFieldStatus,
  GeocodingApiResponse,
  ResolvedAddressFields,
} from '../types';

export type AddressFieldStatusMap = Record<keyof ResolvedAddressFields, AddressFieldStatus>;

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
  field: ComparableAddressField,
  userValue: string | undefined,
  resolved: ResolvedAddressFields,
): AddressFieldStatus {
  const userTrim = (userValue ?? '').trim();
  const resolvedTrim = (resolved[field] ?? '').trim();
  const kind = compareAddressField(field, userValue, resolved);
  switch (kind) {
    case 'not-provided':
      return resolvedTrim === '' ? { kind } : { kind, resolvedValue: resolvedTrim };
    case 'unknown':
      return { kind, userValue: userTrim };
    case 'broader':
      return { kind, userValue: userTrim };
    case 'match':
    case 'mismatch':
      return { kind, userValue: userTrim, resolvedValue: resolvedTrim };
  }
}

function buildPendingMap(): AddressFieldStatusMap {
  const map = {} as AddressFieldStatusMap;
  for (const field of COMPARABLE_ADDRESS_FIELDS) {
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
    for (const field of COMPARABLE_ADDRESS_FIELDS) {
      map[field] = computeStatus(field, userInput[field], resolved);
    }
    return map;
  }, [state, userInput]);
}

export const __test__ = { computeStatus, buildPendingMap };
