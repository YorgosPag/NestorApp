/**
 * @fileoverview Ζευγάρωμα ετικέτα → τιμή μέσα σε **μία** πινακίδα (ADR-745 §2.2α, §2.3 Ε).
 *
 * ## Τρία σχήματα, όχι ένα
 *
 * | Σχήμα | Πώς μοιάζει | Πού μετρήθηκε |
 * |---|---|---|
 * | `same-cell` | `ΕΡΓΟΔΟΤΗΣ: ΖΕΡΒΑ ΓΕΩΡΓΙΑ` — όλα σε ένα MTEXT | `ΕΡΓΟΔΟΤΗΣ` |
 * | `row-alignment` | ετικέτα αριστερά, τιμή δεξιά στο ίδιο ύψος | `ΘΕΣΗ`, `ΚΛΙΜΑΚΑ`, `ΧΡΟΝΟΣ`, `ΣΧΕΔΙΟ`, `ΜΕΛΕΤΗΤΗΣ` |
 * | `column-alignment` | ετικέτα από πάνω, τιμή από κάτω στην ίδια στήλη | `ΑΡ.ΣΧΕΔΙΟΥ` → `Τ1` |
 *
 * Η πρώτη γραφή του ADR ήξερε **μόνο** το `row-alignment`. Με αυτή την υπόθεση το
 * `ΕΡΓΟΔΟΤΗΣ` — το πεδίο με το μεγαλύτερο διακύβευμα — θα διαβαζόταν **κενό**, και η
 * αποτυχία θα έμοιαζε με «ο τοπογράφος δεν το συμπλήρωσε», που είναι **αληθές** για το
 * `ΕΡΓΟ:` και θα περνούσε απαρατήρητο.
 *
 * ## Γιατί καθολικό ταίριασμα και όχι «πλησιέστερη τιμή»
 *
 * 🔴 Το κρίσιμο μετρημένο ζεύγος: το `Τ1` απέχει **1,61** από το `ΜΕΛΕΤΗ` (λάθος ετικέτα)
 * και **3,29** από το `ΑΡ.ΣΧΕΔΙΟΥ` (σωστή). Κάθε «κάθε ετικέτα παίρνει την πλησιέστερη
 * τιμή της» δίνει εδώ **λάθος απάντηση** — και δεν διορθώνεται με ρύθμιση ανοχής, γιατί ο
 * λάθος υποψήφιος είναι **πιο κοντά**.
 *
 * Η λύση δεν είναι αυστηρότερο κατώφλι αλλά **αποκλειστικότητα**: μία τιμή ανήκει σε μία
 * ετικέτα. Τα υποψήφια ζεύγη ταξινομούνται κατά κόστος και δεσμεύονται άπληστα· όταν
 * φτάσει η σειρά του `ΜΕΛΕΤΗ → Τ1`, το `Τ1` έχει ήδη δοθεί στο `ΑΡ.ΣΧΕΔΙΟΥ` με κόστος
 * 0,34. Το `ΜΕΛΕΤΗ` μένει κενό — που είναι **η αλήθεια του σχεδίου**.
 * ⇒ Η ορθότητα δεν κρέμεται από το κατώφλι· κρέμεται από τη **σειρά**. Τα κατώφλια
 * μπορούν να είναι γενναιόδωρα χωρίς να χαλάσουν τίποτα.
 *
 * Το κόστος μετριέται σε **ύψη κειμένου της ετικέτας**, όχι σε μονάδες σχεδίου — αλλιώς η
 * σύγκριση ενός κελιού 0,73 με ένα 2,94 θα ήταν σύγκριση ανόμοιων πραγμάτων.
 *
 * @see ADR-745 §5.3 (Λ1) · ./title-block-vocabulary (τι είναι ετικέτα)
 */

import { mtextToPlainText } from './mtext-segments';
import type { TitleBlockSourceCell, TitleBlockField, TitleBlockMatchKind } from './title-block-reading.types';
import {
  compileProfile,
  findLabelOccurrences,
  splitIntoWords,
  type CompiledProfile,
  type TitleBlockFieldKey,
  type TitleBlockProfile,
} from './title-block-vocabulary';

// ── Κατώφλια (γενναιόδωρα εκ σχεδιασμού — βλ. επικεφαλίδα) ────────────────────

/** Πόσα ύψη κειμένου μακριά κάθετα επιτρέπεται να είναι μια τιμή της **ίδιας σειράς**. */
export const ROW_TOLERANCE_FACTOR = 2;
/** Πόσα ύψη κειμένου μακριά οριζόντια επιτρέπεται να είναι μια τιμή της **ίδιας στήλης**. */
export const COLUMN_TOLERANCE_FACTOR = 2;
/** Πόσο βαθιά από κάτω ψάχνει η ίδια στήλη (μετρημένο `ΑΡ.ΣΧΕΔΙΟΥ→Τ1`: 4,48 ύψη). */
export const COLUMN_DEPTH_FACTOR = 6;

/** Τιμή που είναι μόνο γέμισμα φόρμας (τελείες οδηγοί, παύλες, άνω τελεία) = **καμία τιμή**. */
const FILLER_ONLY = /^[\s.·…_:\-–—]*$/u;

// ── Ταξινόμηση κελιού ─────────────────────────────────────────────────────────

/** Μία ετικέτα ενός κελιού μαζί με ό,τι φέρει το **ίδιο** κελί δίπλα της. */
export interface LabelSlot {
  readonly key: TitleBlockFieldKey;
  readonly cell: TitleBlockSourceCell;
  /** Η τιμή που βρέθηκε στο ίδιο κελί· `''` όταν το κελί είναι σκέτη ετικέτα. */
  readonly inlineValue: string;
}

/** Ένα κελί αφού απαντηθεί το «είναι ετικέτα ή τιμή;». */
export interface ClassifiedCell {
  readonly cell: TitleBlockSourceCell;
  /** Το κείμενο χωρίς κωδικούς μορφοποίησης — η **μόνη** επιτρεπτή είσοδος αναγνώρισης. */
  readonly plain: string;
  /** Κενό ⇒ το κελί είναι υποψήφια **τιμή**. */
  readonly slots: readonly LabelSlot[];
}

/** Κόβει την τιμή ανάμεσα σε δύο θέσεις, ρίχνοντας διαχωριστικό και γέμισμα φόρμας. */
function sliceInlineValue(plain: string, from: number, to: number): string {
  const between = plain.slice(from, to).trim().replace(/^:/, '').trim();
  return FILLER_ONLY.test(between) ? '' : between;
}

/**
 * Ετικέτα ή τιμή;
 *
 * Κριτήριο: το κελί είναι **ετικέτα** μόνο αν η πρώτη του λέξη ξεκινά ετικέτα. Έτσι
 * γράφονται οι πινακίδες, και έτσι ένα κελί **τιμής** που τυχαίνει να περιέχει λέξη-ετικέτα
 * παραμέσα δεν παρερμηνεύεται ως ετικέτα — που θα σήμαινε ότι η τιμή χάνεται ολόκληρη.
 */
export function classifyCell(cell: TitleBlockSourceCell, profile: CompiledProfile): ClassifiedCell {
  const plain = mtextToPlainText(cell.raw);
  const occurrences = findLabelOccurrences(splitIntoWords(plain), profile);
  if (occurrences.length === 0 || occurrences[0].wordIndex !== 0) {
    return { cell, plain, slots: [] };
  }
  const slots = occurrences.map((occurrence, i) => ({
    key: occurrence.key,
    cell,
    inlineValue: sliceInlineValue(
      plain,
      occurrence.end,
      i + 1 < occurrences.length ? occurrences[i + 1].start : plain.length,
    ),
  }));
  return { cell, plain, slots };
}

// ── Υποψήφια ζεύγη ────────────────────────────────────────────────────────────

interface Candidate {
  readonly slot: number;
  readonly value: number;
  readonly cost: number;
  readonly kind: TitleBlockMatchKind;
}

/**
 * Το κόστος του ζεύγους, ή `null` αν η τιμή δεν βρίσκεται καν σε θέση να ανήκει στην ετικέτα.
 *
 * Σειρά: πρώτα η ίδια **σειρά** (τιμή δεξιά, μικρό Δy), μετά η ίδια **στήλη** (τιμή από
 * κάτω, μικρό Δx). Ποτέ αριστερά και ποτέ από πάνω — μια πινακίδα διαβάζεται όπως γράφεται.
 */
function pairCost(
  label: TitleBlockSourceCell,
  value: TitleBlockSourceCell,
): { cost: number; kind: TitleBlockMatchKind } | null {
  const unit = label.height;
  const dx = value.x - label.x;
  const dy = value.y - label.y;
  if (dx > 0 && Math.abs(dy) <= ROW_TOLERANCE_FACTOR * unit) {
    return { cost: Math.abs(dy) / unit, kind: 'row-alignment' };
  }
  const depth = -dy;
  if (depth > 0 && depth <= COLUMN_DEPTH_FACTOR * unit && Math.abs(dx) <= COLUMN_TOLERANCE_FACTOR * unit) {
    return { cost: Math.abs(dx) / unit, kind: 'column-alignment' };
  }
  return null;
}

/** Όλα τα επιτρεπτά ζεύγη, ταξινομημένα ώστε το φθηνότερο να δεσμεύεται πρώτο. */
function rankCandidates(
  slots: readonly LabelSlot[],
  values: readonly ClassifiedCell[],
): Candidate[] {
  const candidates: Candidate[] = [];
  slots.forEach((slot, s) => {
    values.forEach((value, v) => {
      const scored = pairCost(slot.cell, value.cell);
      if (scored) candidates.push({ slot: s, value: v, ...scored });
    });
  });
  // Ισοπαλία κόστους → λαβές: ντετερμινιστικό ανεξάρτητα από τη σειρά εισόδου.
  return candidates.sort(
    (a, b) =>
      a.cost - b.cost ||
      slots[a.slot].cell.handle.localeCompare(slots[b.slot].cell.handle) ||
      values[a.value].cell.handle.localeCompare(values[b.value].cell.handle),
  );
}

// ── Το αποτέλεσμα ─────────────────────────────────────────────────────────────

export interface PairingResult {
  readonly fields: readonly TitleBlockField[];
  /** Το κελί τιμής ανά κλειδί — ο καταναλωτής του `designers` χρειάζεται το ίδιο το κελί. */
  readonly valueCellOf: ReadonlyMap<TitleBlockFieldKey, ClassifiedCell>;
  /** Κελιά τιμής που δεν βρήκαν ετικέτα. Πάνε στο `unparsed`, δεν εξαφανίζονται. */
  readonly orphanValues: readonly ClassifiedCell[];
}

function toField(slot: LabelSlot, value: ClassifiedCell | null, kind: TitleBlockMatchKind): TitleBlockField {
  const source = value ? value.cell : slot.cell;
  return {
    key: slot.key,
    rawValue: value ? value.plain : slot.inlineValue,
    sourceHandle: source.handle,
    labelHandle: slot.cell.handle,
    at: { x: source.x, y: source.y },
    matchedBy: kind,
  };
}

/**
 * Ζευγαρώνει τα κελιά **μίας** πινακίδας.
 *
 * Οι ετικέτες με τιμή στο ίδιο κελί κλείνουν αμέσως και **δεν διεκδικούν** εξωτερική τιμή —
 * αλλιώς μια συμπληρωμένη ετικέτα θα άρπαζε την τιμή μιας κενής διπλανής της.
 * Ετικέτα που δεν βρίσκει τιμή **δεν παράγει πεδίο**: κενό πεδίο και απούσα τιμή είναι το
 * ίδιο πράγμα στο σχέδιο, και ένα ψεύτικο κενό πεδίο θα ενθάρρυνε τον Λ2 να γράψει κενό.
 */
export function pairTitleBlockCells(
  cells: readonly TitleBlockSourceCell[],
  profile: TitleBlockProfile,
): PairingResult {
  const compiled = compileProfile(profile);
  const classified = cells.map((cell) => classifyCell(cell, compiled));
  const slots = classified.flatMap((c) => c.slots);
  const values = classified.filter((c) => c.slots.length === 0);
  const cellOfSlot = new Map(classified.map((c) => [c.cell.handle, c] as const));

  const fields: TitleBlockField[] = [];
  const valueCellOf = new Map<TitleBlockFieldKey, ClassifiedCell>();
  const openSlots = new Set<number>();
  slots.forEach((slot, i) => {
    if (slot.inlineValue.length === 0) {
      openSlots.add(i);
      return;
    }
    fields.push(toField(slot, null, 'same-cell'));
    const own = cellOfSlot.get(slot.cell.handle);
    if (own) valueCellOf.set(slot.key, own);
  });

  const takenValues = new Set<number>();
  for (const candidate of rankCandidates(slots, values)) {
    if (!openSlots.has(candidate.slot) || takenValues.has(candidate.value)) continue;
    openSlots.delete(candidate.slot);
    takenValues.add(candidate.value);
    const slot = slots[candidate.slot];
    fields.push(toField(slot, values[candidate.value], candidate.kind));
    valueCellOf.set(slot.key, values[candidate.value]);
  }

  return {
    fields,
    valueCellOf,
    orphanValues: values.filter((_, i) => !takenValues.has(i)),
  };
}
