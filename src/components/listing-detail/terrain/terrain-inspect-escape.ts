/**
 * @fileoverview **ΤΟ Esc ΤΗΣ ΕΠΙΘΕΩΡΗΣΗΣ ΕΔΑΦΟΥΣ** — το ΕΝΑ σημείο όπου η επιθεώρηση (κάτοψη ΚΑΙ 3Δ) ρωτά «είναι Escape;»
 *   (ADR-920 §14.10 · ADR-364 escape-command-bus).
 * @related ./useTerrainMapPointer (κάτοψη) · ./3d/Terrain3dCanvas (3Δ) · `@/lib/a11y/keyboard-scope` (ADR-711)
 * @module components/listing-detail/terrain/terrain-inspect-escape
 *
 * 🔑 **Δύο στάδια, όπως Figma / VS Code / Revit**: το Esc καθαρίζει την επιθεώρηση **μόνο αν υπάρχει κάτι** (σημείο,
 *   καρφίτσα, τομή) και τότε **το καταναλώνει** (`stopPropagation`). Αν δεν υπάρχει τίποτα, το αφήνει να ανέβει — ώστε να
 *   κλείσει ό,τι άλλο το περιμένει (π.χ. διάλογος γύρω από την προεπισκόπηση).
 * 🔑 **Ποτέ πίσω από modal**: ρωτά πρώτα το `isModalKeyboardScopeActive()` — το SSoT που μοιράζονται και τα δύο δέντρα.
 * 🔑 **Δεν είναι ακροατής window**: καλείται από `onKeyDown` του ίδιου του χάρτη / καμβά, άρα μόνο όταν έχουν εστίαση.
 */

import type { KeyboardEvent } from 'react';

import { claimEscape } from '@/lib/a11y/escape-layers';
import { isModalKeyboardScopeActive } from '@/lib/a11y/keyboard-scope';

import type { TerrainInspectStore } from './terrain-inspect-store';

/** Ο ιδιοκτήτης του πατήματος στο συμβόλαιο του `escape-layers` (ADR-364 §10.15.γ — βαθμίδα 3, «ιδιοκτήτης στο στοιχείο»). */
const ESCAPE_OWNER_ID = 'listing-detail/terrain-inspect';

/** `true` αν το Esc καθάρισε κάτι (και καταναλώθηκε)· `false` αν δεν ήταν Esc, αν το πήρε ήδη άλλος, ή δεν υπήρχε τίποτα. */
export function clearInspectOnEscape(store: TerrainInspectStore, e: KeyboardEvent<Element>): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing || isModalKeyboardScopeActive()) return false;
  const state = store.get();
  if (state.probe === null && state.pinned === null && state.profileLine === null) return false;
  store.clearProbe();
  store.unpin();
  store.clearProfile();
  e.preventDefault();
  e.stopPropagation();
  claimEscape(e.nativeEvent, ESCAPE_OWNER_ID);
  return true;
}
