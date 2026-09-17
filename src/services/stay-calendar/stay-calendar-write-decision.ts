/**
 * @fileoverview **Η ΑΠΟΦΑΣΗ ΜΙΑΣ ΕΓΓΡΑΦΗΣ** — κοινοί τύποι για τις αποφάσεις του ημερολογίου.
 * @related ADR-835 §20 · §21 · services/stay-calendar/stay-calendar-write.service.ts ·
 *   services/stay-calendar/stay-calendar-rules-write.ts
 * @module services/stay-calendar/stay-calendar-write-decision
 *
 * 🔑 Οι αποφάσεις είναι **καθαρές ως προς τα δεδομένα** και γράφουν **μόνο** μέσω `apply`,
 * που ο σκελετός της συναλλαγής καλεί **μετά** από όλες τις αναγνώσεις.
 */

import 'server-only';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import type { OwnerProperty } from '@/types/owner-property';
import type { StayCalendarEntry, StayCalendarHead } from '@/types/stay-calendar';
import type { StayCalendarMonth, StayClock, StayRules } from '@/types/stay-rules';

import type { StayCalendarWriteResult } from './stay-calendar-write-result';

/** Ό,τι διαβάστηκε μέσα στη συναλλαγή, για κάθε απόφαση. */
export interface WriteContext {
  readonly adminDb: AdminFirestore;
  readonly property: OwnerProperty;
  readonly head: StayCalendarHead | null;
  readonly entries: readonly StayCalendarEntry[];
  readonly months: readonly StayCalendarMonth[];
  readonly actor: ListingActor;
  readonly now: string;
  readonly clock: StayClock;
}

export type Decision =
  | { readonly kind: 'refuse'; readonly result: StayCalendarWriteResult }
  | {
      readonly kind: 'write';
      readonly entryId: string | null;
      readonly apply: (transaction: Transaction) => void;
      /** `undefined` = η πράξη δεν αγγίζει τη δήλωση. */
      readonly declaredAt?: string | null;
      /** `undefined` = η πράξη δεν αγγίζει τους κανόνες βάσης. */
      readonly rules?: StayRules;
    };

export const refuse = (result: StayCalendarWriteResult): Decision => ({ kind: 'refuse', result });
