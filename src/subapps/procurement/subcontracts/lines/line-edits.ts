/**
 * @fileoverview **Πράξεις πάνω στις γραμμές και στα μερίδια** — καθαρές, ώστε κάθε κανόνας να είναι ένας και να
 *   ελέγχεται (ADR-928 Φ3γ-2 απόφαση 4 · ίδιο ιδίωμα με το `draft-clause-edits`).
 * @module subapps/procurement/subcontracts/lines/line-edits
 *
 * 🔑 Το id της γραμμής το δίνει ο καλών (`generateSubcontractAgreementLineId`, N.6): εδώ καμία τυχαιότητα, άρα
 *    ντετερμινιστικά tests.
 * 🔑 Η κατ' αποκοπή γραμμή **δεν** έχει ποσότητα (το ποσό της είναι η τιμή, `estimatedLineAmount`). Η αλλαγή τιμολόγησης
 *    το λέει ρητά, αντί να αφήνει μια ποσότητα που δεν μετρά πουθενά.
 */

import { BP_PER_WHOLE, isBasisPoints, type BasisPoints } from '@/lib/pricing/discount-rule';
import type { UomCode } from '@/lib/uom/uom-registry';
import type { AgreementLine, AgreementLinePricing, AgreementLineStage } from '../types/agreement-line';
import type { LocalizedText } from '../types/clause-parameter';

/** Νέα κενή γραμμή εργασίας τιμής μονάδας. Η περιγραφή μένει κενή, και ο επικυρωτής τη ζητά. */
export function newAgreementLine(id: string, unit: UomCode): AgreementLine {
  return {
    id, kind: 'labor', pricing: 'unit_rate', description: { el: '' }, atoeCode: null, skuRef: null, unit,
    estimatedMilliQuantity: null, unitPrice: 0, clientUnitPrice: null, printClientPrice: false, comment: null,
    measurementRule: null, stages: [], insuredDaysCap: null, paymentOverride: null,
  };
}

/**
 * Η γραμμή που προστίθεται **μετά** από τις υπάρχουσες: συνεχίζει την τελευταία ως **ζεύγος** (είδος + τιμολόγηση + μονάδα),
 * όπως η επόμενη σειρά ενός υπολογιστικού φύλλου. Ποτέ μόνο η μονάδα: μετά από κατ' αποκοπή γραμμή («κ.α.») θα έβγαινε
 * «τιμή μονάδας · κ.α. · κατά επιμέτρηση» — μετρημένο στην παραγωγή (ADR-928 §5.21, επαλήθευση).
 */
export function nextAgreementLine(id: string, lines: readonly AgreementLine[], fallbackUnit: UomCode): AgreementLine {
  const last = lines.at(-1);
  const line = newAgreementLine(id, last?.unit ?? fallbackUnit);
  return last ? setLinePricing({ ...line, kind: last.kind }, last.pricing) : line;
}

/** Αντίγραφο με **νέο** id: οι αναθεωρήσεις και οι πιστοποιήσεις δένουν στο id, άρα δεν μοιράζεται ποτέ. */
export function duplicateLine(line: AgreementLine, id: string): AgreementLine {
  return { ...line, id };
}

export function setLinePricing(line: AgreementLine, pricing: AgreementLinePricing): AgreementLine {
  return { ...line, pricing, estimatedMilliQuantity: pricing === 'lump_sum' ? null : line.estimatedMilliQuantity };
}

/** Προαιρετικό πολύγλωσσο κείμενο (σχόλιο γραμμής): όλες οι γλώσσες κενές ⇒ `null`, όχι κενό αντικείμενο που τυπώνεται. */
export function optionalText(text: LocalizedText): LocalizedText | null {
  return Object.values(text).some((value) => value.trim().length > 0) ? text : null;
}

/** Νέο στάδιο με κλειδί που δεν υπάρχει ήδη στη γραμμή (`stage_1`, `stage_2`, …) και μερίδιο 0, που ζητείται. */
export function newLineStage(stages: readonly AgreementLineStage[]): AgreementLineStage {
  const taken = new Set(stages.map((stage) => stage.key));
  let next = stages.length + 1;
  while (taken.has(`stage_${next}`)) next += 1;
  return { key: `stage_${next}`, label: { el: '' }, share: 0 };
}

/**
 * «Συμπλήρωσε το υπόλοιπο»: η τιμή του μεριδίου `index` ώστε η λίστα να αθροίζει ακριβώς 100%. `null` όταν δεν
 * υπάρχει τέτοια τιμή: τα άλλα μερίδια είναι άκυρα, ή ξεπερνούν ήδη το 100%, ή αφήνουν μηδέν (το μερίδιο θέλει > 0).
 */
export function remainderShare(shares: readonly BasisPoints[], index: number): BasisPoints | null {
  const others = shares.filter((_, at) => at !== index);
  if (!others.every(isBasisPoints)) return null;
  const remainder = BP_PER_WHOLE - others.reduce((sum, share) => sum + share, 0);
  return remainder > 0 ? remainder : null;
}

/** Το άθροισμα των μεριδίων για ζωντανή ένδειξη Σ — `null` αν κάποιο είναι άκυρο (ο επικυρωτής το λέει στη θέση του). */
export function shareTotal(shares: readonly BasisPoints[]): BasisPoints | null {
  return shares.every(isBasisPoints) ? shares.reduce((sum, share) => sum + share, 0) : null;
}
