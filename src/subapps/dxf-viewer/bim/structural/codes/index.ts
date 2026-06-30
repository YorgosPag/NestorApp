/**
 * Structural code registry (ADR-456 — Στατικά, Slice 1).
 *
 * Resolves a `StructuralCodeId` → provider. The active code is a PROJECT-level
 * setting (Giorgio: «και τα δύο επιλέξιμο»). Default = Eurocode (current Greek
 * statutory code); ΕΚΩΣ/ΕΑΚ is opt-in for existing-building assessment.
 *
 * @see ./structural-code-types.ts
 */

import { EUROCODE_PROVIDER } from './eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from './greek-legacy-provider';
import type {
  StructuralCodeId,
  StructuralCodeProvider,
} from './structural-code-types';

export type {
  StructuralCodeId,
  StructuralCodeProvider,
  ColumnSectionContext,
  ColumnReinforcementLimits,
  BeamSectionContext,
} from './structural-code-types';

const PROVIDERS: Readonly<Record<StructuralCodeId, StructuralCodeProvider>> = {
  eurocode: EUROCODE_PROVIDER,
  'greek-legacy': GREEK_LEGACY_PROVIDER,
};

/** Default κανονισμός — ισχύων στην Ελλάδα (Ευρωκώδικες). */
export const DEFAULT_STRUCTURAL_CODE: StructuralCodeId = 'eurocode';

/** Ordered list για UI dropdown. */
export const STRUCTURAL_CODE_ORDER: readonly StructuralCodeId[] = ['eurocode', 'greek-legacy'];

/** Επίλυσε κανονισμό από id· fallback στον default αν άγνωστος. */
export function resolveStructuralCode(id: StructuralCodeId | undefined | null): StructuralCodeProvider {
  return (id && PROVIDERS[id]) || PROVIDERS[DEFAULT_STRUCTURAL_CODE];
}

/** Type guard — true όταν το string είναι έγκυρο `StructuralCodeId`. */
export function isStructuralCodeId(value: string | undefined | null): value is StructuralCodeId {
  return value != null && value in PROVIDERS;
}
