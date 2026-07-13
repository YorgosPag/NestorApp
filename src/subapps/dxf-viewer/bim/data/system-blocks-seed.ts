/**
 * ADR-652 M3 — Ο κατάλογος της ΕΤΟΙΜΗΣ (system/partner) βιβλιοθήκης block.
 *
 * Pure data + pure derivation, ΜΗΔΕΝ νέα γεωμετρία: κάθε system block **παράγεται** από ένα
 * preset του υπάρχοντος `FLOORPLAN_SYMBOL_CATALOG` (ADR-415 — 16 παραμετρικά σύμβολα κάτοψης
 * δικής μας συγγραφής). Δεν συντηρούμε δεύτερη λίστα επίπλων/ειδών υγιεινής: η λίστα ΕΙΝΑΙ ο
 * κατάλογος του ADR-415, φιλτραρισμένη + χαρτογραφημένη στο μοντέλο της βιβλιοθήκης.
 *
 * Νομικά (ADR-415 Δ1 — `source: 'parametric (own)'`): δική μας συγγραφή ⇒ έχουμε δικαίωμα
 * αναδιανομής ⇒ `license.redistributable: true`, `type: 'cc0'`. ΑΥΤΟ είναι που επιτρέπει σε
 * αυτό το περιεχόμενο (και ΜΟΝΟ σε αυτό) να ζήσει σε `scope:'system'` — ένα ξένο DXF του
 * χρήστη μένει ιδιωτικό μέχρι να δηλώσει ρητά ο χρήστης δικαίωμα αναδιανομής.
 *
 * Deterministic doc ids (`blklib_sys_<slug>`) — idempotent seed, mirror του
 * `system-materials-seed.ts` (`bmat_sys_*`). Ξανατρέξιμο ⇒ update, ΟΧΙ διπλότυπα.
 *
 * @see ../block-library/system-block-geometry.ts — preset → BLOCK-LOCAL members
 * @see scripts/seed-block-library.ts — ο writer (Admin SDK)
 */

import {
  FLOORPLAN_SYMBOL_CATALOG,
  type FloorplanSymbolPreset,
} from '../floorplan-symbols/floorplan-symbol-catalog';
import type {
  BlockCategory,
  BlockLicense,
  BlockProvenance,
} from '../block-library/block-library-types';
import type { FloorplanSymbolCategory } from '../types/floorplan-symbol-types';

/** Ο κοινός τύπος άδειας ΟΛΟΥ του seeded περιεχομένου (δική μας παραμετρική συγγραφή). */
export const SYSTEM_BLOCK_LICENSE: BlockLicense = {
  type: 'cc0',
  redistributable: true,
};

/** Ίχνος προέλευσης του seeded περιεχομένου — δεν το «εισήγαγε» χρήστης. */
export const SYSTEM_BLOCK_PROVENANCE: Omit<BlockProvenance, 'importedAt'> = {
  sourceType: 'builtin',
  importedBy: 'system_seed',
  manufacturer: 'Nestor (parametric)',
};

/** Κατηγορία συμβόλου (ADR-415) → κατηγορία βιβλιοθήκης block. Ένας χάρτης, εξαντλητικός. */
const CATEGORY_MAP: Readonly<Record<FloorplanSymbolCategory, BlockCategory>> = {
  sanitary: 'sanitary',
  kitchen: 'kitchen',
  furniture: 'furniture',
};

/** Ένα προς σπορά system block (metadata· η γεωμετρία παράγεται από το `preset`). */
export interface SystemBlockSeed {
  /** Ντετερμινιστικό doc id — `blklib_sys_<slug του preset id>`. */
  readonly id: string;
  /** Όνομα block στο σχέδιο (AutoCAD-style, uppercase). Μοναδικό ανά ορισμό. */
  readonly name: string;
  readonly category: BlockCategory;
  /** i18n key του καταλόγου ADR-415 — ΜΗΔΕΝ νέα strings για τα 16 ονόματα. */
  readonly labelKey: string;
  readonly preset: FloorplanSymbolPreset;
}

/** `wc_standard_01` → `WC_STANDARD_01` (όνομα block) / `blklib_sys_wc_standard_01` (id). */
function toBlockName(presetId: string): string {
  return presetId.toUpperCase();
}

function toSeedId(presetId: string): string {
  return `blklib_sys_${presetId.toLowerCase()}`;
}

/**
 * Ο πλήρης κατάλογος προς σπορά — ΟΛΑ τα preset του ADR-415 (είδη υγιεινής, κουζίνα,
 * έπιπλα). Παράγεται· δεν γράφεται στο χέρι.
 */
export const SYSTEM_BLOCKS_SEED: readonly SystemBlockSeed[] = FLOORPLAN_SYMBOL_CATALOG.map(
  (preset) => ({
    id: toSeedId(preset.id),
    name: toBlockName(preset.id),
    category: CATEGORY_MAP[preset.category],
    labelKey: preset.labelKey,
    preset,
  }),
);
