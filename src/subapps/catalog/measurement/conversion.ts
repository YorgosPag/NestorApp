/**
 * =============================================================================
 * Η ΜΙΑ ΜΗΧΑΝΗ ΜΕΤΑΤΡΟΠΗΣ ΜΟΝΑΔΩΝ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.2)
 * =============================================================================
 *
 * `πρότυπο = τιμή × factor + offset` και το αντίστροφό του — **κλειστή** αντιστροφή, χωρίς
 * λίστα πράξεων που μπορεί να γραφτεί με λάθος σειρά.
 *
 * 🔑 **Θόρυβος κινητής υποδιαστολής**: 0,1 kW → W δίνει 100,00000000000001. Η μηχανή
 * στρογγυλεύει σε 12 σημαντικά ψηφία — πολύ πάνω από κάθε ακρίβεια που τυπώνει κατάλογος,
 * πολύ κάτω από το όριο του double (≈15,9) — ώστε σύγκριση και ισότητα να μην αστοχούν σε
 * ψηφία που κανείς δεν έγραψε.
 *
 * @module subapps/catalog/measurement/conversion
 */

import type { MeasurementFamilyDefinition, MeasurementUnitDefinition } from '../types/measurement-family';

const SIGNIFICANT_DIGITS = 12;

/** Στρογγύλευση σε 12 σημαντικά ψηφία — καθαρίζει θόρυβο, όχι πληροφορία. */
export function stripFloatNoise(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}

/** Σφάλμα μετατροπής με όνομα — άγνωστη μονάδα ή μη πεπερασμένη τιμή. */
export class MeasurementConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeasurementConversionError';
  }
}

export function findUnit(
  family: MeasurementFamilyDefinition,
  unitCode: string,
): MeasurementUnitDefinition | undefined {
  return family.units.find((unit) => unit.code === unitCode);
}

function requireUnit(family: MeasurementFamilyDefinition, unitCode: string): MeasurementUnitDefinition {
  const unit = findUnit(family, unitCode);
  if (!unit) throw new MeasurementConversionError(`unknown unit ${unitCode} in family ${family.code}`);
  return unit;
}

function requireFinite(value: number): void {
  if (!Number.isFinite(value)) throw new MeasurementConversionError(`non-finite value ${value}`);
}

/** Τιμή στη μονάδα `unitCode` → τιμή στη μονάδα-πρότυπο της οικογένειας. */
export function toStandardUnit(family: MeasurementFamilyDefinition, value: number, unitCode: string): number {
  requireFinite(value);
  const unit = requireUnit(family, unitCode);
  return stripFloatNoise(value * unit.factor + (unit.offset ?? 0));
}

/** Τιμή στη μονάδα-πρότυπο → τιμή στη μονάδα `unitCode`. */
export function fromStandardUnit(family: MeasurementFamilyDefinition, standardValue: number, unitCode: string): number {
  requireFinite(standardValue);
  const unit = requireUnit(family, unitCode);
  return stripFloatNoise((standardValue - (unit.offset ?? 0)) / unit.factor);
}

/** Μετατροπή ανάμεσα σε δύο μονάδες της **ίδιας** οικογένειας. */
export function convertMeasurement(
  family: MeasurementFamilyDefinition,
  value: number,
  fromUnitCode: string,
  toUnitCode: string,
): number {
  if (fromUnitCode === toUnitCode) {
    requireFinite(value);
    requireUnit(family, fromUnitCode);
    return value;
  }
  return fromStandardUnit(family, toStandardUnit(family, value, fromUnitCode), toUnitCode);
}

/**
 * Η τιμή με **ακριβώς** `decimals` δεκαδικά, στρογγυλεμένη **στο δεκαδικό** (μισό προς τα πάνω, μακριά από το μηδέν).
 *
 * 🔑 Το `toFixed` στρογγυλεύει το **δυαδικό** double: 2835 W → 2,835 kW αποθηκεύεται ως 2,83499… ⇒ «2,83», ενώ ο
 * τυπωμένος κατάλογος (και το Excel) γράφει «2,84». Εδώ η μετατόπιση γίνεται στο **κείμενο** του αριθμού (εκθέτης),
 * μετά τον καθαρισμό θορύβου — άρα στρογγυλεύεται ο αριθμός που **γράφτηκε**, όχι η δυαδική του προσέγγιση.
 */
export function toFixedDecimal(value: number, decimals: number): string {
  requireFinite(value);
  const shifted = shiftDecimal(stripFloatNoise(value), decimals);
  return shiftDecimal(Math.sign(shifted) * Math.round(Math.abs(shifted)), -decimals).toFixed(decimals);
}

/** `value × 10^by` μέσω του **κειμένου** του αριθμού (μετατόπιση εκθέτη) — χωρίς πολλαπλασιασμό που προσθέτει θόρυβο. */
function shiftDecimal(value: number, by: number): number {
  const [mantissa, exponent = '0'] = String(value).split('e');
  return Number(`${mantissa}e${Number(exponent) + by}`);
}
