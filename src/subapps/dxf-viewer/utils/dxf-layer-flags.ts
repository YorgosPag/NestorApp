/**
 * SSoT — οι σημαίες του **group 70** μιας εγγραφής `LAYER` στο DXF TABLES section.
 *
 * Δύο parsers διαβάζουν τον ίδιο πίνακα (`dxf-table-parsers.parseLayerColors` — legacy 2-field
 * reader που τροφοδοτεί τον `dxf-scene-builder`· `dxf-layer-table-parser.parseLayerTable` — ο
 * πλήρης `SceneLayer[]`). Όσο η πράξη `flag & 1` ζούσε inline και στους δύο, ήταν θέμα χρόνου
 * να αποκλίνουν — ή, όπως έγινε στην πραγματικότητα, **ο ένας να μην τη γράψει ποτέ**.
 *
 * ⚠️ **ΜΗΝ τις μπερδέψεις με το `LAS_STATE_FLAGS`** (`services/las-parser.ts`): εκείνες είναι
 * bits του **group 90 σε αρχείο LAS** (`VISIBLE=1, FROZEN=2, LOCKED=4`) — **άλλη διάταξη, άλλο
 * νόημα του bit 0**. Η επαναχρησιμοποίησή τους εδώ δίνει σιωπηλά λάθος αποτέλεσμα.
 *
 * @see AutoCAD DXF Reference — LAYER (70 = Standard flags, bit-coded)
 */

/** bit 0 — το layer είναι **παγωμένο** (AutoCAD `LAYFRZ`): δεν σχεδιάζεται, δεν κάνει regen. */
export const LAYER_FLAG_FROZEN = 1;
/** bit 1 — παγωμένο σε **νέα** viewports (δεν αφορά το model space rendering). */
export const LAYER_FLAG_FROZEN_IN_NEW_VP = 2;
/** bit 2 — **κλειδωμένο** (AutoCAD `LAYLCK`): ορατό αλλά μη επεξεργάσιμο. */
export const LAYER_FLAG_LOCKED = 4;

/** Είναι παγωμένο το layer, με βάση το group 70; */
export function isFrozenFlag(flag: number | undefined | null): boolean {
  return ((flag ?? 0) & LAYER_FLAG_FROZEN) !== 0;
}

/** Είναι κλειδωμένο το layer, με βάση το group 70; */
export function isLockedFlag(flag: number | undefined | null): boolean {
  return ((flag ?? 0) & LAYER_FLAG_LOCKED) !== 0;
}
