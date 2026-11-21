/**
 * @fileoverview **Ο κανόνας επίλυσης ΚΑΔ** — ό,τι γράψει ο άνθρωπος, το ΓΕΜΗ ή το AI → μία γραμμή του καταλόγου.
 * @related lib/kad/kad-types.ts · scripts/kad/build-kad-2025.mjs (επαληθεύει τον ΙΔΙΟ κανόνα πριν γράψει)
 * @module lib/kad/kad-resolve
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΑΝΟΝΑΣ ΣΥΓΚΡΟΥΣΗΣ ΤΩΝ 8 ΨΗΦΙΩΝ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το ΓΕΜΗ/ΑΑΔΕ δείχνουν τον ΚΑΔ ως 8 ψηφία: κωδικός χωρίς τελείες, συμπληρωμένος δεξιά με `0`.
 * Η μορφή **δεν είναι ένα-προς-ένα**: `41`, `41.0` και `41.00` δίνουν όλα `41000000`.
 * Επαληθευμένο απέναντι στις περιγραφές του ΓΕΜΗ: νικά ο **ρηχότερος** υποψήφιος με επίπεδο
 * **≥ τάξη** (`NN.NN`)· αν κανείς δεν φτάνει την τάξη, ο **βαθύτερος** διαθέσιμος.
 * (41000000→41.00 · 71122000→71.12.2 · 43221000→43.22.1, όχι 43.22.10.)
 *
 * 🔑 **ΕΠΙΛΕΞΙΜΟ = ΤΑΞΗ ΚΑΙ ΒΑΘΥΤΕΡΑ.** Το ΓΕΜΗ καταχωρίζει δραστηριότητες από την τάξη και κάτω·
 * τομείς, κλάδοι και ομάδες είναι **επικεφαλίδες** της ταξινόμησης, όχι δηλώσιμες δραστηριότητες.
 */

import {
  KAD_CATALOG_VERSION,
  KAD_LEVELS,
  type KadCatalog,
  type KadCatalogEntry,
  type KadLevel,
  type KadSelection,
} from './kad-types';

const DOTTED_CODE = /^\d{2}(\.\d(\d(\.\d(\d(\.\d{2})?)?)?)?)?$/;
const DIGITS = /^\d+$/;
const GEMI_LENGTH = 8;
/** Λιγότερα από 4 ψηφία (π.χ. «41») είναι κλάδος/ομάδα — ποτέ δηλώσιμος ΚΑΔ, άρα όχι αποδεκτή είσοδος. */
const MIN_BARE_DIGITS = 4;
const CLASS_DEPTH = KAD_LEVELS.indexOf('class');

/** Η κανονικοποιημένη μορφή μιας εισόδου: κωδικός με τελείες, ή 8 ψηφία ΓΕΜΗ. */
export type KadInput =
  | { readonly kind: 'dotted'; readonly code: string; readonly gemi: string }
  | { readonly kind: 'gemi'; readonly gemi: string };

/** Βάθος επιπέδου (0 = τομέας). */
export function kadDepth(level: KadLevel): number {
  return KAD_LEVELS.indexOf(level);
}

/** Επιλέξιμος ΚΑΔ = τάξη (`NN.NN`) ή βαθύτερα. */
export function isSelectableKad(entry: KadCatalogEntry): boolean {
  return kadDepth(entry.level) >= CLASS_DEPTH;
}

/** Κωδικός με τελείες → 8 ψηφία ΓΕΜΗ (`41.00.11` → `41001100`). */
export function formatKadGemi(code: string): string {
  return code.replace(/\./g, '').padEnd(GEMI_LENGTH, '0');
}

/**
 * Ωμή είσοδος → κανονική μορφή, ή `null`. Δέχεται `41000000`, `41.00`, `4100`, `41.00.11 `,
 * `4100 1100` (τα κενά αγνοούνται). Δεν δέχεται κείμενο, ούτε < 4 σκέτα ψηφία.
 */
export function normalizeKadInput(raw: string): KadInput | null {
  const compact = raw.replace(/\s+/g, '');
  if (compact === '') return null;
  if (compact.includes('.')) {
    return DOTTED_CODE.test(compact) ? { kind: 'dotted', code: compact, gemi: formatKadGemi(compact) } : null;
  }
  if (!DIGITS.test(compact) || compact.length < MIN_BARE_DIGITS || compact.length > GEMI_LENGTH) return null;
  return { kind: 'gemi', gemi: compact.padEnd(GEMI_LENGTH, '0') };
}

/** Ανάμεσα σε γραμμές με το ΙΔΙΟ 8ψήφιο: ποια κερδίζει (ο κανόνας σύγκρουσης). */
export function pickGemiWinner(candidates: readonly KadCatalogEntry[]): KadCatalogEntry | null {
  let best: KadCatalogEntry | null = null;
  for (const entry of candidates) {
    if (best === null) {
      best = entry;
      continue;
    }
    const depth = kadDepth(entry.level);
    const bestDepth = kadDepth(best.level);
    const bothSelectable = depth >= CLASS_DEPTH && bestDepth >= CLASS_DEPTH;
    const better = bothSelectable ? depth < bestDepth : depth > bestDepth;
    if (better) best = entry;
  }
  return best;
}

/**
 * Ωμή είσοδος → γραμμή του καταλόγου, ή `null`. Κωδικός με τελείες που υπάρχει αυτούσιος κερδίζει·
 * αλλιώς αποφασίζουν τα 8 ψηφία με τον κανόνα σύγκρουσης.
 */
export function resolveKad(catalog: KadCatalog, raw: string): KadCatalogEntry | null {
  const input = normalizeKadInput(raw);
  if (input === null) return null;
  if (input.kind === 'dotted') {
    const exact = catalog.byCode.get(input.code);
    if (exact) return exact;
  }
  return catalog.byGemi.get(input.gemi) ?? null;
}

/** Ό,τι αποθηκεύεται όταν επιλέγεται γραμμή του καταλόγου. */
export function toKadSelection(entry: KadCatalogEntry): KadSelection {
  return { code: entry.code, description: entry.description, catalog: KAD_CATALOG_VERSION };
}

/**
 * Αποθηκευμένη τιμή ΧΩΡΙΣ σημαία καταλόγου = ΚΑΔ 2008 (ο παλιός κατάλογος). Δείχνεται αυτούσια με
 * σήμα «απαιτεί αντιστοίχιση» — **ποτέ** δεν ξαναγράφεται σιωπηλά.
 */
export function isLegacyKadValue(value: { readonly code: string; readonly catalog?: string }): boolean {
  return value.code.trim() !== '' && value.catalog !== KAD_CATALOG_VERSION;
}
