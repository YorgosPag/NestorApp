/**
 * glyph-atlas-report-store.ts — η **ορατή** κατάσταση του κοινού glyph atlas (ADR-739 Φ.Θ / Φ1).
 *
 * ## Το πρόβλημα που κλείνει
 * Ο `GlyphAtlas` είναι ΕΝΑ κοινό 2048² raster (~16 MB) που μοιράζονται όλα τα κείμενα του
 * σχεδίου. Όταν γεμίσει, η γλυφή γύριζε `hasInk:false` + **ένα** `console.warn` — δηλαδή
 * **κείμενο που εξαφανίζεται από την οθόνη με όλες τις πύλες πράσινες**. Μετρημένο στη
 * `glyph-atlas-capacity.test.ts`: χωράνε **840** γλυφές = **4,83 όψεις** του ελληνικού
 * συνόλου CAD (174/όψη).
 *
 * Ένα `console.warn` δεν είναι όργανο: κανείς δεν βλέπει κονσόλα σε παραγωγή. Αυτό το store
 * μετατρέπει την αποτυχία από **σιωπή** σε **κατάσταση** — με το ίδιο σχήμα που το έργο ήδη
 * χρησιμοποιεί για «κάτι δεν αποδόθηκε, πες το στον χρήστη» (`missing-font-store.ts`,
 * ADR-344 Φ2). **Δεύτερος μηχανισμός δεν γεννιέται** (N.0.2 / CHECK 3.28).
 *
 * ## Γιατί χαμηλής συχνότητας
 * Ενημερώνεται **μία φορά ανά χτίσιμο atlas** (άνοιγμα αρχείου / αλλαγή ορόφων), ποτέ ανά
 * καρέ. Καταναλώνεται από leaf subscriber μέσω `useSyncExternalStore` — ποτέ από orchestrator
 * (ADR-040, CHECK 6C).
 *
 * @module subapps/dxf-viewer/bim-3d/converters/glyph-atlas-report-store
 * @see bim-3d/converters/glyph-atlas.ts — ο μοναδικός συγγραφέας
 * @see text-engine/fonts/missing-font-store.ts — το αδελφό σχήμα που μιμείται
 */

import { createExternalStore } from '../../stores/createExternalStore';

/** Μία γλυφή που ζητήθηκε και **δεν** χώρεσε — αρκετά για να την αναγνωρίσει ο μηχανικός. */
export interface GlyphAtlasMiss {
  /** Η όψη όπως την ονομάζει το `resolveTextFont` (`c:family|weight|italic` ή `f:cacheName`). */
  readonly faceKey: string;
  /** Ο χαρακτήρας που χάθηκε (ένα code point). */
  readonly char: string;
}

/**
 * Ό,τι ξέρει το atlas για τον εαυτό του μετά από ένα χτίσιμο.
 *
 * ⚠️ Το `missing` είναι **κομμένο** στο `MISS_REPORT_CAP`: σε ένα πολύγλωσσο σχέδιο μπορεί να
 * χαθούν χιλιάδες γλυφές και μια απεριόριστη λίστα θα ήταν διαρροή μνήμης σε δομή που ζει όσο
 * το αρχείο. Το `missingCount` κρατά την **αλήθεια** — η λίστα είναι δείγμα για διάγνωση.
 */
export interface GlyphAtlasReport {
  /** Πόσες μοναδικές (όψη, χαρακτήρας) ζητήθηκαν. */
  readonly requested: number;
  /** Πόσες πήραν πραγματικό κελί. */
  readonly admitted: number;
  /** Πόσες **δεν** χώρεσαν συνολικά (≥ `missing.length`). */
  readonly missingCount: number;
  /** Δείγμα των γλυφών που χάθηκαν, μέχρι `MISS_REPORT_CAP`. */
  readonly missing: readonly GlyphAtlasMiss[];
}

/** Ανώτατο πλήθος δειγμάτων στη λίστα — διάγνωση, όχι πλήρες αρχείο καταγραφής. */
export const MISS_REPORT_CAP = 50;

const EMPTY: GlyphAtlasReport = { requested: 0, admitted: 0, missingCount: 0, missing: [] };

const store = createExternalStore<GlyphAtlasReport>(EMPTY);

// ─── API μεταβολής (μόνο ο `GlyphAtlas`) ─────────────────────────────────────

/** Αντικαθιστά την αναφορά. Καλείται από τον atlas, όχι από UI. */
export function setGlyphAtlasReport(report: GlyphAtlasReport): void {
  store.set(report);
}

/** Επαναφορά σε «τίποτα δεν ζητήθηκε» — νέο αρχείο / dispose του atlas. */
export function clearGlyphAtlasReport(): void {
  store.set(EMPTY);
}

// ─── Διεπαφή useSyncExternalStore ────────────────────────────────────────────

export function subscribeGlyphAtlasReport(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function getGlyphAtlasReport(): GlyphAtlasReport {
  return store.get();
}

/**
 * Έχει χαθεί έστω μία γλυφή; Το **ένα** ερώτημα που κρίνει αν φαίνεται η ειδοποίηση.
 *
 * Εκφρασμένο ως συνάρτηση ώστε ο κανόνας να ζει **εδώ** και όχι σε κάθε καταναλωτή: ένα
 * `report.missing.length > 0` σε leaf θα ήταν λάθος μόλις η λίστα κοπεί στο cap.
 */
export function hasGlyphAtlasLoss(report: GlyphAtlasReport = store.get()): boolean {
  return report.missingCount > 0;
}
