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
 * ♻️ Ο πυρήνας ζει στο `server/access-grant/access-grant.ts` (ADR-884 Κ3β): αυτό το αρχείο
 * είναι ο καταναλωτής **κοινοποίησης**, το `server/spatial-tour/tour-view-grant.ts` ο
 * καταναλωτής **θέασης περιήγησης** — ίδια λήξη, ίδιες σημαίες, άλλος υπογεγραμμένος σκοπός.
 *
 * @module server/sharing/share-access-grant
 */

import type { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_GRANT_SECRET_ENV,
  ACCESS_GRANT_TTL_SECONDS,
  attachAccessGrant,
  issueAccessGrant,
  readAccessGrant,
  requestAccessGrant,
  type AccessGrantKind,
} from '@/server/access-grant/access-grant';

/** Το μυστικό — δηλωμένο στο `config/environment-contract.ts`. */
export const SHARE_ACCESS_SECRET_ENV = ACCESS_GRANT_SECRET_ENV;

export const SHARE_ACCESS_GRANT_TTL_SECONDS = ACCESS_GRANT_TTL_SECONDS;

const SHARE_GRANT: AccessGrantKind = { purpose: 'share-access', subjectFieldCount: 1 };
const COOKIE_PREFIX = 'nestor_share_';
const COOKIE_PATH = '/api';

/** Όνομα cookie **ανά σύνδεσμο** — δύο ανοιχτοί σύνδεσμοι δεν πατούν ο ένας τον άλλον. */
export function shareAccessCookieName(shareId: string): string {
  return `${COOKIE_PREFIX}${shareId}`;
}

/**
 * Εκδίδει κουπόνι για `shareId`. `null` ⇒ λείπει το μυστικό **από εμάς** — ο καλών
 * απαντά «μη διαθέσιμο», **ποτέ** «λάθος κωδικός» (ο άνθρωπος έδωσε τον σωστό).
 */
export function issueShareAccessGrant(shareId: string, nowMs: number = Date.now()): string | null {
  return issueAccessGrant(SHARE_GRANT, [shareId], nowMs);
}

/** Καθαρή επαλήθευση κουπονιού για **αυτό** το `shareId`. */
export function isShareAccessGrantValid(grant: string, shareId: string, nowMs: number = Date.now()): boolean {
  const subject = readAccessGrant(SHARE_GRANT, grant, nowMs);
  return subject !== null && subject[0] === shareId;
}

/** Έχει το αίτημα έγκυρο κουπόνι για αυτή την κοινοποίηση; */
export function requestHasShareAccessGrant(request: NextRequest, shareId: string): boolean {
  const grant = requestAccessGrant(request, shareAccessCookieName(shareId));
  return grant !== null && isShareAccessGrantValid(grant, shareId);
}

/** Γράφει το κουπόνι στην απάντηση. */
export function attachShareAccessGrant(response: NextResponse, shareId: string, grant: string): void {
  attachAccessGrant(response, { name: shareAccessCookieName(shareId), path: COOKIE_PATH }, grant);
}
