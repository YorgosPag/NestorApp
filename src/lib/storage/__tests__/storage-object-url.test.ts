/**
 * =============================================================================
 * 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΑΝΑΓΝΩΣΤΗ URL — ΚΑΙ ΤΟΥ BYPASS ΠΟΥ ΒΡΕΘΗΚΕ (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Διαβάζει ο αναγνώστης **μόνο** ό,τι είναι πράγματι δικό μας —
 * και ξέρει κάποιος αν κάποια διαδρομή bytes ξαναγράψει τον έλεγχο μόνη της;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΜΕΤΡΗΜΕΝΟ 2026-09-16
 * ─────────────────────────────────────────────────────────────────────────────
 * Τέσσερις υλοποιήσεις του **ίδιου** ερωτήματος *(«είναι δικό μας host;»)*, και οι
 * **δύο** που φυλάνε bytes ήταν **λάθος**:
 *
 * | πού | έλεγχος | περνά το `firebasestorage.googleapis.com.κακό.gr`; |
 * |---|---|---|
 * | `lib/security/path-sanitizer:164` *(SSoT)* | `=== d \|\| endsWith('.'+d)` | ❌ όχι |
 * | `api/download:82` | `includes(d) \|\| endsWith(d)` | 🔴 **ΝΑΙ** |
 * | `api/files/batch-download:153` | `includes(d)` | 🔴 **ΝΑΙ** |
 * | `api/files/classify:78` | σωστό, αλλά **τέταρτη** χειρόγραφη λίστα | ❌ όχι |
 *
 * Το `includes` κάνει τον έλεγχο **διακοσμητικό**: ο επιτιθέμενος βάζει το
 * επιτρεπόμενο όνομα ως **πρόθεμα του δικού του domain** και ο διακομιστής
 * κατεβάζει ό,τι του πουν. Είναι η κλασική SSRF που το OWASP περιγράφει ως
 * *«denylist/substring checks are bypassable»* — και γι' αυτό συνιστά
 * **indirection με opaque identifier** αντί για φιλτράρισμα URL.
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ Η ΟΜΑΔΑ `Δ` ΔΙΑΒΑΖΕΙ ΠΗΓΗ**: μια συμπεριφορική άγκυρα εδώ θα
 * απεδείκνυε ότι **ο αναγνώστης** είναι σωστός — **όχι** ότι οι διαδρομές τον
 * χρησιμοποιούν. Ο επόμενος συντάκτης που ξαναγράφει τοπικό `includes` θα έμενε
 * **πράσινος**. Το μάθημα είναι του `Ο5` (Β7) και του CHECK 3.68.
 *
 * @see lib/storage/storage-object-url — ο αναγνώστης
 * @see lib/security/path-sanitizer — ο φρουρός SSRF (`validateFetchUrl`)
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { API_ROUTES } from '@/config/domain-constants';

import { storageObjectFromUrl, STORAGE_URL_HOSTS } from '../storage-object-url';

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΣΥΜΠΑΝ
// =============================================================================

const BUCKET = 'pagonis-87766.firebasestorage.app';
const PATH = 'companies/comp_alpha/entities/contact/c_1/domains/admin/categories/photos/files/f_1.jpg';

/** Το URL που παράγει το `getDownloadURL()` — ένα τμήμα, κάθετες percent-encoded. */
const firebaseUrl = (path: string = PATH): string =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=abc-123`;

/**
 * Πηγή αρχείου **χωρίς σχόλια** — αλλιώς η δομική άγκυρα κοκκινίζει πάνω στη
 * **θεραπεία** (το docblock της διόρθωσης ονομάζει το `includes` για να εξηγήσει
 * γιατί δεν το κάνει). Μάθημα `Κ7β` του CHECK 3.50 / 3.68.
 */
function codeOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

/** Οι διαδρομές που σερβίρουν **bytes** από URL — το κλειστό σύνολο του Β8. */
const BYTE_ROUTES: readonly string[] = [
  'src/app/api/download/route.ts',
  'src/app/api/files/batch-download/route.ts',
  'src/app/api/files/classify/route.ts',
];

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Κ0 — οι άγκυρες μετρούν κάτι υπαρκτό', () => {
  it('Κ0.1 — ο αναγνώστης διαβάζει το κανονικό URL (αλλιώς όλα παρακάτω είναι κενά)', () => {
    expect(storageObjectFromUrl(firebaseUrl())).toMatchObject({ outcome: 'object' });
  });

  it('Κ0.2 — και τα τρία αρχεία διαδρομών υπάρχουν και έχουν κώδικα', () => {
    // Χωρίς αυτό, μια μετονομασία αρχείου θα άφηνε την ομάδα `Δ` να ελέγχει
    // **κενή συμβολοσειρά** — πράσινο που σημαίνει «δεν κοίταξα».
    for (const route of BYTE_ROUTES) {
      expect(codeOf(route).length).toBeGreaterThan(200);
    }
  });
});

// =============================================================================
// Σ — ΤΑ ΤΕΣΣΕΡΑ ΣΧΗΜΑΤΑ
// =============================================================================

describe('Σ — κάθε σχήμα που κουβαλούν τα downloadUrl αυτού του έργου', () => {
  it('Σ1 — `firebasestorage` token URL ⇒ path ΑΠΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟ + bucket', () => {
    expect(storageObjectFromUrl(firebaseUrl())).toEqual({
      outcome: 'object',
      storagePath: PATH,
      scheme: 'firebase-download-token',
      bucket: BUCKET,
    });
  });

  it('Σ2 — `storage.googleapis.com/{bucket}/{path}` ⇒ path + bucket', () => {
    expect(storageObjectFromUrl(`https://storage.googleapis.com/${BUCKET}/${PATH}`)).toEqual({
      outcome: 'object',
      storagePath: PATH,
      scheme: 'gcs-public',
      bucket: BUCKET,
    });
  });

  it('Σ3 — `storage.cloud.google.com` ⇒ ίδιο σχήμα, άλλο όνομα', () => {
    expect(storageObjectFromUrl(`https://storage.cloud.google.com/${BUCKET}/${PATH}`)).toMatchObject({
      scheme: 'gcs-console',
      storagePath: PATH,
    });
  });

  it('Σ4 — ο ΔΙΚΟΣ ΜΑΣ same-origin proxy ⇒ path, χωρίς bucket', () => {
    // 🔑 Το πρόθεμα έρχεται από τη **σταθερά**, όχι ωμό: αν μετονομαστεί η
    //    διαδρομή, αυτό εδώ ακολουθεί — και ο αναγνώστης μαζί.
    const encoded = PATH.split('/').map(encodeURIComponent).join('/');

    expect(storageObjectFromUrl(`${API_ROUTES.STORAGE_FILE}/${encoded}`)).toEqual({
      outcome: 'object',
      storagePath: PATH,
      scheme: 'internal-proxy',
      bucket: null,
    });
  });
});

// =============================================================================
// Ξ — 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ BYPASS
// =============================================================================

describe('Ξ — το substring bypass που ΠΕΡΝΟΥΣΕ δύο διαδρομές', () => {
  it('🔑 Ξ1 — `firebasestorage.googleapis.com.<κακόβουλο>.gr` ⇒ unknown-provider', () => {
    // 🔴 Αυτό ακριβώς **περνούσε** το `hostname.includes(domain)` του
    //    `api/download:82` και του `batch-download:153`, μετρημένο 2026-09-16.
    //    ⇒ Μετάλλαξη: γύρνα τον πίνακα host σε αναζήτηση υποσυμβολοσειράς ⇒ ΚΟΚΚΙΝΟ.
    expect(storageObjectFromUrl(`https://firebasestorage.googleapis.com.kakos.gr/v0/b/x/o/y`))
      .toEqual({ outcome: 'unreadable', why: 'unknown-provider' });
  });

  it('🔑 Ξ2 — `evilfirebasestorage.googleapis.com` ⇒ unknown-provider', () => {
    // Το `endsWith(domain)` **χωρίς την τελεία** (η δεύτερη μισή του ελέγχου στο
    // `api/download:83`) περνούσε **αυτό**. Ο πίνακας με κλειδί το πλήρες όνομα
    // δεν μπορεί να το κάνει.
    expect(storageObjectFromUrl(`https://evilfirebasestorage.googleapis.com/v0/b/x/o/y`))
      .toEqual({ outcome: 'unreadable', why: 'unknown-provider' });
  });

  it('Ξ3 — εντελώς ξένος πάροχος ⇒ unknown-provider', () => {
    expect(storageObjectFromUrl('https://example.com/a/b.pdf'))
      .toEqual({ outcome: 'unreadable', why: 'unknown-provider' });
  });

  it('Ξ4 — εσωτερικό δίκτυο (SSRF κλασικό) ⇒ unknown-provider, ποτέ object', () => {
    expect(storageObjectFromUrl('http://169.254.169.254/latest/meta-data/'))
      .toEqual({ outcome: 'unreadable', why: 'unknown-provider' });
  });
});

// =============================================================================
// Α — ΟΙ ΑΠΟΥΣΙΕΣ, ΞΕΧΩΡΙΣΤΑ ΟΝΟΜΑΣΜΕΝΕΣ
// =============================================================================

describe('Α — τρεις αποτυχίες, τρία ονόματα (ποτέ ένα σκέτο null)', () => {
  it('Α1 — κενό ⇒ not-a-url', () => {
    expect(storageObjectFromUrl('   ')).toEqual({ outcome: 'unreadable', why: 'not-a-url' });
  });

  it('Α2 — σωστός πάροχος, ΛΑΘΟΣ μορφή ⇒ malformed-for-scheme (ΟΧΙ unknown-provider)', () => {
    // 🔑 Η διάκριση **δεν είναι στιλιστική**: το `unknown-provider` είναι
    //    **απόπειρα** (κάποιος έδωσε ξένο URL), το `malformed-for-scheme` είναι
    //    **δικό μας σφάλμα** (δικό μας host, μορφή που δεν παράγουμε). Ίδιο log
    //    για τα δύο = τυφλός συναγερμός.
    expect(storageObjectFromUrl('https://firebasestorage.googleapis.com/kati/allo'))
      .toEqual({ outcome: 'unreadable', why: 'malformed-for-scheme' });
  });

  it('Α3 — GCS χωρίς object μετά το bucket ⇒ malformed-for-scheme', () => {
    expect(storageObjectFromUrl(`https://storage.googleapis.com/${BUCKET}/`))
      .toEqual({ outcome: 'unreadable', why: 'malformed-for-scheme' });
  });
});

// =============================================================================
// Δ — 🔴 ΔΟΜΙΚΑ: ΚΑΜΙΑ ΔΙΑΔΡΟΜΗ BYTES ΔΕΝ ΞΑΝΑΓΡΑΦΕΙ ΤΟΝ ΕΛΕΓΧΟ
// =============================================================================

describe('Δ — ο έλεγχος host ζει σε ΕΝΑ σημείο', () => {
  it('🔑 Δ1 — καμία διαδρομή bytes δεν κάνει `hostname.includes(`', () => {
    // 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΦΥΛΑΕΙ ΤΗ ΔΙΟΡΘΩΣΗ.** Συμπεριφορικό test στον αναγνώστη
    //    δεν πιάνει τον επόμενο που θα γράψει τοπικό έλεγχο στη διαδρομή του.
    const offenders = BYTE_ROUTES.filter(route => /hostname\s*\.\s*includes\s*\(/.test(codeOf(route)));

    expect(offenders).toEqual([]);
  });

  it('🔑 Δ2 — καμία διαδρομή bytes δεν δηλώνει δική της λίστα domains', () => {
    // Η λίστα ζει στο `path-sanitizer` (`ALLOWED_FETCH_DOMAINS`) και στον πίνακα
    // host αυτού του module. Τρίτη σε αρχείο διαδρομής = τρίτη αλήθεια.
    const offenders = BYTE_ROUTES.filter(route =>
      /['"`]firebasestorage\.googleapis\.com['"`]/.test(codeOf(route)),
    );

    expect(offenders).toEqual([]);
  });

  it('Δ3 — ο πίνακας host καλύπτει ΚΑΘΕ domain που ο φρουρός SSRF επιτρέπει', () => {
    // ⚠️ Το `ALLOWED_FETCH_DOMAINS` **δεν εξάγεται** (το module είναι `server-only`),
    //    οπότε η διασταύρωση γίνεται στην **πηγή**. Αν ο φρουρός επιτρέψει νέο host
    //    και ο αναγνώστης δεν τον ξέρει, κάθε λήψη από εκεί θα λέει «δεν
    //    αναγνωρίζω» — σιωπηλή βλάβη, όχι ασφάλεια.
    const sanitizer = codeOf('src/lib/security/path-sanitizer.ts');
    const block = /ALLOWED_FETCH_DOMAINS\s*=\s*\[([\s\S]*?)\]/.exec(sanitizer);
    if (block === null) throw new Error('δεν βρέθηκε το ALLOWED_FETCH_DOMAINS — άλλαξε ο φρουρός;');

    const allowed = [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);

    expect(allowed.length).toBeGreaterThan(0);
    for (const host of allowed) {
      expect(Object.hasOwn(STORAGE_URL_HOSTS, host)).toBe(true);
    }
  });
});
