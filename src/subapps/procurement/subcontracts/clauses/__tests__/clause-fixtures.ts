/**
 * Κοινά δεδομένα των tests της βιβλιοθήκης ρητρών (ADR-928 Φ1) — ένας ορισμός, πολλές σουίτες (CHECK 3.28).
 */

import type { ClauseBody } from '../../types/clause';
import type { ClauseParameterDefinition } from '../../types/clause-parameter';

/** Κράτηση: προτιμώμενη 5%, ελεύθερα 5–10%, απαγορευμένη κάτω από 3% ή πάνω από 15% (ADR-928 §5.2.1). */
export const retentionRate: ClauseParameterDefinition = {
  key: 'rate',
  kind: 'percent',
  label: { el: 'Ποσοστό κράτησης' },
  source: { kind: 'clause' },
  preferred: { kind: 'percent', value: 500 },
  tolerance: { kind: 'numeric', acceptable: { min: 500, max: 1000 }, walkAway: { min: 300, max: 1500 } },
};

export const paymentInstrument: ClauseParameterDefinition = {
  key: 'instrument',
  kind: 'enum',
  label: { el: 'Μέσο πληρωμής' },
  source: { kind: 'clause' },
  options: [
    { key: 'bank', label: { el: 'Τραπεζική μεταφορά' } },
    { key: 'cheque', label: { el: 'Επιταγή' } },
    { key: 'cash', label: { el: 'Μετρητά' } },
  ],
  preferred: { kind: 'enum', value: 'bank' },
  tolerance: { kind: 'options', acceptable: ['bank'], forbidden: ['cash'] },
};

export const crewRatio: ClauseParameterDefinition = {
  key: 'ratio',
  kind: 'ratio',
  label: { el: 'Αναλογία' },
  source: { kind: 'clause' },
  terms: [
    { key: 'technicians', label: { el: 'Τεχνίτες' } },
    { key: 'helpers', label: { el: 'Βοηθοί' } },
    { key: 'labourers', label: { el: 'Εργάτες' } },
  ],
  preferred: { kind: 'ratio', value: [1, 1, 1] },
  tolerance: { kind: 'fixed' },
};

export const retentionBody: ClauseBody = {
  heading: 'Κράτηση καλής εκτέλεσης',
  blocks: [
    {
      kind: 'paragraph',
      inlines: [
        { kind: 'text', text: 'Από κάθε λογαριασμό παρακρατείται ποσό ίσο με ' },
        { kind: 'param', key: 'rate' },
        { kind: 'text', text: ' της αξίας των πιστοποιούμενων εργασιών.' },
      ],
    },
  ],
};
