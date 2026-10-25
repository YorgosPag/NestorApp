/**
 * =============================================================================
 * ΑΠΟ ΤΙΣ ΑΠΟΘΗΚΕΥΜΕΝΕΣ ΤΙΜΕΣ ΣΤΟΝ ΑΞΙΟΛΟΓΗΤΗ — και «καμία ΝΕΑ παράβαση» (ADR-923 §5.10 Δ8)
 * =============================================================================
 *
 * Δύο ευθύνες, ένας λόγος ύπαρξης: ο γραφέας (2β) πρέπει να ρωτήσει τον **υπάρχοντα** αξιολογητή
 * (`evaluate-consistency.ts`, αμετάβλητο) για ένα μοντέλο **πριν** και **μετά** την εγγραφή.
 *
 * 1. **Προσαρμογέας** — συγχωνευμένες τιμές (`resolve-inherited.ts`) → `VariantValueRow` στη
 *    μορφή που ξέρει ο αξιολογητής: μέτρηση σε **μονάδα-πρότυπο** (ό,τι έγραψε ο προμηθευτής σε kW
 *    συγκρίνεται με ό,τι έγραψε σε W), αριθμός, κωδικός επιλογής, ναι/όχι, κείμενο. Μόνο η θέση
 *    `'*'/'*'`: ένας κανόνας «H ≥ M» δεν έχει νόημα ανά γλώσσα.
 *
 * 2. **Πολιτική** — απορρίπτεται (422) **μόνο** σφάλμα που η εγγραφή **εισάγει** (δεν υπήρχε πριν)
 *    ή **αγγίζει** (άλλαξε κελί που συμμετέχει και η παράβαση παραμένει). Κάθε άλλο ⇒ εύρημα
 *    (`derived.findings`). Έτσι ένας κανόνας που προστίθεται **αργότερα** δεν κλειδώνει άσχετες
 *    αποθηκεύσεις (το βάρος της παραλλαγής 3 δεν μπλοκάρεται επειδή η 5 έχει ήδη μετατόπιση H/M),
 *    αλλά κανείς δεν μπορεί να **πειράξει** ένα ασυνεπές κελί και να το αφήσει ασυνεπές.
 *
 * @module subapps/catalog/rules/consistency-gate
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue } from '../types/product';
import type { ResolvedValues } from '../values/resolve-inherited';
import { standardAmountOf } from '../values/standard-amount';
import { readUnscopedSlot } from '../values/value-shape';
import type { ComparableValue, ConsistencyViolation, VariantValueRow } from './evaluate-consistency';

/** Μία τιμή στη μορφή του αξιολογητή — `null` = «δεν κρίνεται» (λείπει, άκυρη ή μη συγκρίσιμη). */
export function toComparableValue(
  attribute: CatalogAttributeDefinition,
  value: AttributeValue | undefined,
  registry: MeasurementRegistry,
): ComparableValue {
  switch (value?.type) {
    case 'number':
    case 'measurement':
      return standardAmountOf(attribute, value, registry);
    case 'select':
      return value.optionCode;
    case 'boolean':
      return value.value;
    case 'text':
      return value.text;
    default:
      return null;
  }
}

/** Μια παραλλαγή (συγχωνευμένη) ως γραμμή του αξιολογητή. */
export function toVariantValueRow(
  variantId: string,
  resolved: ResolvedValues,
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): VariantValueRow {
  const values: Record<string, ComparableValue> = {};
  for (const [attributeId, { slots }] of resolved.values) {
    const attribute = attributes.get(attributeId);
    if (!attribute) continue;
    const comparable = toComparableValue(attribute, readUnscopedSlot(slots), registry);
    if (comparable !== null) values[attributeId] = comparable;
  }
  return { variantId, values };
}

const CELL_SEPARATOR = '\u0000';

/** Το κλειδί ενός κελιού (παραλλαγή × ιδιότητα). */
export function cellKey(variantId: string, attributeId: string): string {
  return `${variantId}${CELL_SEPARATOR}${attributeId}`;
}

/** Τα κελιά που **άλλαξαν** ανάμεσα σε δύο εκδοχές των ίδιων παραλλαγών (νέα παραλλαγή ⇒ όλα της). */
export function changedCells(before: readonly VariantValueRow[], after: readonly VariantValueRow[]): ReadonlySet<string> {
  const previous = new Map(before.map((row) => [row.variantId, row.values]));
  const changed = new Set<string>();
  for (const row of after) {
    const old = previous.get(row.variantId) ?? {};
    const attributeIds = new Set([...Object.keys(old), ...Object.keys(row.values)]);
    for (const attributeId of attributeIds) {
      if (old[attributeId] !== row.values[attributeId]) changed.add(cellKey(row.variantId, attributeId));
    }
  }
  return changed;
}

/** Η ταυτότητα μιας παράβασης, ανεξάρτητη από τη σειρά των παραλλαγών/ιδιοτήτων. */
export function violationKey(violation: ConsistencyViolation): string {
  return [violation.ruleId, [...violation.variantIds].sort().join(','), [...violation.attributeIds].sort().join(',')].join('|');
}

function touches(violation: ConsistencyViolation, changed: ReadonlySet<string>): boolean {
  return violation.variantIds.some((variantId) =>
    violation.attributeIds.some((attributeId) => changed.has(cellKey(variantId, attributeId))),
  );
}

export interface ConsistencyVerdict {
  /** Σφάλματα που **εισάγει ή αγγίζει** η εγγραφή ⇒ 422. */
  readonly blocking: readonly ConsistencyViolation[];
  /** Όλα τα υπόλοιπα (προειδοποιήσεις + παλιά, ανέγγιχτα σφάλματα) ⇒ `derived.findings`. */
  readonly findings: readonly ConsistencyViolation[];
}

/** Η πολιτική «καμία νέα παράβαση»: σύγκριση πριν/μετά, με γνώση του τι άλλαξε. */
export function judgeConsistency(
  before: readonly ConsistencyViolation[],
  after: readonly ConsistencyViolation[],
  changed: ReadonlySet<string>,
): ConsistencyVerdict {
  const existed = new Set(before.map(violationKey));
  const isBlocking = (violation: ConsistencyViolation): boolean =>
    violation.severity === 'error' && (!existed.has(violationKey(violation)) || touches(violation, changed));
  return { blocking: after.filter(isBlocking), findings: after.filter((violation) => !isBlocking(violation)) };
}
