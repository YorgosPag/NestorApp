import 'server-only';

/**
 * @fileoverview **Η ΑΝΑΚΛΗΣΗ ΦΤΑΝΕΙ ΣΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΕΓΓΡΑΦΗ** — ADR-894 §10 Β1.
 * @related services/session/session-server.service (ο καλών) · lib/auth/revoked-sign-ins (η λίστα) ·
 *   lib/auth/revocation-watermark (η σφραγίδα στο σύνορο)
 * @module services/session/session-sign-in-revocation
 *
 * Δύο πράξεις, ένας κάτοχος:
 * - {@link denySignIns} — «αποσύνδεσε **αυτές** τις συνδέσεις»: γράφει τα `auth_time` στη λίστα. Πάνω από το
 *   όριο **κλιμακώνει** σε {@link endEverySignIn}.
 * - {@link endEverySignIn} — «αποσύνδεσε **όλες**»: `revokeRefreshTokens` (κόβει και την απευθείας πρόσβαση του
 *   client στη Firestore μέσα σε ≤ 1 ώρα) και η λίστα αδειάζει (περιττή πια).
 * Και οι δύο **ξεχνούν** αμέσως τη σφραγίδα σε αυτή τη διεργασία ⇒ η ανάκληση είναι άμεση εδώ, ≤ 30″ αλλού.
 */

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { forgetRevocationState, readValidAfterMs } from '@/lib/auth/revocation-watermark';
import { clearRevokedSignIns, recordRevokedSignIns } from '@/lib/auth/revoked-sign-ins';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('session-sign-in-revocation');

export interface SignInRevocationOutcome {
  /** Ανακλήθηκαν **όλες** οι συνδέσεις (ρητά ή λόγω ορίου) ⇒ ο καλών χρειάζεται νέο κλειδί. */
  readonly everySignInEnded: boolean;
}

/** Η σφραγίδα του λογαριασμού, για το κλάδεμα της λίστας. Αποτυχία ⇒ `0` (απλώς δεν κλαδεύουμε). */
async function accountValidAfterMs(uid: string): Promise<number> {
  try {
    return readValidAfterMs((await getAdminAuth().getUser(uid)).tokensValidAfterTime);
  } catch (error: unknown) {
    logger.warn('Χωρίς σφραγίδα λογαριασμού — η λίστα δεν κλαδεύεται', { uid, error: getErrorMessage(error) });
    return 0;
  }
}

/**
 * Αρνήσου από εδώ και πέρα τα διαπιστευτήρια αυτών των συνδέσεων.
 * @param callerAuthTimeSec Η σύνδεση του **καλούντα** — δεν ανακαλείται ποτέ από εδώ (φρουρός εαυτού).
 */
export async function denySignIns(
  uid: string,
  authTimes: readonly (number | undefined)[],
  callerAuthTimeSec: number | undefined,
): Promise<SignInRevocationOutcome> {
  if (!authTimes.some((authTime) => authTime !== undefined)) return { everySignInEnded: false };
  const validAfterMs = await accountValidAfterMs(uid);
  const outcome = await recordRevokedSignIns(uid, authTimes, { callerAuthTimeSec, validAfterMs });
  if (outcome === 'escalate') {
    logger.warn('Όριο ανακλημένων συνδέσεων — ανάκληση ΟΛΩΝ', { uid });
    await endEverySignIn(uid);
    return { everySignInEnded: true };
  }
  forgetRevocationState(uid);
  return { everySignInEnded: false };
}

/** Ανάκληση **όλων** των συνδέσεων του λογαριασμού (Firebase refresh tokens). */
export async function endEverySignIn(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid);
  forgetRevocationState(uid);
  try {
    await clearRevokedSignIns(uid);
  } catch (error: unknown) {
    // Η ανάκληση ΕΓΙΝΕ· μια λίστα που δεν άδειασε απλώς κλαδεύεται στην επόμενη εγγραφή.
    logger.warn('Η λίστα ανακλημένων συνδέσεων δεν άδειασε', { uid, error: getErrorMessage(error) });
  }
}
