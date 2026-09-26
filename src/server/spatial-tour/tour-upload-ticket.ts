import 'server-only';

/**
 * @fileoverview **ΤΟ ΕΙΣΙΤΗΡΙΟ ΑΝΕΒΑΣΜΑΤΟΣ** — τι υποσχέθηκε η έναρξη, ώστε η ολοκλήρωση να ξέρει **τι** κρίνει.
 * @related ADR-884 Φ0.8 · §4.5 (Κ3α) · `lib/tokens/signed-token.ts` (ο ΕΝΑΣ υπογράφων) · `tour-capture-upload.ts`
 * @module server/spatial-tour/tour-upload-ticket
 *
 * 🔑 **Καμία νέα συλλογή «ανεβάσματα σε εξέλιξη».** Ό,τι χρειάζεται η ολοκλήρωση (ποιο ανέβασμα, ποια ρίζα, ποιος
 * δράστης, ποιος κάτοχος τότε, πόσα bytes δηλώθηκαν) ταξιδεύει **υπογεγραμμένο** — ίδιο πρότυπο με το κουπόνι
 * επίσκεψης του ADR-315 (`share-access-grant.ts`). Άρα: κανένας νέος κανόνας, κανένα cron, καμία υποσυλλογή
 * που θα ήθελε άγκυρα 3.16. Τα εγκαταλειμμένα αντικείμενα τα σβήνει ο κανόνας κύκλου ζωής της καραντίνας.
 *
 * ⚠️ **Το εισιτήριο ΔΕΝ είναι άδεια.** Η ολοκλήρωση **ξανακρίνει** τα πάντα (η άδεια λήψης μπορεί να ανακλήθηκε
 * ανάμεσα)· το εισιτήριο λέει μόνο **τι** ζητήθηκε, ώστε κανείς να μη «ολοκληρώσει» ξένο αντικείμενο καραντίνας.
 * ⚠️ **Δικό του μυστικό** (`TOUR_UPLOAD_SECRET`) **και** πεδίο σκοπού: η υπογραφή δεν ξέρει σε ποια πύλη ανήκει.
 */

import { isPlaceSource } from '@/constants/place-sources';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import type { TourSubject } from '@/types/spatial-tour';

export const TOUR_UPLOAD_SECRET_ENV = 'TOUR_UPLOAD_SECRET';

const TICKET_PURPOSE = 'tour-upload';

/**
 * **6 ώρες** — αρκεί για 40 MB και στο χειρότερο δίκτυο εργοταξίου· λήγει **πολύ πριν** σβήσει ο κανόνας κύκλου
 * ζωής την καραντίνα (1 ημέρα), ώστε η ολοκλήρωση να μη βρει ποτέ «εισιτήριο ζωντανό, αντικείμενο σβησμένο».
 */
export const TOUR_UPLOAD_TICKET_TTL_MS = 6 * 60 * 60 * 1000;

export interface TourUploadTicket {
  readonly uploadId: string;
  readonly subject: TourSubject;
  readonly uploaderUid: string;
  /** Ο κάτοχος της περιήγησης **στην έναρξη** — η ολοκλήρωση αρνείται αν η αγγελία άλλαξε χέρια (§4.4). */
  readonly custody: CustodyScope;
  /** Τα bytes που **δηλώθηκαν** — το αντικείμενο πρέπει να έχει ακριβώς αυτό το μέγεθος. */
  readonly contentLength: number;
  readonly expiresAtMs: number;
}

export type TourUploadTicketReading =
  | { readonly kind: 'read'; readonly ticket: TourUploadTicket }
  /** Πλαστό · αλλοιωμένο · άλλου σκοπού · ληγμένο — για τον άνθρωπο όλα λένε «ξεκίνα ξανά το ανέβασμα». */
  | { readonly kind: 'invalid' }
  /** Λείπει το **δικό μας** μυστικό — «δεν μπόρεσα», ποτέ «πλαστό». */
  | { readonly kind: 'secret-missing' };

function readSecret(): string | null {
  try {
    return requireTokenSecret(TOUR_UPLOAD_SECRET_ENV);
  } catch {
    return null;
  }
}

/** **Υπόγραψε το εισιτήριο** — `null` ⇒ λείπει το μυστικό (ο καλών απαντά «δεν μπόρεσα»). */
export function issueTourUploadTicket(ticket: TourUploadTicket): string | null {
  const secret = readSecret();
  if (secret === null) return null;
  const [custodyKind, custodyId] = ticket.custody.userId !== undefined ? ['u', ticket.custody.userId] : ['c', ticket.custody.companyId];
  return encodeSignedToken(secret, [
    TICKET_PURPOSE, ticket.uploadId, ticket.subject.kind, ticket.subject.id, ticket.uploaderUid,
    custodyKind, custodyId, String(ticket.contentLength), String(ticket.expiresAtMs),
  ]);
}

/** Τα πεδία → εισιτήριο, ή `null` αν οποιοδήποτε δεν διαβάζεται (κανένα «μισό» εισιτήριο). */
function ticketOf(fields: readonly string[]): TourUploadTicket | null {
  const [purpose, uploadId, kind, subjectId, uploaderUid, custodyKind, custodyId, length, exp] = fields;
  if (purpose !== TICKET_PURPOSE || !uploadId || !subjectId || !uploaderUid || !custodyId || !isPlaceSource(kind)) return null;
  const contentLength = Number(length);
  const expiresAtMs = Number(exp);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || !Number.isSafeInteger(expiresAtMs)) return null;
  const custody: CustodyScope | null =
    custodyKind === 'u' ? { userId: custodyId } : custodyKind === 'c' ? { companyId: custodyId } : null;
  if (custody === null) return null;
  return { uploadId, subject: { kind, id: subjectId }, uploaderUid, custody, contentLength, expiresAtMs };
}

/** **Εισιτήριο → τι υποσχέθηκε η έναρξη.** Η υπογραφή και η λήξη κρίνονται **πριν** από κάθε ανάγνωση βάσης. */
export function readTourUploadTicket(token: string, nowMs: number): TourUploadTicketReading {
  const secret = readSecret();
  if (secret === null) return { kind: 'secret-missing' };
  const verdict = decodeSignedToken(secret, token, 9);
  if (!verdict.ok) return { kind: 'invalid' };
  const ticket = ticketOf(verdict.fields);
  if (ticket === null || ticket.expiresAtMs <= nowMs) return { kind: 'invalid' };
  return { kind: 'read', ticket };
}
