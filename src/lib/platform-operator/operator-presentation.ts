/**
 * @fileoverview ⚖️ **Η ΤΑΜΠΕΛΑ ΟΠΩΣ ΤΗ ΔΙΑΒΑΖΕΙ Ο ΑΝΘΡΩΠΟΣ** — καθαρές αποφάσεις παρουσίασης του φορέα (ADR-861 Φ2).
 * @related constants/platform-operator.ts · components/legal/OperatorIdentityStatement.tsx · lib/agency/showcase-legal-presentation.ts
 * @module lib/platform-operator/operator-presentation
 *
 * 🔑 **Η απόφαση ζει εδώ, όχι σε JSX** (ίδιο ιδίωμα με το `showcase-legal-presentation`): οι άγκυρες
 * την εκτελούν χωρίς render, και κάθε σελίδα ρωτά την **ίδια** συνάρτηση.
 *
 * 🔴 **Email που δεν έχει επιβεβαιωθεί ΔΕΝ εμφανίζεται ως λειτουργικό.** Ο κανόνας «επιβεβαιωμένο»
 * είναι **ένας**, στην κρίση ετοιμότητας (`isMailboxConfirmed`) — η σελίδα και η άρνηση δημόσιου
 * ανοίγματος δεν μπορούν να διαφωνήσουν για το αν μια διεύθυνση διαβάζεται.
 *
 * **Layering**: καθαρό — πελάτης και διακομιστής, χωρίς ρολόι (η μέρα είναι όρισμα).
 */

import {
  PLATFORM_OPERATORS,
  operatorOn,
  type CalendarDay,
  type OperatorIdentity,
  type OperatorMailbox,
  type OperatorRecord,
  type OperatorSeat,
} from '@/constants/platform-operator';
import { seatLineOf } from '@/lib/agency/showcase-legal-presentation';
import { isMailboxConfirmed } from '@/lib/platform-operator/operator-readiness';
// ⚠️ Όχι `formatPostalCodeForDisplay` (`types/project/address-helpers`): εκείνο το αρχείο σέρνει
// `enterprise-id.service` + telemetry σε κάθε νομική σελίδα. Η έδρα κρίνεται **μόνο ελληνική**
// (`seat-country-unsupported`), και το `formatGreekPostalCode` αφήνει ανέπαφο κάθε ξένο σχήμα.
import { formatGreekPostalCode } from '@/utils/address/postal-code';

/** Ο φορέας όπως **δημοσιεύεται** — ό,τι δεν μπορεί να ειπωθεί με ασφάλεια είναι `null`, ποτέ πλαστό. */
export interface OperatorStatementView {
  readonly name: string;
  /** Διακριτικός τίτλος (φυσικό πρόσωπο) ή νομική μορφή (νομικό πρόσωπο) — `null` όταν δεν δηλώθηκε. */
  readonly qualifier: { readonly kind: 'trade-name' | 'legal-form'; readonly text: string } | null;
  /** Οδός · Τ.Κ. στη μορφή εμφάνισης · πόλη — σε μία γραμμή, ίδια μορφή με τα νομικά στοιχεία της βιτρίνας. */
  readonly seatLine: string;
  /** ISO 3166-1 alpha-2 — το όνομα της χώρας το αποδίδει η γλώσσα του αναγνώστη. */
  readonly countryCode: string;
  readonly vatNumber: string;
  readonly gemiNumber: string | null;
  /** `null` ⇒ η διεύθυνση **δεν** έχει επιβεβαιωθεί ότι διαβάζεται: «θα αναρτηθεί». */
  readonly contactEmail: string | null;
  readonly privacyEmail: string | null;
}

export type OperatorStatement =
  | { readonly kind: 'declared'; readonly view: OperatorStatementView }
  | { readonly kind: 'pending' };

function nameOf(identity: OperatorIdentity): Pick<OperatorStatementView, 'name' | 'qualifier'> {
  if (identity.kind === 'natural-person') {
    const qualifier = identity.tradeName === null ? null : { kind: 'trade-name' as const, text: identity.tradeName };
    return { name: identity.fullName, qualifier };
  }
  return { name: identity.legalName, qualifier: { kind: 'legal-form', text: identity.legalForm } };
}

/** **Η έδρα σε μία γραμμή** — επαναχρησιμοποιεί τη συναρμολόγηση της βιτρίνας, όχι δεύτερη μορφή. */
export function operatorSeatLine(seat: OperatorSeat): string {
  return seatLineOf({
    disclosure: 'full',
    streetLine: `${seat.street} ${seat.number}`.trim(),
    postalCode: formatGreekPostalCode(seat.postalCode),
    locality: seat.city,
  });
}

/** Η διεύθυνση **μόνο** αν διαβάζεται από άνθρωπο τη μέρα `day`. */
export function publishedAddress(mailbox: OperatorMailbox, day: CalendarDay): string | null {
  return isMailboxConfirmed(mailbox, day) ? mailbox.address : null;
}

function viewOf(record: OperatorRecord, day: CalendarDay): OperatorStatementView {
  return {
    ...nameOf(record.identity),
    seatLine: operatorSeatLine(record.seat),
    countryCode: record.seat.country,
    vatNumber: record.vatNumber,
    gemiNumber: record.gemiNumber,
    contactEmail: publishedAddress(record.contact, day),
    privacyEmail: publishedAddress(record.privacy, day),
  };
}

/** **Τι λέει η ταμπέλα τη μέρα `day`;** — ο φορέας που ίσχυε τότε, ή «θα αναρτηθεί». */
export function operatorStatementOn(
  day: CalendarDay,
  history: readonly OperatorRecord[] = PLATFORM_OPERATORS,
): OperatorStatement {
  const standing = operatorOn(day, history);
  return standing.kind === 'pending' ? { kind: 'pending' } : { kind: 'declared', view: viewOf(standing.record, day) };
}
