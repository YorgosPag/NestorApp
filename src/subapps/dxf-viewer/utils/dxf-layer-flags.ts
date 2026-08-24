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
// ADR-700 §4 (2026-08-24): το **bit 1** (`= 2`, «παγωμένο σε ΝΕΑ viewports») είχε δική του
// σταθερά με μηδέν καταναλωτές και διαγράφηκε. Η γνώση μένει **εδώ** επίτηδες, ως γραμμή του
// πίνακα: ο ίδιος ο σκοπός του module είναι να είναι η ΜΙΑ ανάγνωση του group 70, και μια
// σιωπηλή τρύπα ανάμεσα στο 1 και το 4 θα διαβαζόταν αργότερα ως «το bit 1 δεν υπάρχει».
// Δεν αφορά το model-space rendering, γι' αυτό κανείς δεν το ρώτησε ποτέ.
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
