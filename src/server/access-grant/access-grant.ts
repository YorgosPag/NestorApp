import 'server-only';

/**
 * =============================================================================
 * ACCESS GRANT — ο ΕΝΑΣ πυρήνας του «κουπονιού επίσκεψης» (ADR-315 · ADR-884 Φ0.4)
 * =============================================================================
 *
 * Μετά από μια **κρίση** στη βάση (σωστός κωδικός κοινοποίησης · εγκεκριμένο αίτημα θέασης ·
 * ενεργός σύνδεσμος), ο διακομιστής εκδίδει κουπόνι **HMAC** με λήξη **15′**, σε cookie
 * `HttpOnly`. Κάθε επόμενο αίτημα ελέγχει **μόνο** την υπογραφή — **καμία** ανάγνωση βάσης. Ένα
 * πανόραμα = εκατοντάδες πλακίδια, και ένα άνοιγμα = **μία** μέτρηση (πρότυπο Google Drive).
 *
 * 🔑 **Γιατί ΕΝΑΣ πυρήνας με δύο καταναλωτές** (N.0.2): το κουπόνι κοινοποίησης
 * (`server/sharing/share-access-grant.ts`) και το κουπόνι θέασης περιήγησης
 * (`server/spatial-tour/tour-view-grant.ts`) είναι η **ίδια** πράξη πάνω σε άλλο αντικείμενο.
 * Δύο αντίγραφα θα απέκλιναν στη λήξη, στις σημαίες του cookie ή στον έλεγχο του σκοπού.
 *
 * 🔐 **Διαχωρισμός πεδίου με τον ΣΚΟΠΟ**: το πρώτο πεδίο του υπογεγραμμένου φορτίου είναι ο
 * `purpose`, και η ανάγνωση απορρίπτει κάθε άλλον. Ένα κουπόνι κοινοποίησης **δεν** διαβάζεται
 * ποτέ ως κουπόνι θέασης, ακόμη κι αν ταιριάζουν τα υπόλοιπα πεδία — γι' αυτό αρκεί ένα μυστικό.
 *
 * 🔑 **Γιατί δεν χρειάζεται λίστα ανάκλησης**: η ανάκληση της **πηγής** (σύνδεσμος · αίτημα) την
 * αφαιρεί από την κρίση, οπότε κανένα **νέο** κουπόνι δεν εκδίδεται. Το υπάρχον λήγει σε ≤ 15′.
 *
 * @module server/access-grant/access-grant
 */

import type { NextRequest, NextResponse } from 'next/server';

import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';

const logger = createModuleLogger('AccessGrant');

/** Το μυστικό — δηλωμένο στο `config/environment-contract.ts` (δύο καταναλωτές, ένα μυστικό). */
export const ACCESS_GRANT_SECRET_ENV = 'SHARE_ACCESS_SECRET';

/** Η λήξη **κάθε** κουπονιού επίσκεψης — μία τιμή, ώστε η ανάκληση να κόβει παντού στον ίδιο χρόνο. */
export const ACCESS_GRANT_TTL_SECONDS = 15 * 60;

/** Τι είδους κουπόνι — ο σκοπός υπογράφεται, το cookie ονομάζεται και οριοθετείται ανά είδος. */
export interface AccessGrantKind {
  /** Πρώτο πεδίο του υπογεγραμμένου φορτίου — χωρίς `:`. */
  readonly purpose: string;
  /** Πόσα πεδία ταυτότητας ακολουθούν τον σκοπό (π.χ. `[shareId]` = 1). */
  readonly subjectFieldCount: number;
}

/** Πού ζει το cookie — όνομα **ανά αντικείμενο**, ώστε δύο ανοιχτά να μην πατούν το ένα το άλλο. */
export interface AccessGrantCookie {
  readonly name: string;
  readonly path: string;
}

function readSecret(): string | null {
  try {
    return requireTokenSecret(ACCESS_GRANT_SECRET_ENV);
  } catch {
    logger.error('Access grant secret is not configured', { envVar: ACCESS_GRANT_SECRET_ENV });
    return null;
  }
}

/**
 * Εκδίδει κουπόνι. `null` ⇒ λείπει το μυστικό **από εμάς** — ο καλών απαντά «μη διαθέσιμο»,
 * **ποτέ** άρνηση του ανθρώπου (η κρίση του ήταν θετική).
 */
export function issueAccessGrant(
  kind: AccessGrantKind,
  subject: readonly string[],
  nowMs: number = Date.now(),
): string | null {
  if (subject.length !== kind.subjectFieldCount) {
    throw new Error(`access-grant ${kind.purpose}: expected ${kind.subjectFieldCount} subject fields`);
  }
  const secret = readSecret();
  if (secret === null) return null;
  const expiresAt = Math.floor(nowMs / 1000) + ACCESS_GRANT_TTL_SECONDS;
  return encodeSignedToken(secret, [kind.purpose, ...subject, String(expiresAt)]);
}

/**
 * Καθαρή ανάγνωση: τα πεδία ταυτότητας αν το κουπόνι είναι **έγκυρο, αυτού του σκοπού και ζωντανό**,
 * αλλιώς `null`. Ο καλών συγκρίνει τα πεδία με το αντικείμενο που ζητήθηκε.
 */
export function readAccessGrant(
  kind: AccessGrantKind,
  grant: string,
  nowMs: number = Date.now(),
): readonly string[] | null {
  const secret = readSecret();
  if (secret === null) return null;
  const verdict = decodeSignedToken(secret, grant, kind.subjectFieldCount + 2);
  if (!verdict.ok || verdict.fields.length !== kind.subjectFieldCount + 2) return null;
  const [purpose, ...rest] = verdict.fields;
  if (purpose !== kind.purpose) return null;
  const expiresAtSeconds = Number(rest[rest.length - 1]);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds * 1000 <= nowMs) return null;
  return rest.slice(0, kind.subjectFieldCount);
}

/** Το κουπόνι που φέρει το αίτημα σε αυτό το cookie, ή `null`. */
export function requestAccessGrant(request: NextRequest, cookieName: string): string | null {
  const grant = request.cookies.get(cookieName)?.value;
  return typeof grant === 'string' && grant !== '' ? grant : null;
}

/** Γράφει το κουπόνι στην απάντηση — `HttpOnly` · `SameSite=Lax` · `Secure` σε παραγωγή. */
export function attachAccessGrant(response: NextResponse, cookie: AccessGrantCookie, grant: string): void {
  response.cookies.set(cookie.name, grant, {
    httpOnly: true,
    secure: getCurrentRuntimeEnvironment() === 'production',
    sameSite: 'lax',
    path: cookie.path,
    maxAge: ACCESS_GRANT_TTL_SECONDS,
  });
}
