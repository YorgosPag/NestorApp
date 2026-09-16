/**
 * =============================================================================
 * ΠΟΙΟ ΑΝΤΙΚΕΙΜΕΝΟ ΔΕΙΧΝΕΙ ΑΥΤΟ ΤΟ URL; — ο ΕΝΑΣ αναγνώστης (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Αυτή η συμβολοσειρά URL, σε ποιο **object name** του bucket
 * αντιστοιχεί;»* — και **μόνο** αυτό.
 *
 * ⚠️ **ΔΕΝ ρωτά «επιτρέπεται;»** (αυτό είναι ο `storage-path-custody`) και **δεν
 * ρωτά «είναι ασφαλές να το κατεβάσω;»** (αυτό είναι ο `validateFetchUrl` του
 * `lib/security/path-sanitizer`, ADR-252 AR-M3). **Τρία ερωτήματα, τρεις
 * απαντητές** — ο καλών τα αλυσοδένει, κανένας δεν ντύνεται τον άλλον.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ — ΤΡΕΙΣ ΜΙΣΕΣ ΥΛΟΠΟΙΗΣΕΙΣ, ΚΑΜΙΑ ΠΛΗΡΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-16 — το ίδιο ερώτημα απαντιόταν σε **τρία** σημεία, κάθε ένα
 * για **ένα** σχήμα:
 *
 * | πού | σχήμα που ξέρει | τι δεν ξέρει |
 * |---|---|---|
 * | `lib/firebaseAdmin-storage.ts:34` | `storage.googleapis.com/{bucket}/…` | το `firebasestorage` σχήμα — **πετά** |
 * | `components/…/floorplan-pdf-renderer.ts:47` | `firebasestorage…/v0/b/{b}/o/{enc}` | client-side· δεν είναι εξαγόμενο |
 * | `api/admin/migrations/normalize-storage-paths:125` | αντικατάσταση **μέσα** στο URL | δεν εξάγει path |
 *
 * ⇒ Καμία δεν μπορούσε να γίνει ο φρουρός του `/api/download`, που δέχεται **ό,τι
 * URL κι αν έχει ο πελάτης στο χέρι**. Το να γραφόταν **τέταρτη** τοπική θα ήταν
 * ακριβώς ο N.18 *(«κεντρικοποιείς το Α και γράφεις Β+Γ ως δίδυμα»)*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΤΕΤΑΡΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΔΙΚΟ ΜΑΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `buildProxyUrl` (`services/storage-admin/public-upload.service.ts:152`)
 * παράγει `/api/storage/file/{encodedSegments}` — **same-origin**, και είναι η
 * μορφή που κουβαλούν τα νεότερα `downloadUrl`. Χωρίς αυτό το σχήμα, ο φρουρός θα
 * έλεγε «δεν αναγνωρίζω» για τα **δικά μας** URL.
 *
 * ⛔ **ΤΟ ΠΡΟΘΕΜΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ ΩΜΟ**: εισάγεται το ίδιο literal που παράγει ο
 * γραφέας, ώστε μια μετονομασία της διαδρομής να **σπάσει τη μεταγλώττιση** αντί
 * να αφήσει τον αναγνώστη να ψάχνει πρόθεμα που κανείς δεν γράφει πια.
 *
 * @module lib/storage/storage-object-url
 * @see lib/storage/storage-path-custody — «ποιανού είναι;»
 * @see lib/security/path-sanitizer — «είναι ασφαλές να το ζητήσω;» (SSRF)
 * @see services/storage-admin/public-upload.service — ο **γραφέας** του proxy URL
 */

import { API_ROUTES } from '@/config/domain-constants';

// =============================================================================
// Η ΕΚΒΑΣΗ
// =============================================================================

/**
 * Τι κατάλαβε ο αναγνώστης. **Ονομασμένη ένωση, ποτέ `string | null`.**
 *
 * ⚠️ Ένα `null` θα ισοπέδωνε τρία **διαφορετικά** πράγματα: «δεν είναι καν URL»,
 * «είναι URL αλλά άλλου παρόχου», «είναι σωστός πάροχος με ακατάληπτη μορφή». Ο
 * καλών χρειάζεται να τα ξεχωρίσει: το δεύτερο είναι **απόπειρα**, το τρίτο είναι
 * **δικό μας σφάλμα** — και το log τους δεν πρέπει να είναι το ίδιο.
 */
export type StorageObjectRef =
  | {
      readonly outcome: 'object';
      /** Το object name **όπως ζει στο bucket**, αποκωδικοποιημένο, χωρίς αρχική κάθετο. */
      readonly storagePath: string;
      /** Ποιο σχήμα το έδωσε — για παρατηρησιμότητα, ποτέ για απόφαση. */
      readonly scheme: StorageUrlScheme;
      /**
       * Το bucket **όπως το δηλώνει το URL**, όπου το σχήμα το φέρει.
       *
       * 🔑 Ο καλών οφείλει να το **συγκρίνει** με το δικό του: ένα URL που δείχνει
       * σε **άλλο** bucket με σωστό path θα περνούσε αλλιώς τον φρουρό μισθωτή και
       * θα κατέβαζε ξένο αντικείμενο. `null` για το same-origin σχήμα, που εξ
       * ορισμού αφορά **το** bucket μας.
       */
      readonly bucket: string | null;
    }
  | { readonly outcome: 'unreadable'; readonly why: StorageUrlGap };

/** Τα τέσσερα σχήματα που κουβαλούν τα `downloadUrl` αυτού του έργου. */
export type StorageUrlScheme =
  /** `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded}?alt=media&token=…` */
  | 'firebase-download-token'
  /** `https://storage.googleapis.com/{bucket}/{path}` */
  | 'gcs-public'
  /** `https://storage.cloud.google.com/{bucket}/{path}` */
  | 'gcs-console'
  /** `/api/storage/file/{encodedSegments}` — **δικό μας**, same-origin */
  | 'internal-proxy';

/** Γιατί δεν διαβάστηκε. **Κλειστό σύνολο.** */
export type StorageUrlGap =
  /** Κενό, ή δεν αναλύεται καν ως URL/διαδρομή. */
  | 'not-a-url'
  /** Αναλύεται, αλλά ο host δεν είναι κανένας από τους γνωστούς. */
  | 'unknown-provider'
  /** Σωστός πάροχος, μορφή που δεν ταιριάζει στο σχήμα του (π.χ. λείπει το `/o/`). */
  | 'malformed-for-scheme';

// =============================================================================
// ΤΑ ΣΧΗΜΑΤΑ, ΩΣ ΔΕΔΟΜΕΝΑ
// =============================================================================

/** `/api/storage/file` — **από τη σταθερά**, ποτέ ωμό literal (βλ. κεφαλίδα). */
const PROXY_PREFIX = `${API_ROUTES.STORAGE_FILE}/`;

/**
 * Host → πώς διαβάζεται η διαδρομή του.
 *
 * 🔑 `Record<string, …>` με **ακριβή** ονόματα host: ο έλεγχος είναι `===`, ποτέ
 * `includes`. ⚠️ **Μετρημένο 2026-09-16**: το `api/download:82` και το
 * `batch-download:153` έγραφαν `hostname.includes(domain)` ⇒ το
 * `firebasestorage.googleapis.com.<κακόβουλο>.gr` **περνούσε** και τα δύο. Ένας
 * πίνακας με κλειδί το πλήρες όνομα **δεν μπορεί** να έχει αυτό το σφάλμα.
 */
const HOST_SCHEME: Readonly<Record<string, StorageUrlScheme>> = {
  'firebasestorage.googleapis.com': 'firebase-download-token',
  'storage.googleapis.com': 'gcs-public',
  'storage.cloud.google.com': 'gcs-console',
};

const unreadable = (why: StorageUrlGap): StorageObjectRef => ({ outcome: 'unreadable', why });

/**
 * `/v0/b/{bucket}/o/{encodedPath}` → `{ bucket, path }`.
 *
 * ⚠️ Το `{encodedPath}` είναι **ένα** τμήμα με percent-encoded κάθετες, όπως το
 * παράγει το `getDownloadURL()`. Γι' αυτό το `(.+)` και όχι split σε `/`.
 */
function readFirebasePath(pathname: string): StorageObjectRef {
  const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(pathname);
  if (match === null) return unreadable('malformed-for-scheme');

  return {
    outcome: 'object',
    storagePath: decodeURIComponent(match[2]),
    scheme: 'firebase-download-token',
    bucket: match[1],
  };
}

/** `/{bucket}/{path…}` → `{ bucket, path }` — τα δύο σχήματα «ωμού» GCS. */
function readGcsPath(pathname: string, scheme: StorageUrlScheme): StorageObjectRef {
  const withoutLeadingSlash = pathname.replace(/^\//, '');
  const separator = withoutLeadingSlash.indexOf('/');
  if (separator <= 0 || separator === withoutLeadingSlash.length - 1) {
    return unreadable('malformed-for-scheme');
  }

  return {
    outcome: 'object',
    storagePath: decodeURIComponent(withoutLeadingSlash.slice(separator + 1)),
    scheme,
    bucket: withoutLeadingSlash.slice(0, separator),
  };
}

/**
 * `/api/storage/file/{seg}/{seg}/…` → το object name.
 *
 * ⚠️ Εδώ οι κάθετες είναι **πραγματικές** και κάθε τμήμα είναι χωριστά
 * κωδικοποιημένο (`buildProxyUrl`), άρα η αποκωδικοποίηση γίνεται **ανά τμήμα** —
 * ένα σκέτο `decodeURIComponent` σε όλο το υπόλοιπο θα ήταν σωστό κατά τύχη και
 * λάθος για όνομα αρχείου που περιέχει `%2F`.
 */
function readProxyPath(pathname: string): StorageObjectRef {
  const rest = pathname.slice(PROXY_PREFIX.length);
  if (rest.length === 0) return unreadable('malformed-for-scheme');

  return {
    outcome: 'object',
    storagePath: rest.split('/').map(decodeURIComponent).join('/'),
    scheme: 'internal-proxy',
    bucket: null,
  };
}

// =============================================================================
// Ο ΑΝΑΓΝΩΣΤΗΣ
// =============================================================================

/**
 * **Ποιο αντικείμενο δείχνει αυτό το URL;** — καθαρή συνάρτηση, κανένα I/O.
 *
 * @param rawUrl Απόλυτο URL **ή** same-origin διαδρομή (`/api/storage/file/…`).
 *
 * @example
 * const ref = storageObjectFromUrl(url);
 * if (ref.outcome !== 'object') return refuse();
 * if (judgeStorageCustody(ref.storagePath, caller) !== 'own-company') return notFound();
 */
export function storageObjectFromUrl(rawUrl: string): StorageObjectRef {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return unreadable('not-a-url');
  }
  const trimmed = rawUrl.trim();

  // ── Δικό μας, same-origin ──────────────────────────────────────────────────
  // Ελέγχεται **πρώτο** και χωρίς `new URL()`: είναι σχετική διαδρομή, άρα ο
  // κατασκευαστής θα πετούσε.
  if (trimmed.startsWith(PROXY_PREFIX)) {
    return readProxyPath(trimmed);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return unreadable('not-a-url');
  }

  const scheme = HOST_SCHEME[parsed.hostname.toLowerCase()];
  if (scheme === undefined) return unreadable('unknown-provider');

  switch (scheme) {
    case 'firebase-download-token':
      return readFirebasePath(parsed.pathname);
    case 'gcs-public':
    case 'gcs-console':
      return readGcsPath(parsed.pathname, scheme);
    case 'internal-proxy':
      // Δεν παράγεται από τον πίνακα host — το same-origin σχήμα κόπηκε παραπάνω.
      return unreadable('malformed-for-scheme');
  }
}

/**
 * ⚠️ **Εξάγεται ΜΟΝΟ για την άγκυρα** (διασταύρωση με τη λίστα του
 * `ALLOWED_FETCH_DOMAINS` του `path-sanitizer`: *«ξέρει ο αναγνώστης κάθε host που
 * ο φρουρός SSRF επιτρέπει;»*).
 *
 * ⛔ Καμία απόφαση δεν διαβάζει αυτόν τον πίνακα — την παίρνει ο
 * {@link storageObjectFromUrl}.
 */
export const STORAGE_URL_HOSTS = HOST_SCHEME;
