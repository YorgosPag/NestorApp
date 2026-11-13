/**
 * @fileoverview **«Ανήκει αυτό το κελί στο μοντέλο;» — μία απάντηση** για την εισαγωγή (ADR-923 §5.5.2 Β6 · §5.10 Δ1).
 *
 * Ο προμηθευτής τυπώνει την κοινή ιδιότητα (Φάσεις «1Ph», τάση, συχνότητα) σε **κάθε** στήλη/γραμμή παραλλαγής· η πρόταση τη δείχνει
 * **μία** φορά, στη γραμμή του μοντέλου (`model:<ομάδα>`). Ως 2026-11-14 τον κανόνα τον ήξερε **μόνο** ο σχεδιαστής (`sharedCellsOf`)·
 * ο κατάλογος διορθώσεων και η μνήμη τιμών έβλεπαν στη γραμμή του μοντέλου μόνο τα `sharedCells` της πηγής — άρα διόρθωση σε κοινό
 * πεδίο που η πηγή έδωσε ανά γραμμή **πετιόταν σιωπηλά** (PUT 200, αναθεώρηση +1, τίποτα γραμμένο — live, σελ. 85).
 *
 * 🔑 Η πηγή (`extracted`) **δεν** αλλάζει σχήμα: τα κελιά μένουν στη γραμμή τους και αλλάζει μόνο η **διεύθυνσή** τους. Ο κανόνας
 * εξαρτάται από το σχήμα παραλλαγών, άρα κρίνεται τη στιγμή της χρήσης — αλλαγή σχήματος δεν αφήνει παγωμένη λάθος τοποθέτηση.
 * @module subapps/catalog/import/model-level-cells
 */

import type { ExtractedCell } from '../types/catalog-import';
import type { VariantScheme } from '../types/family';
import { attributeOwnerDepth, leafDepth } from '../values/attribute-levels';
import { isAttributeCell, isNoValueReasonCell, isTradeIdentityCell, type HolderCell } from './cell-identity';

/** Το βάθος-ιδιοκτήτης σε σχέση με το σύνολο: κοινό · τελικό SKU · ενδιάμεσο (υπο-μοντέλο, δηλωμένο όριο της Φάσης 4). */
export type CellLevel = 'shared' | 'leaf' | 'unsupported';

/** Κελί που γράφει σε φορέα τιμών: ιδιότητα · λόγος απουσίας · ταυτότητα εμπορίου. */
export const isHolderCell = (cell: ExtractedCell): cell is HolderCell =>
  isAttributeCell(cell) || isNoValueReasonCell(cell) || isTradeIdentityCell(cell);

/** Το επίπεδο ενός κελιού κατά το σχήμα. Χωρίς σχήμα ⇒ όλα στο SKU. */
export function cellLevelOf(cell: HolderCell, scheme: VariantScheme | null): CellLevel {
  if (!scheme) return 'leaf';
  // Η μάρκα ανήκει στο βάθος 0 (Δ1)· GTIN · MPN · «χωρίς GTIN» στην εμπορεύσιμη μονάδα.
  if (isTradeIdentityCell(cell)) return cell.target.field === 'brand' ? 'shared' : 'leaf';
  const depth = attributeOwnerDepth(scheme, cell.target.attributeId);
  if (depth === 0) return 'shared';
  return depth === leafDepth(scheme) ? 'leaf' : 'unsupported';
}

/** Το ερώτημα «κελί γραμμής που ανεβαίνει στο μοντέλο;» — το ρωτούν ο σχεδιαστής, ο κατάλογος διορθώσεων και η μνήμη τιμών. */
export type ModelLevelTest = (cell: ExtractedCell) => boolean;

/** Κανένα κελί γραμμής δεν ανεβαίνει (απλό προϊόν · πρόταση τιμών): η γραμμή μοντέλου έχει μόνο τα `sharedCells`. */
export const NO_MODEL_LEVEL: ModelLevelTest = () => false;

/** Ο κανόνας για ένα σχήμα παραλλαγών· χωρίς σχήμα δεν υπάρχει γραμμή μοντέλου. */
export function modelLevelTestOf(scheme: VariantScheme | null): ModelLevelTest {
  if (!scheme) return NO_MODEL_LEVEL;
  return (cell) => isHolderCell(cell) && cellLevelOf(cell, scheme) === 'shared';
}
