/**
 * @fileoverview **«Πού γυρνά ο άνθρωπος μετά τη σύνδεση;»** — ο φρουρός του `?next=`.
 * @module lib/routes/return-path
 * @see ADR-848 — σύνδεσμοι email ειδοποιήσεων
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Κάθε φρουρός σύνδεσης του έργου έστελνε σε **σκέτο** `/login`: το δίχτυ
 * (`[...unprefixed]`), το layout του χώρου, το `ProtectedRoute`. Ο αρχικός
 * προορισμός **πεταγόταν**. Για σελιδοδείκτη είναι ενόχληση· για σύνδεσμο μέσα σε
 * email είναι **ακύρωση του συνδέσμου**: ο άνθρωπος πατά «Άνοιγμα της αγγελίας»,
 * συνδέεται, και προσγειώνεται στο ταμπλό του — να ψάχνει ό,τι μόλις του δείξαμε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΦΡΟΥΡΟΣ ΚΑΙ ΟΧΙ ΑΠΛΩΣ `searchParams.get('next')`
 * ────────────────────────────────────────────────────────────────────────────
 * Το `next` το γράφει **όποιος φτιάξει τον σύνδεσμο** — και ο επιτιθέμενος φτιάχνει
 * συνδέσμους. Ένα `https://nestorconstruct.gr/login?next=https://evil.example` που
 * ανακατευθύνει τυφλά είναι **ανοιχτή ανακατεύθυνση** (OWASP · Broken Access
 * Control): το θύμα βλέπει **δικό μας** domain, εμπιστεύεται, συνδέεται — και
 * καταλήγει σε ψεύτικη σελίδα που του ζητά ξανά τον κωδικό.
 *
 * Η απάντηση του OWASP με σειρά προτίμησης: **καμία** εξωτερική διεύθυνση · μόνο
 * **διαδρομή του ίδιου origin** · επικύρωση με **λίστα αποδοχής**, ποτέ λίστα
 * απαγόρευσης. Εδώ: γίνεται δεκτή **μόνο** διαδρομή, και ο κριτής του origin είναι ο
 * **ίδιος ο αναλυτής URL** — όχι regex που ξεχνά τις παραλλαγές.
 *
 * ⚠️ **Οι παραλλαγές που ξεγελούν τα regex** (όλες στα tests):
 * `//evil.example` (protocol-relative) · `/\evil.example` (οι φυλλομετρητές
 * διαβάζουν το `\` ως `/`) · `/%2F%2Fevil.example` (αποκωδικοποιείται αργότερα) ·
 * `/%09/evil.example` (tab που πετιέται) · `javascript:…` · `https://…`.
 */

import type { AuthFormMode } from '@/auth/types/auth.types';

import { AUTH_ROUTES } from './authRoutes';
import { declaredHref, typedHref, withQuery, type WorkspaceHref } from '@/lib/workspace/route-worlds';

/** Το όνομα της παραμέτρου — **ένα**, για όσους τη γράφουν και όσους τη διαβάζουν. */
export const RETURN_PATH_PARAM = 'next' as const;

/** Πάνω από αυτό δεν είναι διαδρομή, είναι φορτίο. */
const MAX_RETURN_PATH_LENGTH = 2048;

/**
 * Origin-ανιχνευτής: αν ο αναλυτής καταλήξει σε **άλλο** origin, η τιμή δήλωνε
 * δικό της σπίτι. Το `.invalid` είναι δεσμευμένο TLD (RFC 2606) — δεν λύνεται ποτέ.
 */
const PROBE_ORIGIN = 'https://return-path.invalid';

/**
 * Προορισμοί που **δεν** είναι επιστροφή αλλά βρόχος: `?next=/login?next=/login…`
 * θα έστελνε τον συνδεδεμένο πίσω στη φόρμα που μόλις συμπλήρωσε.
 */
const LOOP_ROUTES: readonly string[] = [AUTH_ROUTES.login];

/** Χαρακτήρες ελέγχου και κενά — οι φυλλομετρητές τους **πετούν** σιωπηλά. */
const CONTROL_OR_SPACE = /[\p{Cc}\s]/u;

/** Ο λόγος του `declaredHref` — η διαδρομή έρχεται από δεδομένα, όχι από γραμμένο κείμενο. */
const DECLARED_REASON =
  'Διαδρομή επιστροφής μετά τη σύνδεση: έρχεται από το ?next= και έχει ήδη περάσει τον φρουρό του ίδιου origin.';

/** Μορφολογικός έλεγχος **πριν** τον αναλυτή — ό,τι κόβεται εδώ δεν χρειάζεται ερμηνεία. */
function hasSafeShape(raw: string): boolean {
  if (raw.length === 0 || raw.length > MAX_RETURN_PATH_LENGTH) return false;
  if (!raw.startsWith('/') || raw.startsWith('//')) return false;
  return !raw.includes('\\') && !CONTROL_OR_SPACE.test(raw);
}

/** Η **αποκωδικοποιημένη** διαδρομή — αυτό που θα δει ο δρομολογητής αργότερα. */
function decodedPathIsSafe(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  return !decoded.startsWith('//') && !decoded.includes('\\') && !CONTROL_OR_SPACE.test(decoded);
}

function isLoopRoute(pathname: string): boolean {
  return LOOP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * **Η τιμή του `?next=`, ή `null` αν δεν είναι διαδρομή ΑΥΤΟΥ του ιστότοπου.**
 *
 * Επιστρέφει `pathname + search` όπως τα κανονικοποίησε ο αναλυτής — **ποτέ** το
 * ωμό κείμενο, και **ποτέ** το `#hash` (δεν φτάνει στον διακομιστή, άρα δεν μπορεί
 * να είναι μέρος προορισμού που κρίνει ο διακομιστής).
 *
 * ⚠️ **Δέχεται `unknown`**: η τιμή έρχεται από `searchParams`, όπου μπορεί να είναι
 * πίνακας (`?next=a&next=b`) ή απούσα. Πίνακας ⇒ `null` — δύο προορισμοί δεν
 * είναι προορισμός.
 */
export function safeReturnPath(raw: unknown): WorkspaceHref | null {
  if (typeof raw !== 'string' || !hasSafeShape(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== PROBE_ORIGIN) return null;
  if (!decodedPathIsSafe(parsed.pathname)) return null;
  if (isLoopRoute(parsed.pathname)) return null;

  return declaredHref(DECLARED_REASON, `${parsed.pathname}${parsed.search}`);
}

/**
 * **Η σελίδα σύνδεσης, με επιστροφή όπου αυτή είναι ασφαλής.**
 *
 * Άκυρη ή απούσα επιστροφή ⇒ σκέτο `/login`: ο άνθρωπος χάνει μόνο την ευκολία,
 * ποτέ την ασφάλεια. **Ποτέ δεν πετά** — ένας φρουρός σύνδεσης που ρίχνει σελίδα
 * επειδή κάποιος έγραψε σκουπίδια στο URL θα ήταν χειρότερος από κανέναν.
 */
export function loginHref(returnPath?: string | null, entry?: LoginEntry): WorkspaceHref {
  const safe = safeReturnPath(returnPath);
  if (safe === null) return typedHref(AUTH_ROUTES.login);

  const params = new URLSearchParams({ [RETURN_PATH_PARAM]: safe });
  if (entry?.mode) params.set(AUTH_ENTRY_MODE_PARAM, entry.mode);
  if (entry?.invitedAs && invitedAsOf(entry.invitedAs) !== null) params.set(INVITED_AS_PARAM, entry.invitedAs);
  return withQuery(AUTH_ROUTES.login, params.toString());
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 ΤΟ ΠΛΑΙΣΙΟ ΤΗΣ ΕΙΣΟΔΟΥ (ADR-915 §39 — «βήμα λογαριασμού», 2026-11-14)
// ─────────────────────────────────────────────────────────────────────────────
// Μια σελίδα πρόσκλησης **ξέρει** αν ο παραλήπτης έχει λογαριασμό· η φόρμα όχι. Χωρίς αυτό ο νέος επαγγελματίας
// προσγειωνόταν στη «Σύνδεση», δοκίμαζε, και έπαιρνε «Μη έγκυρα στοιχεία» — χωρίς να μάθει ότι έπρεπε να κάνει
// **Εγγραφή** και **με ποιο** email (μετρημένο ζωντανά). Ίδιο ζεύγος γραφέα/αναγνώστη με το `next`: **ένα** όνομα
// παραμέτρου, **ένας** φρουρός. ⛔ Το `invitedAs` είναι **ΜΟΝΟ** καλυμμένη μορφή (`maskEmail`) — ποτέ πλήρης
// διεύθυνση στο URL (ιστορικό, Referer, logs).

/** Οι λειτουργίες της φόρμας — ίδιο κλειστό σύνολο με το `AuthFormMode`. */
export const AUTH_ENTRY_MODES = ['signin', 'signup', 'reset'] as const satisfies readonly AuthFormMode[];
export type AuthEntryMode = (typeof AUTH_ENTRY_MODES)[number];

export const AUTH_ENTRY_MODE_PARAM = 'mode' as const;
export const INVITED_AS_PARAM = 'invitedAs' as const;

export interface LoginEntry {
  readonly mode?: AuthEntryMode;
  /** Καλυμμένη διεύθυνση του παραλήπτη (`g***1@gmail.com`) — για τη λωρίδα «συνεχίζετε την πρόσκληση για…». */
  readonly invitedAs?: string;
}

/** Η καλυμμένη μορφή: `x***y@domain` ή `x***@domain` — τίποτε άλλο δεν περνά. */
const MASKED_EMAIL_SHAPE = /^[^\s@*]{1}\*\*\*[^\s@*]?@[^\s@]{1,253}$/u;

/** `?mode=` ⇒ λειτουργία της φόρμας, ή `null` (πίνακας/άγνωστο ⇒ η προεπιλογή της σελίδας). */
export function authEntryModeOf(raw: unknown): AuthEntryMode | null {
  return typeof raw === 'string' && (AUTH_ENTRY_MODES as readonly string[]).includes(raw) ? (raw as AuthEntryMode) : null;
}

/** `?invitedAs=` ⇒ η καλυμμένη διεύθυνση, ή `null` αν δεν έχει **ακριβώς** καλυμμένο σχήμα (πλήρες email ⇒ `null`). */
export function invitedAsOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= 260 && MASKED_EMAIL_SHAPE.test(raw) ? raw : null;
}

/**
 * **Σύνδεση με επιστροφή ΕΔΩ — για φρουρό ΠΕΛΑΤΗ** (ADR-848 §9 #3 · ADR-900 §3.7).
 *
 * Ο φρουρός του διακομιστή ζητά `loginHrefForRequest()`· ο φρουρός πελάτη (`ProtectedRoute`) δεν βλέπει
 * κεφαλίδες, βλέπει όμως το `location`. Καλείται **τη στιγμή της ανακατεύθυνσης** (μέσα σε effect), όχι
 * στην απόδοση: εκεί υπάρχει `window`, και η διαδρομή είναι η τρέχουσα — όχι στιγμιότυπο.
 *
 * ⚠️ Το `#hash` **δεν** περνά (δες {@link safeReturnPath}). Έξω από φυλλομετρητή ⇒ σκέτο `/login`.
 */
export function loginHrefForCurrentLocation(): WorkspaceHref {
  if (typeof window === 'undefined') return loginHref(null);
  return loginHref(`${window.location.pathname}${window.location.search}`);
}
