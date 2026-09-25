import 'server-only';

/**
 * =============================================================================
 * SHARE ACCESS GRANT — «αυτός ο browser ΕΔΩΣΕ ήδη τον σωστό κωδικό» (ADR-884 Φ0.12 · Φ0.4)
 * =============================================================================
 *
 * 🔴 **Το κενό που κλείνει**: οι δημόσιες διαδρομές showcase
 * (`/api/{property,project,building,storage,parking}-showcase/[token]` και τα `/pdf` τους)
 * **δεν έλεγχαν ποτέ τον κωδικό**. Ο κωδικός ζούσε μόνο στη σελίδα `/shared/[token]` —
 * δηλαδή ήταν πόρτα στην **οθόνη**, όχι στα **δεδομένα**: ένα `curl` στο API άνοιγε έναν
 * σύνδεσμο «με κωδικό» χωρίς κωδικό.
 *
 * **Πώς**: μετά από σωστό κωδικό στο `POST /api/shares/resolve`, ο διακομιστής εκδίδει
 * κουπόνι **HMAC** δεμένο στο `shareId`, με λήξη **15′**, σε cookie `HttpOnly` +
 * `SameSite=Lax` + `Path=/api` (+ `Secure` σε παραγωγή). Κάθε διαδρομή payload/PDF
 * κοινοποίησης με κωδικό το ζητά. Ο έλεγχος είναι **μόνο** υπογραφή — καμία ανάγνωση βάσης.
 *
 * 🔑 **Γιατί cookie και όχι κεφαλίδα**: το PDF ανοίγει ως **σύνδεσμος** σε νέα καρτέλα·
 * κεφαλίδα δεν ταξιδεύει εκεί. Και `HttpOnly` σημαίνει ότι ούτε ένα XSS δεν το διαβάζει.
 *
 * 🔑 **Γιατί δεν χρειάζεται λίστα ανάκλησης**: η ανάκληση του **συνδέσμου** τον βγάζει από
 * το `findActiveShareByToken` (`isActive == false`), οπότε το κουπόνι δεν έχει πια σε τι να
 * δώσει πρόσβαση. Και οι κοινοποιήσεις δεν αλλάζουν κωδικό — «αλλαγή πολιτικής» =
 * ανάκληση + νέος σύνδεσμος (UnifiedShareDialog).
 *
 * 🔑 **Και κουπόνι ΕΠΙΣΚΕΨΗΣ**: εκδίδεται σε **κάθε** άνοιγμα (όχι μόνο μετά από κωδικό),
 * ώστε μέσα στα 15′ της επίσκεψης επαναφόρτωση, προεπισκόπηση, PDF και λήψη να **μη**
 * ξαναμετρούν πρόσβαση (πρότυπο Google Drive: μετρά το άνοιγμα, όχι κάθε byte).
 *
 * ♻️ Αυτός είναι και ο πυρήνας του **κουπονιού θέασης** των πλακιδίων περιήγησης
 * (ADR-884 §8.1 Φ0.4) — ίδια γραμματική (`lib/tokens/signed-token`), ίδια λήξη.
 *
 * @module server/sharing/share-access-grant
 */

import type { NextRequest, NextResponse } from 'next/server';

import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';

const logger = createModuleLogger('ShareAccessGrant');

/** Το μυστικό — δηλωμένο στο `config/environment-contract.ts`. */
export const SHARE_ACCESS_SECRET_ENV = 'SHARE_ACCESS_SECRET';

const GRANT_PURPOSE = 'share-access';
export const SHARE_ACCESS_GRANT_TTL_SECONDS = 15 * 60;
const COOKIE_PREFIX = 'nestor_share_';
const COOKIE_PATH = '/api';

/** Όνομα cookie **ανά σύνδεσμο** — δύο ανοιχτοί σύνδεσμοι δεν πατούν ο ένας τον άλλον. */
export function shareAccessCookieName(shareId: string): string {
  return `${COOKIE_PREFIX}${shareId}`;
}

function readSecret(): string | null {
  try {
    return requireTokenSecret(SHARE_ACCESS_SECRET_ENV);
  } catch {
    logger.error('Share access grant secret is not configured', { envVar: SHARE_ACCESS_SECRET_ENV });
    return null;
  }
}

/**
 * Εκδίδει κουπόνι για `shareId`. `null` ⇒ λείπει το μυστικό **από εμάς** — ο καλών
 * απαντά «μη διαθέσιμο», **ποτέ** «λάθος κωδικός» (ο άνθρωπος έδωσε τον σωστό).
 */
export function issueShareAccessGrant(shareId: string, nowMs: number = Date.now()): string | null {
  const secret = readSecret();
  if (secret === null) return null;
  const expiresAt = Math.floor(nowMs / 1000) + SHARE_ACCESS_GRANT_TTL_SECONDS;
  return encodeSignedToken(secret, [GRANT_PURPOSE, shareId, String(expiresAt)]);
}

/** Καθαρή επαλήθευση κουπονιού για **αυτό** το `shareId`. */
export function isShareAccessGrantValid(grant: string, shareId: string, nowMs: number = Date.now()): boolean {
  const secret = readSecret();
  if (secret === null) return false;
  const verdict = decodeSignedToken(secret, grant, 3);
  if (!verdict.ok) return false;
  const [purpose, grantedShareId, expiresAt] = verdict.fields;
  if (purpose !== GRANT_PURPOSE || grantedShareId !== shareId) return false;
  const expiresAtSeconds = Number(expiresAt);
  return Number.isFinite(expiresAtSeconds) && expiresAtSeconds * 1000 > nowMs;
}

/** Έχει το αίτημα έγκυρο κουπόνι για αυτή την κοινοποίηση; */
export function requestHasShareAccessGrant(request: NextRequest, shareId: string): boolean {
  const grant = request.cookies.get(shareAccessCookieName(shareId))?.value;
  return typeof grant === 'string' && grant !== '' && isShareAccessGrantValid(grant, shareId);
}

/** Γράφει το κουπόνι στην απάντηση. */
export function attachShareAccessGrant(response: NextResponse, shareId: string, grant: string): void {
  response.cookies.set(shareAccessCookieName(shareId), grant, {
    httpOnly: true,
    secure: getCurrentRuntimeEnvironment() === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: SHARE_ACCESS_GRANT_TTL_SECONDS,
  });
}
