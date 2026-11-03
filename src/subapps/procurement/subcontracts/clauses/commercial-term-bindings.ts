/**
 * @fileoverview **Δέσιμο παραμέτρων ρήτρας σε εμπορικούς όρους** (ADR-928 §5.2 · Φ1 απόφαση 2).
 * @module subapps/procurement/subcontracts/clauses/commercial-term-bindings
 *
 * 🔴 Η αντίφαση που λύνει: το `commercial-terms.ts` λέει «ένας όρος δεν γράφεται ποτέ και στα δύο», ενώ η §5.2 δίνει
 * την κράτηση και την παρακράτηση ως ρήτρες με παραμέτρους. Εδώ η τιμή ζει **μία** φορά (στα δεδομένα), η ρήτρα
 * κρατά **κείμενο και ζώνες**, και ο αναγνώστης του δεσίματος είναι η μόνη γέφυρα — ολικός `Record`: νέο κλειδί στο
 * `COMMERCIAL_TERM_BINDING_KEYS` χωρίς αναγνώστη σπάει τη μεταγλώττιση.
 */

import type { ClauseParameterKind, ClauseParameterValue, CommercialTermBindingKey } from '../types/clause-parameter';
import type { CommercialTerms } from '../types/commercial-terms';

export interface CommercialTermBindingSpec {
  /** Το είδος που πρέπει να έχει η δεσμευμένη παράμετρος. */
  readonly kind: ClauseParameterKind;
  /** Μόνο για `enum`: τα κλειδιά επιλογών που οφείλει να ορίζει η παράμετρος (ακριβώς αυτά). */
  readonly optionKeys?: readonly string[];
  /** Η τιμή στα δεδομένα, ή `null` όταν ο όρος δεν ισχύει (π.χ. καμία ποινική ρήτρα). */
  readonly read: (terms: CommercialTerms) => ClauseParameterValue | null;
}

export const COMMERCIAL_TERM_BINDINGS: Readonly<Record<CommercialTermBindingKey, CommercialTermBindingSpec>> = {
  'retention.rate': {
    kind: 'percent',
    read: (terms) => (terms.paymentPlan.retention ? { kind: 'percent', value: terms.paymentPlan.retention.rate } : null),
  },
  'withholding.rate': {
    kind: 'percent',
    read: (terms) => (terms.withholding.applies ? { kind: 'percent', value: terms.withholding.rate } : null),
  },
  'penalty.perDay': {
    kind: 'money',
    read: (terms) => (terms.penalty ? { kind: 'money', value: terms.penalty.perDay } : null),
  },
  'penalty.cap': {
    kind: 'percent',
    read: (terms) => (terms.penalty ? { kind: 'percent', value: terms.penalty.capOfContractValue } : null),
  },
  'cash.limitPerPayment': {
    kind: 'money',
    read: (terms) => ({ kind: 'money', value: terms.cashLimitPerPayment }),
  },
  'vat.treatment': {
    kind: 'enum',
    optionKeys: ['excluded', 'included'],
    read: (terms) => ({ kind: 'enum', value: terms.vat.treatment }),
  },
  'payment.anchorWeekday': {
    kind: 'weekday',
    read: (terms) => {
      const schedule = terms.paymentPlan.schedule;
      return schedule.kind === 'recurring' && schedule.anchor.kind === 'weekday'
        ? { kind: 'weekday', value: schedule.anchor.weekday }
        : null;
    },
  },
};

/** Η τιμή μιας δεσμευμένης παραμέτρου από τα δεδομένα — `null` όταν ο όρος δεν ισχύει. */
export function readBoundTermValue(term: CommercialTermBindingKey, terms: CommercialTerms): ClauseParameterValue | null {
  return COMMERCIAL_TERM_BINDINGS[term].read(terms);
}
