/**
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΕΡΩΤΗΣΗΣ ΑΡΓΙΩΝ** — μυστικό, κωδικοποίηση, αποκωδικοποίηση (ADR-841 §7 Α21.21 Φάση Β).
 * @related lib/tokens/signed-token.ts (η γραμματική) · services/mandate/showcase-email-confirmation-token.ts (το πρότυπο) ·
 *   server/notifications/notification-email-envelope.ts (υπογράφει τη στιγμή της αποστολής) ·
 *   services/mandate/holiday-hours-question-decision.ts (εξαργύρωση)
 * @module services/mandate/holiday-hours-question-token
 *
 * 🔑 **Ένας σύνδεσμος ανά παραλήπτη**: κουβαλά `(ερώτηση, nonce, παραλήπτης)`. Η απάντηση κλείνει την ερώτηση για
 * **όλους** τους διαχειριστές, αλλά το ίχνος λέει **ποιος** πάτησε.
 *
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό** (δόγμα του `signed-token.ts`). Η λήξη **δεν** ζει στον σύνδεσμο: κρίνεται από το
 * **αποθηκευμένο** `lastDate` — ένα email που περίμενε το παράθυρο παράδοσης δεν κουβαλά δεύτερο ρολόι.
 */

import 'server-only';

import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';

const SECRET_ENV = 'HOLIDAY_HOURS_QUESTION_SECRET';
const FIELD_COUNT = 3;

export interface HolidayQuestionLinkFields {
  readonly id: string;
  readonly nonce: string;
  readonly recipientUid: string;
}

/** Το μυστικό, ή `null` αν λείπει **από εμάς** — «μη διαθέσιμο», ποτέ «άκυρος σύνδεσμος». */
export function holidayQuestionSecret(): string | null {
  try {
    return requireTokenSecret(SECRET_ENV);
  } catch {
    return null;
  }
}

export function encodeHolidayQuestionLink(secret: string, fields: HolidayQuestionLinkFields): string {
  return encodeSignedToken(secret, [fields.id, fields.nonce, fields.recipientUid]);
}

/** **Σύνδεσμος → πεδία**, αφού αποδειχθεί η υπογραφή — ή `null`. Πλαστός σύνδεσμος δεν κοστίζει ούτε μία ανάγνωση. */
export function readHolidayQuestionLink(secret: string, token: string): HolidayQuestionLinkFields | null {
  const verdict = decodeSignedToken(secret, token, FIELD_COUNT);
  if (!verdict.ok || verdict.fields.length !== FIELD_COUNT) return null;
  const [id, nonce, recipientUid] = verdict.fields as [string, string, string];
  return { id, nonce, recipientUid };
}
