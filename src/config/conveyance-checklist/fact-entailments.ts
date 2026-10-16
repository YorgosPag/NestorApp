/**
 * Κατάλογος — συνεπαγωγές γεγονότων που ορίζει ο **νόμος** (ADR-901 §5.5 · ADR-915 §16).
 *
 * Ένα γεγονός που προκύπτει **υποχρεωτικά** από άλλο δεν ρωτιέται, και καμία ρητή απάντηση δεν το ανατρέπει: δεν είναι
 * εκτίμηση από τα δεδομένα (εκείνη τη διορθώνει ο χρήστης, `derive-facts.ts`), είναι διάταξη. Η εφαρμογή ζει σε
 * **ένα** σημείο (`applyFactEntailments`), που το καλούν και το `deriveFacts` και το `resolveFacts` — έτσι ο κατάλογος,
 * το μητρώο λήξεων και το optimistic update του client βλέπουν την ίδια τιμή.
 *
 * Προσθήκη γραμμής = μόνο με πηγή. Ποτέ συνεπαγωγή «από πρακτική».
 *
 * @module config/conveyance-checklist/fact-entailments
 */

import type { ConveyanceFactId } from './types';

export interface FactEntailment {
  /** Η προϋπόθεση: το γεγονός και η τιμή του. */
  readonly when: { readonly fact: ConveyanceFactId; readonly equals: boolean };
  /** Το συμπέρασμα — υπερισχύει κάθε ρητής απάντησης στο ίδιο γεγονός. */
  readonly then: { readonly fact: ConveyanceFactId; readonly value: boolean };
  readonly statute: string;
}

export const FACT_ENTAILMENTS: readonly FactEntailment[] = [
  // «εφόσον ο μεταβιβάζων … είναι ή ήταν: α) … νομικό πρόσωπο οποιασδήποτε μορφής» (αυτολεξεί, ΦΕΚ Β' 1559/23-4-2020).
  {
    when: { fact: 'seller_is_legal_entity', equals: true },
    then: { fact: 'seller_insurance_liable', value: true },
    statute: 'ΥΑ 15435/913/2020 άρθρο 1 περ. 6 α΄',
  },
];
