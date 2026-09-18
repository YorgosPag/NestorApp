/**
 * @fileoverview **Η ΑΠΟΦΑΣΗ ΜΙΑΣ ΕΓΓΡΑΦΗΣ** — κοινοί τύποι για τις αποφάσεις του ημερολογίου.
 * @related ADR-835 §20 · §21 · §23 · services/stay-calendar/stay-calendar-write.service.ts ·
 *   services/stay-calendar/stay-calendar-rules-write.ts · services/stay-calendar/stay-calendar-request-write.ts
 * @module services/stay-calendar/stay-calendar-write-decision
 *
 * 🔑 Οι αποφάσεις είναι **καθαρές ως προς τα δεδομένα** και γράφουν **μόνο** μέσω `apply`,
 * που ο σκελετός της συναλλαγής καλεί **μετά** από όλες τις αναγνώσεις.
 */

import 'server-only';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';
import type { StayCommandAction, StayActor } from '@/lib/stay/stay-command-authority';
import type { StayCalendarReading } from '@/lib/stay/stay-calendar-of';
import type { StayGuestHead } from '@/lib/stay/stay-guest-head';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';
import { wholePropertySpace } from '@/lib/spaces/space-ref';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { stayGuestUserIdOf, type StayBooking } from '@/types/stay-booking';
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
  /** Η ίδια ανάγνωση ως είσοδος της **μίας** σύνθεσης (`stayRequestPreview`) — Στάδιο Δ. */
  readonly reading: Extract<StayCalendarReading, { kind: 'readable' }>;
  /** Ποιος ενεργεί — ήδη **εγκεκριμένος** από τον πίνακα εξουσίας και το κριτήριό του. */
  readonly actor: StayActor;
  /** Το `performedBy` του ίχνους (uid ή ο μηχανισμός λήξης). */
  readonly performedBy: string;
  /** Η δημόσια προβολή — **μόνο** για πράξη επισκέπτη (το αίτημα κρίνεται πάνω σε ό,τι είδε). */
  readonly listing: PublicListing | null;
  /** Η κεφαλή του επισκέπτη που αγγίζει η πράξη, αν αγγίζει επισκέπτη (§23.4). */
  readonly guestHead: StayGuestHead | null;
  readonly now: string;
  readonly clock: StayClock;
}

/**
 * **Τι έγινε, για να ειπωθεί** — η ειδοποίηση που γεννά μια δεσμευμένη μετάβαση (Στάδιο Δ, §23.6).
 * 🔑 Το γεγονός είναι η **μετάβαση**, όχι η ώρα: ταυτότητα ειδοποίησης = `booking:μετάβαση`.
 */
export interface StayBookingNotice {
  readonly event: Extract<StayCommandAction, 'request' | 'withdraw' | 'accept' | 'decline' | 'expire'>;
  /** Η κράτηση **μετά** τη μετάβαση. */
  readonly booking: StayBooking;
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
      /** Η προθεσμία που υποσχέθηκε ένα **νέο** αίτημα. */
      readonly holdExpiresAt?: string;
      /** `undefined` = καμία ειδοποίηση (π.χ. ιδιοδύναμη επανάληψη: τίποτα δεν έγινε). */
      readonly notice?: StayBookingNotice;
    };

export const refuse = (result: StayCalendarWriteResult): Decision => ({ kind: 'refuse', result });

/** Ό,τι διαφέρει ανάμεσα σε χειροκίνητη κράτηση και αίτημα επισκέπτη — όλα τα άλλα είναι της αγγελίας. */
export type StayBookingSpec = Pick<
  StayBooking,
  'checkIn' | 'checkOut' | 'guests' | 'holder' | 'channel' | 'lifecycle' | 'riskDisclosedAt' | 'hold'
>;

/**
 * **Η ΜΙΑ κατασκευή νέας κράτησης** (Στάδιο Δ, N.18) — για τη χειροκίνητη κράτηση **και** το αίτημα.
 * 🔑 Το `guestUserId` **παράγεται** από τον κάτοχο (`stayGuestUserIdOf`), ποτέ δεύτερη γραφή: ο
 * αναγνώστης αρνείται έγγραφο όπου διαφωνούν, άρα μια δεύτερη διατύπωση θα ήταν `unreadable` σε αναμονή.
 */
export function newStayBooking(ctx: WriteContext, spec: StayBookingSpec): StayBooking {
  return {
    id: enterpriseIdService.generateStayBookingId(),
    propertyId: ctx.property.id,
    offerKind: 'leaseShort',
    covers: [wholePropertySpace(ctx.property.id)],
    authorUserId: ctx.property.authorUserId,
    ...spec,
    resolution: null,
    guestUserId: stayGuestUserIdOf(spec.holder),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Η ιδιοδύναμη έκβαση: η πράξη **έχει ήδη γίνει** — καμία εγγραφή, καμία ειδοποίηση. */
export const alreadyDone = (entryId: string): Decision => ({ kind: 'write', entryId, apply: () => undefined });
