import 'server-only';

/**
 * @fileoverview **ΚΛΕΙΔΙ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ ΓΙΑ ΤΗ ΣΥΣΚΕΥΗ ΠΟΥ ΑΝΑΚΑΛΕΣΕ ΤΙΣ ΑΛΛΕΣ** — ADR-892 §13 · ADR-894 §10 Β1.
 * @related server/workspace/member-exit-session (αποχώρηση από οικείο χώρο) · app/api/auth/active-sessions
 *   («αποσύνδεση όλων των άλλων») · auth/issued-session (ο πελάτης που το υιοθετεί)
 * @module server/auth/session-reissue
 *
 * 🔑 Μετά από `revokeRefreshTokens` **όλες** οι συνδέσεις του λογαριασμού είναι άκυρες — και η δική μας. Ο
 * άνθρωπος που πάτησε το κουμπί δεν πρέπει να αποσυνδεθεί: παίρνει custom token για **νέα** σύνδεση, με
 * `auth_time` μεταγενέστερο της ανάκλησης ⇒ περνά τη σφραγίδα (`revocation-watermark`).
 *
 * ⛔ **ΠΟΤΕ ΑΠΟ ΣΚΕΤΟ COOKIE**: το κλειδί δίνει συνεδρία χωρίς τη λήξη της παλιάς· ένα κλεμμένο cookie θα
 * «ξεπλενόταν» σε φρέσκια συνεδρία. Απαιτείται αίτημα με **Bearer ID token** — αυτό βγαίνει μόνο από κάτοχο του
 * refresh token. Το σύνορο (`buildApiIdentity`) επαληθεύει **μόνο** το Bearer όταν υπάρχει.
 * ℹ️ Ζούσε μέσα στο `member-exit-session.ts`· εξήχθη όταν ήρθε ο **δεύτερος** καλών (N.0.2).
 */

import type { NextRequest } from 'next/server';

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { extractBearerToken } from '@/lib/auth/token-credentials';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('session-reissue');

/**
 * Τι μαθαίνει ο πελάτης για τη δική του συνεδρία — κλειστό σύνολο.
 * - `unchanged` — καμία ανάκληση όλων: η συνεδρία του συνεχίζει ως έχει.
 * - `reissued`  — ανακλήθηκαν όλες· αυτό είναι το κλειδί της νέας συνεδρίας **αυτής** της συσκευής.
 * - `ended`     — ανακλήθηκαν όλες και **δεν** δίνεται κλειδί (όχι Bearer, ή αποτυχία έκδοσης):
 *                 ο πελάτης το λέει και στέλνει στη σύνδεση — η πράξη **έγινε**.
 */
export type SessionContinuation =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'reissued'; readonly token: string }
  | { readonly kind: 'ended' };

/**
 * Όλες οι συνδέσεις μόλις ανακλήθηκαν: δικαιούται αυτό το αίτημα κλειδί νέας συνεδρίας;
 * ⚠️ **Δεν πετά ποτέ**: η ανάκληση έχει ήδη γίνει· η συνέχεια είναι άνεση, όχι μέρος της πράξης.
 * @param act Ποια πράξη ανακάλεσε — μόνο για το ημερολόγιο.
 */
export async function reissueCallerSession(request: NextRequest, uid: string, act: string): Promise<SessionContinuation> {
  if (extractBearerToken(request) === null) return { kind: 'ended' };
  try {
    return { kind: 'reissued', token: await getAdminAuth().createCustomToken(uid) };
  } catch (error: unknown) {
    logger.error('Το κλειδί συνέχειας δεν εκδόθηκε — η ανάκληση ΕΓΙΝΕ', { uid, act, error: getErrorMessage(error) });
    return { kind: 'ended' };
  }
}
