/**
 * level-optimistic-overlay — ό,τι ο viewer **ξέρει ήδη** για τα επίπεδα πριν του το πει η συνδρομή
 * (ADR-914 §2.9).
 *
 * ## Γιατί υπάρχει
 *
 * Τα επίπεδα γράφονται μέσω `/api/dxf-levels` (Admin SDK, ADR-286) και διαβάζονται από
 * `onSnapshot`. Εγγραφή από τον διακομιστή **δεν** έχει την αντιστάθμιση καθυστέρησης που δίνει
 * το Firestore στις εγγραφές του πελάτη: ανάμεσα στην απάντηση του αιτήματος και στην ηχώ της
 * συνδρομής η λίστα **δεν περιέχει** αυτό που μόλις έγινε. Μετρημένο 2026-10-11: ένα νέο επίπεδο
 * έμπαινε στη λίστα 6-9 s μετά το κλικ, και σε συνεδρία στενεμένη σε κτήριο (`?bldg=`) ένα
 * πρόχειρο δεν έμπαινε **ποτέ** — το ερώτημα δεν το περιείχε.
 *
 * ## Η αρχή
 *
 * Η λίστα της συνδρομής μένει η **μία** πηγή αλήθειας. Πάνω της κάθεται ένα στρώμα με ό,τι
 * επιβεβαίωσε ο διακομιστής αλλά δεν έχει αντηχήσει ακόμη:
 *
 * - **γεννημένα** — επίπεδα που δημιούργησε αυτή η συνεδρία· φεύγουν μόλις τα φέρει η συνδρομή·
 * - **διορθώσεις** — πεδία που άλλαξε αυτή η συνεδρία· φεύγουν μόλις η συνδρομή πει το ίδιο.
 *
 * Το στρώμα **συμφιλιώνεται**, δεν διπλασιάζει: η ηχώ κερδίζει πάντα, και μια εγγραφή του
 * στρώματος δεν επιβιώνει της επιβεβαίωσής της.
 *
 * Pure: καμία εξάρτηση από React ή Firebase.
 *
 * @module subapps/dxf-viewer/systems/levels/level-optimistic-overlay
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md
 */

import type { Level } from './config';

/** Τα πεδία που μπορεί να διορθώσει το στρώμα — ό,τι αλλάζει ο άνθρωπος και περιμένει να δει αμέσως. */
export type LevelPatch = Partial<Pick<Level, 'name'>>;

export interface LevelOverlay {
  /** Επίπεδα που γέννησε αυτή η συνεδρία και δεν έχουν αντηχήσει ακόμη. */
  readonly born: readonly Level[];
  /** Διορθώσεις ανά επίπεδο που δεν έχουν αντηχήσει ακόμη. */
  readonly patches: Readonly<Record<string, LevelPatch>>;
}

export const EMPTY_LEVEL_OVERLAY: LevelOverlay = { born: [], patches: {} };

function isEmptyOverlay(overlay: LevelOverlay): boolean {
  return overlay.born.length === 0 && Object.keys(overlay.patches).length === 0;
}

/** Τα πεδία της διόρθωσης που η βάση **δεν** λέει ακόμη. */
function unsettledFields(level: Level, patch: LevelPatch): LevelPatch {
  const pending: LevelPatch = {};
  if (patch.name !== undefined && patch.name !== level.name) pending.name = patch.name;
  return pending;
}

/**
 * Η λίστα που βλέπει ο viewer: η βάση, συν τα γεννημένα που λείπουν ακόμη, με τις διορθώσεις από
 * πάνω. Κενό στρώμα ⇒ επιστρέφει **την ίδια αναφορά** (κανένα περιττό re-render, ADR-040).
 */
export function applyLevelOverlay(base: Level[], overlay: LevelOverlay): Level[] {
  if (isEmptyOverlay(overlay)) return base;
  const known = new Set(base.map((l) => l.id));
  const awaiting = overlay.born.filter((l) => !known.has(l.id));
  const merged = awaiting.length > 0 ? [...base, ...awaiting].sort((a, b) => a.order - b.order) : base;
  if (Object.keys(overlay.patches).length === 0) return merged;
  return merged.map((level) => {
    const patch = overlay.patches[level.id];
    return patch ? { ...level, ...patch } : level;
  });
}

/**
 * Συμφιλίωση με νέα βάση: φεύγει ό,τι αντήχησε. Διόρθωση για επίπεδο που δεν υπάρχει πια (ούτε
 * στη βάση ούτε στα γεννημένα) φεύγει επίσης. Τίποτα να φύγει ⇒ **η ίδια αναφορά**.
 */
export function settleLevelOverlay(base: readonly Level[], overlay: LevelOverlay): LevelOverlay {
  if (isEmptyOverlay(overlay)) return overlay;
  const byId = new Map(base.map((l) => [l.id, l]));
  const born = overlay.born.filter((l) => !byId.has(l.id));
  const awaiting = new Set(born.map((l) => l.id));

  const patches: Record<string, LevelPatch> = {};
  let patchesChanged = false;
  for (const [id, patch] of Object.entries(overlay.patches)) {
    const echoed = byId.get(id);
    const pending = echoed ? unsettledFields(echoed, patch) : awaiting.has(id) ? patch : {};
    if (Object.keys(pending).length > 0) patches[id] = pending;
    if (Object.keys(pending).length !== Object.keys(patch).length) patchesChanged = true;
  }

  if (born.length === overlay.born.length && !patchesChanged) return overlay;
  return { born, patches };
}

/** Το επίπεδο γεννήθηκε (ο διακομιστής απάντησε) — μπαίνει στη λίστα πριν από την ηχώ. */
export function withBornLevel(overlay: LevelOverlay, level: Level): LevelOverlay {
  if (overlay.born.some((l) => l.id === level.id)) return overlay;
  return { ...overlay, born: [...overlay.born, level] };
}

/** Ο άνθρωπος άλλαξε πεδία — φαίνονται αμέσως, μέχρι να τα πει και η συνδρομή. */
export function withLevelPatch(overlay: LevelOverlay, levelId: string, patch: LevelPatch): LevelOverlay {
  return { ...overlay, patches: { ...overlay.patches, [levelId]: { ...overlay.patches[levelId], ...patch } } };
}

/**
 * Η εγγραφή απέτυχε — η διόρθωση αποσύρεται. Μόνο όσα πεδία έχουν **ακόμη** την τιμή που
 * απέτυχε: νεότερη διόρθωση του ίδιου πεδίου δεν πειράζεται.
 */
export function withoutLevelPatch(overlay: LevelOverlay, levelId: string, failed: LevelPatch): LevelOverlay {
  const current = overlay.patches[levelId];
  if (!current) return overlay;
  const kept: LevelPatch = {};
  if (current.name !== undefined && current.name !== failed.name) kept.name = current.name;
  const { [levelId]: _dropped, ...rest } = overlay.patches;
  return { ...overlay, patches: Object.keys(kept).length > 0 ? { ...rest, [levelId]: kept } : rest };
}

/** Το επίπεδο διαγράφηκε από αυτή τη συνεδρία — δεν μένει φάντασμα στο στρώμα. */
export function withoutLevel(overlay: LevelOverlay, levelId: string): LevelOverlay {
  if (!overlay.patches[levelId] && !overlay.born.some((l) => l.id === levelId)) return overlay;
  const { [levelId]: _dropped, ...patches } = overlay.patches;
  return { born: overlay.born.filter((l) => l.id !== levelId), patches };
}

/** Περιμένει ακόμη την ηχώ του αυτό το επίπεδο; */
export function isAwaitingEcho(overlay: LevelOverlay, levelId: string): boolean {
  return overlay.born.some((l) => l.id === levelId);
}
