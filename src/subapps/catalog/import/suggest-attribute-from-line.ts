/**
 * **Νέα ιδιότητα από γραμμή της πηγής** (ADR-923 §5.5.2 Β3 Γ7): τι προτείνεται στη φόρμα, ποτέ τι αποθηκεύεται. Καθαρό.
 *
 * 🔑 Η μονάδα βγαίνει με τον **ίδιο** κανόνα που διαβάζει τις τιμές (`unitInLabel`, Ε1): μόνο όταν η ετικέτα τυπώνει **μία** μονάδα
 *    του μητρώου. Δύο ή καμία ⇒ καμία πρόταση μέτρησης, γιατί η λάθος οικογένεια μέτρησης είναι σφάλμα ×1000.
 * 🔑 Το επίπεδο βγαίνει από τα δεδομένα: διαφορετική τιμή ανά παραλλαγή ⇒ ανά κωδικό· ίδια παντού ⇒ κοινή. Ο άνθρωπος το βλέπει και
 *    το αλλάζει πριν αποθηκευτεί.
 * @module subapps/catalog/import/suggest-attribute-from-line
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { ImportPageUnmappedLine } from '../types/catalog-import';
import { parseEnteredAmount } from '../values/decimal-amount';
import { unitForm } from '../values/value-text-codec';
import type { ImportLineBindLevel } from '../vocabulary/catalog-import';
import { suggestCatalogCode } from '../vocabulary/suggest-catalog-code';
import { unitInLabel } from './page-table-reading';

/** Το διαχωριστικό με το οποίο η ανάγνωση ενώνει τις ετικέτες της γραμμής (`ImportPageUnmappedLine.label`). */
const LABEL_SEPARATOR = ' · ';

export interface LineAttributeSuggestion {
  /** Η ετικέτα της γραμμής χωρίς τη μονάδα («ΠΑΡΟΧΗ ΑΕΡΑ Μ»). */
  readonly label: string;
  /** Κωδικός από την ετικέτα· `''` όταν η ετικέτα δεν δίνει γράμμα. */
  readonly code: string;
  readonly measurement: { readonly familyCode: string; readonly unitCode: string } | null;
  /** Όλες οι τιμές είναι αριθμοί. */
  readonly numeric: boolean;
  /** Τα περισσότερα δεκαδικά που τυπώνονται. */
  readonly decimals: number;
  readonly level: ImportLineBindLevel;
}

function printedMeasurement(label: string, registry: MeasurementRegistry): { readonly familyCode: string; readonly unitCode: string; readonly symbol: string } | null {
  const units = registry.families.flatMap((family) => family.units.map((unit) => ({ code: unit.code, symbol: unit.symbol, familyCode: family.code })));
  const unit = unitInLabel(label, units);
  if (unit === null) return null;
  const familyCode = units.find((candidate) => candidate.code === unit.code)?.familyCode;
  return familyCode === undefined ? null : { familyCode, unitCode: unit.code, symbol: unit.symbol };
}

/** Τα κομμάτια της ετικέτας που **είναι** η μονάδα φεύγουν: η μονάδα ζει στη ρύθμιση, όχι στο όνομα. */
function labelWithoutUnit(label: string, unit: { readonly unitCode: string; readonly symbol: string } | null): string {
  const parts = label.split(LABEL_SEPARATOR).map((part) => part.trim()).filter((part) => part !== '');
  const unitForms = unit ? new Set([unitForm(unit.symbol), unitForm(unit.unitCode)]) : new Set<string>();
  const kept = parts.filter((part) => !unitForms.has(unitForm(part)));
  return (kept.length > 0 ? kept : parts).join(' ');
}

export function suggestAttributeFromLine(line: Pick<ImportPageUnmappedLine, 'label' | 'values'>, registry: MeasurementRegistry): LineAttributeSuggestion {
  const measurement = printedMeasurement(line.label, registry);
  const label = labelWithoutUnit(line.label, measurement);
  const amounts = line.values.map((value) => parseEnteredAmount(value.trim()));
  const numeric = amounts.length > 0 && amounts.every((amount) => amount !== null);
  const decimals = numeric ? Math.max(0, ...amounts.map((amount) => amount?.decimals ?? 0)) : 0;
  return {
    label,
    code: suggestCatalogCode(label),
    measurement: measurement && numeric ? { familyCode: measurement.familyCode, unitCode: measurement.unitCode } : null,
    numeric,
    decimals,
    level: new Set(line.values).size > 1 ? 'leaf' : 'shared',
  };
}
