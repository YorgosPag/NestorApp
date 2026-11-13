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
 * ♻️ **Ανανεώσιμα είδη** (ADR-315 Α6, 2026-11-13 — πρότυπο OWASP Session Management): ένα είδος με
 * `visitCeilingSeconds` φέρει **δύο** λήξεις — **αδράνειας** (15′, ανανεώνεται με `renewAccessGrant`) και **απόλυτη**
 * της επίσκεψης (υπογεγραμμένη, **δεν** παρατείνεται ποτέ). Η ανανέωση γίνεται **μόνο** από καλούντα που μόλις
 * ξαναέκρινε την πηγή στη βάση ⇒ το όριο ανάκλησης μένει ≤ 15′ από την **τελευταία κρίση**. Είδος χωρίς
 * `visitCeilingSeconds` (θέαση περιήγησης) κρατά **ακριβώς** τη μορφή μίας λήξης.
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
  /**
   * Ανανεώσιμο είδος: η **απόλυτη** διάρκεια της επίσκεψης από το άνοιγμα (OWASP absolute timeout). Χωρίς αυτό ⇒
   * μία λήξη 15′, καμία ανανέωση.
   */
  readonly visitCeilingSeconds?: number;
}

/** Ό,τι κουβαλά ένα έγκυρο κουπόνι πέρα από τον σκοπό: η ταυτότητα και, σε ανανεώσιμο είδος, η απόλυτη λήξη. */
interface DecodedGrant {
  readonly subject: readonly string[];
  /** Δευτερόλεπτα epoch· `null` σε μη ανανεώσιμο είδος. */
  readonly ceilingAt: number | null;
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
  const ceilingAt = kind.visitCeilingSeconds === undefined
    ? null
    : Math.floor(nowMs / 1000) + kind.visitCeilingSeconds;
  return encodeGrant(kind, subject, ceilingAt, nowMs);
}

/** Τα πεδία μετά την ταυτότητα: λήξη αδράνειας, και σε ανανεώσιμο είδος η απόλυτη λήξη. */
function lifeFieldCount(kind: AccessGrantKind): number {
  return kind.visitCeilingSeconds === undefined ? 1 : 2;
}

/** Η λήξη αδράνειας ενός κουπονιού που εκδίδεται τώρα — ποτέ πέρα από την απόλυτη λήξη της επίσκεψης. */
function idleExpiryAt(ceilingAt: number | null, nowMs: number): number {
  const idle = Math.floor(nowMs / 1000) + ACCESS_GRANT_TTL_SECONDS;
  return ceilingAt === null ? idle : Math.min(idle, ceilingAt);
}

function encodeGrant(
  kind: AccessGrantKind, subject: readonly string[], ceilingAt: number | null, nowMs: number,
): string | null {
  const secret = readSecret();
  if (secret === null) return null;
  const life = [String(idleExpiryAt(ceilingAt, nowMs))];
  if (ceilingAt !== null) life.push(String(ceilingAt));
  return encodeSignedToken(secret, [kind.purpose, ...subject, ...life]);
}

/** Έγκυρο, αυτού του σκοπού, ακριβώς αυτού του σχήματος και ζωντανό — αλλιώς `null`. */
function decodeGrant(kind: AccessGrantKind, grant: string, nowMs: number): DecodedGrant | null {
  const secret = readSecret();
  if (secret === null) return null;
  const fieldCount = 1 + kind.subjectFieldCount + lifeFieldCount(kind);
  const verdict = decodeSignedToken(secret, grant, fieldCount);
  if (!verdict.ok || verdict.fields.length !== fieldCount) return null;
  const [purpose, ...rest] = verdict.fields;
  if (purpose !== kind.purpose) return null;
  const life = rest.slice(kind.subjectFieldCount).map(Number);
  // Κάθε λήξη (αδράνειας, απόλυτη) πρέπει να είναι αριθμός στο μέλλον.
  if (life.some((at) => !Number.isFinite(at) || at * 1000 <= nowMs)) return null;
  return { subject: rest.slice(0, kind.subjectFieldCount), ceilingAt: life.length === 2 ? life[1] : null };
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
  return decodeGrant(kind, grant, nowMs)?.subject ?? null;
}

/**
 * **Ανανέωση αδράνειας** ενός ζωντανού κουπονιού ανανεώσιμου είδους: ίδια ταυτότητα, **ίδια** απόλυτη λήξη, νέα
 * λήξη αδράνειας `min(now + 15′, απόλυτη)`. `null` ⇒ άκυρο, ληγμένο, μη ανανεώσιμο είδος ή λείπει το μυστικό.
 * ⚠️ Ο καλών ανανεώνει **μόνο** αφού ξαναέκρινε την πηγή στη βάση (αλλιώς το όριο ανάκλησης χάνεται).
 */
export function renewAccessGrant(
  kind: AccessGrantKind,
  grant: string,
  nowMs: number = Date.now(),
): string | null {
  if (kind.visitCeilingSeconds === undefined) return null;
  const decoded = decodeGrant(kind, grant, nowMs);
  if (decoded === null || decoded.ceilingAt === null) return null;
  return encodeGrant(kind, decoded.subject, decoded.ceilingAt, nowMs);
}

/** Το κουπόνι που φέρει το αίτημα σε αυτό το cookie, ή `null`. */
export function requestAccessGrant(request: NextRequest, cookieName: string): string | null {
  const grant = request.cookies.get(cookieName)?.value;
  return typeof grant === 'string' && grant !== '' ? grant : null;
}

/**
 * Τα χαρακτηριστικά του cookie — **ένα** σημείο, ώστε η διαγραφή να ταιριάζει ακριβώς με την εγγραφή (ίδιο `Path`).
 * Εξάγεται για το cookie **συσκευής** κοινοποίησης (`share-device.ts`, ADR-884 §9.1 Α3′): ίδιες σημαίες, άλλη διάρκεια.
 */
export function grantCookieOptions(cookie: AccessGrantCookie, maxAge: number) {
  return {
    httpOnly: true,
    secure: getCurrentRuntimeEnvironment() === 'production',
    sameSite: 'lax' as const,
    path: cookie.path,
    maxAge,
  };
}

/** Γράφει το κουπόνι στην απάντηση — `HttpOnly` · `SameSite=Lax` · `Secure` σε παραγωγή. */
export function attachAccessGrant(response: NextResponse, cookie: AccessGrantCookie, grant: string): void {
  response.cookies.set(cookie.name, grant, grantCookieOptions(cookie, ACCESS_GRANT_TTL_SECONDS));
}

/**
 * **Σβήνει** το κουπόνι — όταν η κρίση είπε «όχι», ο browser δεν κρατά ζωντανό κουπόνι ως τη λήξη του. ⚠️ Δεν
 * αντικαθιστά τη λήξη (όποιος αντέγραψε το cookie το κρατά ως 15′ — δηλωμένο όριο), κλείνει το παράθυρο του ίδιου browser.
 */
export function clearAccessGrant(response: NextResponse, cookie: AccessGrantCookie): void {
  response.cookies.set(cookie.name, '', grantCookieOptions(cookie, 0));
}
