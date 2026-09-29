/**
 * @fileoverview **ΤΟ ΠΡΟΧΕΙΡΟ ΤΟΥ ΠΙΝΕΛΟΥ ΘΟΛΩΜΑΤΟΣ** — οι κύκλοι που σχεδιάζει ο υπεύθυνος πάνω σε μια λήψη **πριν** πατήσει
 * «Εφαρμογή» (ADR-884 Φ2ζ ζ3 · §4.15). Καθαρός reducer.
 * @related `tour-redaction-edit.ts` (`applyRedactionEdits` — ο ΙΔΙΟΣ κριτής με τον γραφέα · `redactionEditsBetween` — η δέσμη) ·
 *   `components/spatial-tour/editor/redaction/*` (ο ΕΝΑΣ καλών)
 * @module lib/spatial-tour/tour-redaction-draft
 *
 * 🏆 **Πρόχειρο → Εφαρμογή σε δέσμη** (Matterport Blur Brush «Apply» · Zillow «review and edit blurs»): όσοι κύκλοι κι αν
 *   αλλάξουν, **μία** εντολή, **μία** επανα-ψήση, **μία** «Αναίρεση».
 * 🔑 **Η οθόνη δεν δείχνει ποτέ κύκλο που θα απορριφθεί**: κάθε βήμα κρίνεται από τον ίδιο κριτή με τον γραφέα, πάνω στα
 *   εφαρμοσμένα· άρνηση ⇒ το πρόχειρο μένει **ίδιο** (ίδιο αντικείμενο — ο React δεν ξαναζωγραφίζει).
 * 🔑 **Το id το κόβει ο καλών** (N.6, `enterpriseIdService`) τη στιγμή που **γεννιέται** ο κύκλος — εδώ καμία τυχαιότητα.
 */

import {
  TOUR_REDACTION_MAX_RADIUS_RAD,
  TOUR_REDACTION_MIN_RADIUS_RAD,
  type TourRedactionSource,
} from '@/constants/spatial-tour-vocabulary';
import { clamp } from '@/lib/geometry/scalar';
import type { TourRedaction, TourRedactionRegion } from '@/types/spatial-tour';

import type { TourRedactionEdit } from './tour-graph-edit';
import { angularDistance } from './tileset/tour-redaction-mask';
import { UNSTAMPED } from './tour-plan-edit';
import {
  applyRedactionEdits,
  normalizeRedactionRegion,
  redactionEditsBetween,
  type TourRedactionRegionWithId,
} from './tour-redaction-edit';

/** Ένας κύκλος του προχείρου — με την προέλευσή του (αυτόματο/χειροκίνητο), για τη λίστα. */
export type TourDraftRedaction = TourRedactionRegionWithId & { readonly source: TourRedactionSource };

export interface TourRedactionDraft {
  /** Η αλήθεια του διακομιστή — από εδώ μετρά η δέσμη. */
  readonly applied: readonly TourRedaction[];
  /** Ό,τι βλέπει ο υπεύθυνος τώρα. */
  readonly working: readonly TourDraftRedaction[];
  readonly selectedId: string | null;
}

export type TourRedactionDraftAction =
  | { readonly kind: 'add'; readonly id: string; readonly region: TourRedactionRegion }
  | { readonly kind: 'move'; readonly id: string; readonly yawRad: number; readonly pitchRad: number }
  | { readonly kind: 'resize'; readonly id: string; readonly radiusRad: number }
  /**
   * **Σχετικές** αλλαγές (πληκτρολόγιο): υπολογίζονται ΠΑΝΩ στην τρέχουσα κατάσταση, μέσα στον reducer — δύο πατήματα πριν
   * ξαναζωγραφίσει το React δεν διαβάζουν ποτέ μπαγιάτικη γεωμετρία (ζωντανά 2026-09-29: «−» ×2 έδινε ένα).
   */
  | { readonly kind: 'nudge'; readonly id: string; readonly dYawRad: number; readonly dPitchRad: number }
  | { readonly kind: 'scale'; readonly id: string; readonly factor: number }
  | { readonly kind: 'remove'; readonly id: string }
  | { readonly kind: 'select'; readonly id: string | null }
  | { readonly kind: 'discard' }
  /** Νέα αλήθεια από τον διακομιστή: χωρίς εκκρεμείς αλλαγές ⇒ το πρόχειρο την ακολουθεί· με αλλαγές ⇒ τις κρατά. */
  | { readonly kind: 'rebase'; readonly applied: readonly TourRedaction[] };

/** Η ακτίνα μέσα στα όρια — ο άνθρωπος που σέρνει πέρα από αυτά βλέπει τον κύκλο να σταματά, όχι να εξαφανίζεται. */
export function clampRedactionRadius(radiusRad: number): number {
  return clamp(radiusRad, TOUR_REDACTION_MIN_RADIUS_RAD, TOUR_REDACTION_MAX_RADIUS_RAD);
}

const workingOf = (applied: readonly TourRedaction[]): TourDraftRedaction[] =>
  applied.map(({ id, yawRad, pitchRad, radiusRad, source }) => ({ id, yawRad, pitchRad, radiusRad, source }));

export function initialRedactionDraft(applied: readonly TourRedaction[]): TourRedactionDraft {
  return { applied, working: workingOf(applied), selectedId: null };
}

/** **Η δέσμη του προχείρου** — ό,τι θα σταλεί με «Εφαρμογή» (κενή ⇒ τίποτα να εφαρμοστεί). */
export function draftEdits(draft: TourRedactionDraft): TourRedactionEdit[] {
  return redactionEditsBetween(draft.applied, draft.working);
}

/** Δεκτό από τον κριτή του γραφέα; */
function admissible(applied: readonly TourRedaction[], working: readonly TourDraftRedaction[]): boolean {
  return applyRedactionEdits(applied, redactionEditsBetween(applied, working), UNSTAMPED).kind !== 'refused';
}

/** Νέα γεωμετρία ενός κύκλου — κανονικοποιημένη, ή `null` αν δεν στέκει. */
function reshaped(item: TourDraftRedaction, region: TourRedactionRegion): TourDraftRedaction | null {
  const normal = normalizeRedactionRegion(region);
  return normal === null ? null : { ...item, ...normal };
}

function withWorking(draft: TourRedactionDraft, working: readonly TourDraftRedaction[], selectedId: string | null): TourRedactionDraft {
  return admissible(draft.applied, working) ? { ...draft, working, selectedId } : draft;
}

function replaceOne(draft: TourRedactionDraft, id: string, region: (item: TourDraftRedaction) => TourRedactionRegion): TourRedactionDraft {
  const item = draft.working.find((r) => r.id === id);
  const next = item === undefined ? null : reshaped(item, region(item));
  if (next === null) return draft;
  return withWorking(draft, draft.working.map((r) => (r.id === id ? next : r)), id);
}

function added(draft: TourRedactionDraft, id: string, region: TourRedactionRegion): TourRedactionDraft {
  if (draft.working.some((r) => r.id === id)) return draft;
  const normal = normalizeRedactionRegion({ ...region, radiusRad: clampRedactionRadius(region.radiusRad) });
  if (normal === null) return draft;
  return withWorking(draft, [...draft.working, { id, ...normal, source: 'manual' }], id);
}

export function redactionDraftReducer(draft: TourRedactionDraft, action: TourRedactionDraftAction): TourRedactionDraft {
  switch (action.kind) {
    case 'add': return added(draft, action.id, action.region);
    case 'move': return replaceOne(draft, action.id, (r) => ({ yawRad: action.yawRad, pitchRad: action.pitchRad, radiusRad: r.radiusRad }));
    case 'resize': return replaceOne(draft, action.id, (r) => ({ yawRad: r.yawRad, pitchRad: r.pitchRad, radiusRad: clampRedactionRadius(action.radiusRad) }));
    case 'nudge': return replaceOne(draft, action.id, (r) => ({
      yawRad: r.yawRad + action.dYawRad, pitchRad: clamp(r.pitchRad + action.dPitchRad, -Math.PI / 2, Math.PI / 2), radiusRad: r.radiusRad,
    }));
    case 'scale': return replaceOne(draft, action.id, (r) => ({ yawRad: r.yawRad, pitchRad: r.pitchRad, radiusRad: clampRedactionRadius(r.radiusRad * action.factor) }));
    case 'remove': {
      if (!draft.working.some((r) => r.id === action.id)) return draft;
      const selectedId = draft.selectedId === action.id ? null : draft.selectedId;
      return { ...draft, working: draft.working.filter((r) => r.id !== action.id), selectedId };
    }
    case 'select':
      return draft.selectedId === action.id || (action.id !== null && !draft.working.some((r) => r.id === action.id))
        ? draft : { ...draft, selectedId: action.id };
    case 'discard': return initialRedactionDraft(draft.applied);
    case 'rebase': return rebased(draft, action.applied);
  }
}

function rebased(draft: TourRedactionDraft, applied: readonly TourRedaction[]): TourRedactionDraft {
  if (draftEdits(draft).length > 0) return { ...draft, applied };
  const working = workingOf(applied);
  const selectedId = working.some((r) => r.id === draft.selectedId) ? draft.selectedId : null;
  return { applied, working, selectedId };
}

/** Πώς ζωγραφίζεται ένας κύκλος στην προεπισκόπηση — ό,τι ξέρει ο shader. */
export type TourRedactionPreviewState = 'applied' | 'draft' | 'selected' | 'removing';

export interface TourRedactionPreview extends TourRedactionRegion {
  readonly state: TourRedactionPreviewState;
}

/**
 * **Η προεπισκόπηση** — εφαρμοσμένοι (ήδη θολωμένοι στα πλακίδια: μόνο περίγραμμα) · πρόχειροι (θόλωμα **τώρα**, στον shader) ·
 * επιλεγμένος · υπό αφαίρεση (τα πλακίδια είναι ακόμη θολωμένα ως την επανα-ψήση: περίγραμμα «θα φύγει»).
 */
export function redactionPreviewOf(draft: TourRedactionDraft): TourRedactionPreview[] {
  const applied = new Map(draft.applied.map((r) => [r.id, r]));
  const live = draft.working.map((r): TourRedactionPreview => {
    const was = applied.get(r.id);
    const same = was !== undefined && was.yawRad === r.yawRad && was.pitchRad === r.pitchRad && was.radiusRad === r.radiusRad;
    const state: TourRedactionPreviewState = r.id === draft.selectedId ? 'selected' : same ? 'applied' : 'draft';
    return { yawRad: r.yawRad, pitchRad: r.pitchRad, radiusRad: r.radiusRad, state };
  });
  const kept = new Set(draft.working.map((r) => r.id));
  const removing = draft.applied.filter((r) => !kept.has(r.id))
    .map((r): TourRedactionPreview => ({ yawRad: r.yawRad, pitchRad: r.pitchRad, radiusRad: r.radiusRad, state: 'removing' }));
  return [...live, ...removing];
}

/**
 * **Ποιος κύκλος είναι κάτω από αυτή την κατεύθυνση;** — ο **μικρότερος** που την περιέχει (ένας μικρός κύκλος μέσα σε μεγάλο
 * παραμένει πιάσιμος, όπως στο Figma), ή `null`.
 */
export function redactionAt(working: readonly TourDraftRedaction[], yawRad: number, pitchRad: number): string | null {
  let best: TourDraftRedaction | null = null;
  for (const r of working) {
    if (angularDistance(yawRad, pitchRad, r.yawRad, r.pitchRad) > r.radiusRad) continue;
    if (best === null || r.radiusRad < best.radiusRad) best = r;
  }
  return best?.id ?? null;
}

/** Πόσο μεγαλώνει/μικραίνει ο κύκλος ανά πάτημα `+`/`−` (γεωμετρικά — ίδια αίσθηση σε μικρό και μεγάλο κύκλο). */
export const REDACTION_KEY_RESIZE_FACTOR = 1.15;
/** Βήμα μετακίνησης με βελάκι, ως κλάσμα του οπτικού πεδίου — ίδια απόσταση στην οθόνη σε κάθε ζουμ. */
export const REDACTION_KEY_MOVE_FRACTION = 1 / 40;

/**
 * **Πλήκτρο πάνω στη λαβή ενός κύκλου ⇒ ενέργεια** (Figma: βελάκια = μετακίνηση, Delete = αφαίρεση) — `null` ⇒ δεν ανήκει στη
 * λαβή (ο browser το κρατά: `Tab` κ.λπ.). Το yaw μεγαλώνει προς τα δεξιά, το pitch προς τα πάνω (σύμβαση `tour-viewer-view`).
 * Πάντα **σχετική** ενέργεια (`nudge` · `scale`): ποτέ απόλυτη τιμή από το τελευταίο render.
 */
export function redactionKeyAction(key: string, id: string, fovRad: number): TourRedactionDraftAction | null {
  const step = fovRad * REDACTION_KEY_MOVE_FRACTION;
  const nudge = (dYawRad: number, dPitchRad: number): TourRedactionDraftAction => ({ kind: 'nudge', id, dYawRad, dPitchRad });
  switch (key) {
    case 'ArrowLeft': return nudge(-step, 0);
    case 'ArrowRight': return nudge(step, 0);
    case 'ArrowUp': return nudge(0, step);
    case 'ArrowDown': return nudge(0, -step);
    case '+':
    case '=': return { kind: 'scale', id, factor: REDACTION_KEY_RESIZE_FACTOR };
    case '-':
    case '_': return { kind: 'scale', id, factor: 1 / REDACTION_KEY_RESIZE_FACTOR };
    case 'Delete':
    case 'Backspace': return { kind: 'remove', id };
    default: return null;
  }
}
