/**
 * @fileoverview **Οι ζώνες μιας παραμέτρου ως κείμενο** — «ελεύθερα 3%–10% · ποτέ έξω από 2%–15%» (ADR-928 §5.2.1 ·
 *   Φ3γ-0). Καθαρό.
 * @module subapps/procurement/subcontracts/library/tolerance-text
 *
 * 🔑 Οι αριθμοί αποδίδονται με τον **ίδιο** `renderParameterValue` του εγγράφου: η ζώνη λέει «10%» όπως το συμφωνητικό,
 *    όχι «1000» (μονάδες βάσης) ή «10.0». Ποια είδη έχουν εύρος το αποφασίζει ο **ίδιος** `numericValueOf` του κριτή.
 * 🔑 Τα όρια είναι **συμπεριληπτικά** (`inNumericRange`) ⇒ «≥», «≤», όχι «>»/«<».
 */

import { numericValueOf } from '../clauses/tolerance-verdict';
import type { DocumentLocale } from '../document/document-locale';
import { renderParameterValue } from '../document/render-parameter-value';
import type { ClauseParameterDefinition, ClauseParameterValue, NumericRange } from '../types/clause-parameter';

export type ToleranceText =
  /** Καμία ζώνη: κάθε έγκυρη τιμή περνά. */
  | { readonly kind: 'none' }
  /** Μόνο η προτιμώμενη περνά ελεύθερα· κάθε άλλη θέλει έγκριση. */
  | { readonly kind: 'fixed' }
  | { readonly kind: 'range'; readonly acceptable: string | null; readonly walkAway: string | null }
  | { readonly kind: 'options'; readonly acceptable: readonly string[]; readonly forbidden: readonly string[] };

/** Μια αριθμητική τιμή στο είδος του ορισμού — `null` για είδη χωρίς εύρος. */
function numericParameterValue(definition: ClauseParameterDefinition, amount: number): ClauseParameterValue | null {
  const value: ClauseParameterValue | null =
    definition.kind === 'percent' ? { kind: 'percent', value: amount }
      : definition.kind === 'money' ? { kind: 'money', value: amount }
        : definition.kind === 'days' ? { kind: 'days', value: amount } : null;
  return value !== null && numericValueOf(value) !== null ? value : null;
}

function bound(definition: ClauseParameterDefinition, amount: number, locale: DocumentLocale): string {
  const value = numericParameterValue(definition, amount);
  return value ? renderParameterValue(value, definition, locale) : locale.number(amount);
}

/** Συμπεριληπτικό εύρος ως κείμενο· ανοιχτό και από τις δύο πλευρές ⇒ `null` (κανένα όριο). */
export function rangeText(range: NumericRange, definition: ClauseParameterDefinition, locale: DocumentLocale): string | null {
  const { min, max } = range;
  if (min === null && max === null) return null;
  if (min === null) return `≤ ${bound(definition, max as number, locale)}`;
  if (max === null) return `≥ ${bound(definition, min, locale)}`;
  if (min === max) return bound(definition, min, locale);
  return `${bound(definition, min, locale)} – ${bound(definition, max, locale)}`;
}

const enumText = (definition: ClauseParameterDefinition, key: string, locale: DocumentLocale): string =>
  renderParameterValue({ kind: 'enum', value: key }, definition, locale);

export function toleranceTextOf(definition: ClauseParameterDefinition, locale: DocumentLocale): ToleranceText {
  const tolerance = definition.tolerance;
  if (tolerance === null) return { kind: 'none' };
  if (tolerance.kind === 'fixed') return { kind: 'fixed' };
  if (tolerance.kind === 'options') {
    return {
      kind: 'options',
      acceptable: tolerance.acceptable.map((key) => enumText(definition, key, locale)),
      forbidden: tolerance.forbidden.map((key) => enumText(definition, key, locale)),
    };
  }
  return { kind: 'range', acceptable: rangeText(tolerance.acceptable, definition, locale), walkAway: rangeText(tolerance.walkAway, definition, locale) };
}
