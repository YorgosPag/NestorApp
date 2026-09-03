/**
 * @fileoverview **ΤΟ ΑΝΑΛΛΟΙΩΤΟ ΤΟΥ ΙΔΙΩΤΙΚΟΥ ΚΑΔΟΥ** — η μέτρηση γίνεται πύλη (ADR-841 §7 Α12.8).
 * @related ADR-841 §7 Α12.4 · Α12.8 · storage.rules · ADR-301 (CHECK 3.16)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΤΗΣ Φ2
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Φ2 έλυσε το *«καμία εικόνα δεν φτάνει σε ανώνυμο»* **χωρίς** να αγγίξει το
 * `storage.rules` — τα δημόσια bytes πήγαν σε **δεύτερο κάδο** (Α12.4). Άρα το
 * **CHECK 3.16** *(ZERO TOL on touch)* **δεν ενεργοποιήθηκε**, και αυτό λέγεται ρητά
 * αντί να περάσει στα ψιλά.
 *
 * 🔑 **Η άγκυρα άλλαξε ΕΙΔΟΣ, και έγινε ισχυρότερη.** Μια σουίτα κανόνων θα ρωτούσε
 * *«ο νέος `match` επιτρέπει σωστά;»*. Αυτή ρωτά κάτι που **καμία** σουίτα κανόνων δεν
 * ρωτά ποτέ:
 *
 *   > **Υπάρχει ΚΑΝ δημόσια ανάγνωση στον ιδιωτικό κάδο;**
 *
 * Η απάντηση ήταν **μηδέν σε 673 γραμμές** όταν μετρήθηκε (2026-09-01) — και ήταν
 * **μέτρηση**, δηλαδή κάτι που παλιώνει σιωπηλά. Εδώ γίνεται **εκτελούμενη**: ο
 * επόμενος που θα λύσει «γρήγορα» ένα δημόσιο αρχείο βάζοντας `allow read: if true`
 * **σταματά εδώ**, και διαβάζει γιατί.
 *
 * ⚠️ **ΑΝ ΚΟΚΚΙΝΙΣΕΙ, Η ΑΠΑΝΤΗΣΗ ΔΕΝ ΕΙΝΑΙ ΝΑ ΑΝΕΒΕΙ ΤΟ ΟΡΙΟ.** Είναι να πάνε τα
 * bytes στο **ράφι** (`GCS_PUBLIC_MEDIA_BUCKET`), όπου η δημοσιότητα είναι **μία**
 * δηλωμένη ιδιότητα κάδου αντί για ιδιότητα κάθε `match` ξεχωριστά.
 */

import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLIC_SHELF_CACHE_CONTROL,
  PUBLIC_SHELF_MAX_CACHE_SECONDS,
  buildPublicShelfKey,
  isPublicShelfListingId,
  parsePublicShelfKey,
  publicShelfPrefix,
  publicShelfUrl,
} from '@/services/upload/utils/storage-path-public-shelf';

const STORAGE_RULES = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');

/** Ένα έγκυρο αποτύπωμα — 64 πεζοί δεκαεξαδικοί. */
const HASH = 'a'.repeat(64);

describe('Κ1 — ο ΙΔΙΩΤΙΚΟΣ κάδος δεν αποκτά ΠΟΤΕ δημόσια ανάγνωση', () => {
  it('το storage.rules δεν έχει καμία `allow read: if true`', () => {
    const offenders = STORAGE_RULES.split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /allow\s+read[^:]*:\s*if\s+true\s*;/.test(line));

    expect(offenders).toEqual([]);
  });

  it('καμία `allow read` δεν λείπει συνθήκη — κάθε μία ρωτά κάτι', () => {
    const reads = STORAGE_RULES.split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /^allow\s+[a-z,\s]*read/.test(line));

    // Υπάρχουν αναγνώσεις — αλλιώς το πρώτο τεστ θα περνούσε σε άδειο αρχείο.
    expect(reads.length).toBeGreaterThan(0);

    const unconditional = reads.filter(({ line }) => !/:\s*if\s+/.test(line));
    expect(unconditional).toEqual([]);
  });

  it('η ΜΕΤΡΗΣΗ που στήριξε την Α12 παραμένει αληθινή: το αρχείο είναι μη τετριμμένο', () => {
    // Φρουρός εναντίον του «πράσινο επειδή κανείς δεν κοίταξε»: αν το storage.rules
    // αδειάσει ή μετακινηθεί, τα δύο παραπάνω θα περνούσαν κενά.
    expect(STORAGE_RULES).toContain('service firebase.storage');
    expect(STORAGE_RULES.split('\n').length).toBeGreaterThan(400);
  });
});

describe('Κ2 — το δημόσιο κλειδί δεν κουβαλά ΠΟΤΕ ταυτότητα μισθωτή', () => {
  it('απορρίπτει ταυτότητα εταιρείας ως ταυτότητα αγγελίας', () => {
    expect(isPublicShelfListingId('comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757')).toBe(false);
    expect(() => publicShelfPrefix('comp_abc')).toThrow();
  });

  it('δέχεται τις ΖΩΝΤΑΝΕΣ οικογένειες αναγνωριστικών (μετρημένες στη Φ1)', () => {
    expect(isPublicShelfListingId('prop_0f3c9a11')).toBe(true);
    expect(isPublicShelfListingId('ownp_77aa21bc')).toBe(true);
  });

  it('κανένα παραγόμενο κλειδί δεν περιέχει `comp_`', () => {
    const key = buildPublicShelfKey({ listingId: 'ownp_77aa21bc', contentHash: HASH, ext: 'webp' });
    expect(key).not.toContain('comp_');
    expect(key).toBe(`listings/ownp_77aa21bc/${HASH}.webp`);
  });
});

describe('Κ3 — η διαδρομή δεν δραπετεύει από το πρόθεμα της αγγελίας', () => {
  it.each(['..', '.', '../other', 'a/b', ''])(
    'απορρίπτει την ταυτότητα %p',
    (candidate) => {
      expect(isPublicShelfListingId(candidate)).toBe(false);
    },
  );

  it('το πρόθεμα τελειώνει σε «/» ώστε να μην πιάνει γειτονικές αγγελίες', () => {
    // Χωρίς την κάθετη, ένα getFiles({prefix:'listings/ownp_1'}) θα έπιανε
    // ΚΑΙ το 'listings/ownp_12/...' — δηλαδή διαγραφή σε ξένο ράφι.
    expect(publicShelfPrefix('ownp_1')).toBe('listings/ownp_1/');
    expect('listings/ownp_12/x'.startsWith(publicShelfPrefix('ownp_1'))).toBe(false);
  });
});

describe('Κ4 — ο γραφέας είναι ΑΥΣΤΗΡΟΣ, ο αναγνώστης ΑΝΕΚΤΙΚΟΣ', () => {
  it('ο γραφέας πετά αντί να «καθαρίσει» σιωπηλά', () => {
    expect(() =>
      buildPublicShelfKey({ listingId: 'ownp_1', contentHash: 'κοντό', ext: 'webp' }),
    ).toThrow();
    expect(() =>
      buildPublicShelfKey({ listingId: 'ownp_1', contentHash: HASH.toUpperCase(), ext: 'webp' }),
    ).toThrow();
  });

  it('ο αναγνώστης επιστρέφει null για ό,τι δεν είναι δικό μας — δεν μαντεύει', () => {
    expect(parsePublicShelfKey('listings/ownp_1/not-a-hash.webp')).toBeNull();
    expect(parsePublicShelfKey('other-root/ownp_1/' + HASH + '.webp')).toBeNull();
    expect(parsePublicShelfKey('listings/ownp_1/' + HASH + '.svg')).toBeNull();
    expect(parsePublicShelfKey('listings/ownp_1/deep/' + HASH + '.webp')).toBeNull();
  });

  it('ό,τι γράφει ο γραφέας το διαβάζει ο αναγνώστης — κλειστός κύκλος', () => {
    const key = buildPublicShelfKey({ listingId: 'prop_9', contentHash: HASH, ext: 'webp' });
    expect(parsePublicShelfKey(key)).toEqual({
      listingId: 'prop_9',
      contentHash: HASH,
      ext: 'webp',
    });
  });
});

describe('Κ4β — Η ΔΗΜΟΣΙΑ ΧΟΡΗΓΗΣΗ ΔΙΝΕΙ ΑΝΑΓΝΩΣΗ, ΟΧΙ ΑΠΑΡΙΘΜΗΣΗ', () => {
  // 🔴 **ΜΕΤΡΗΜΕΝΟ ΠΕΡΠΑΤΩΝΤΑΣ (2026-09-01)**: με `roles/storage.objectViewer` το
  //    ανώνυμο `GET https://storage.googleapis.com/<κάδος>` απαντούσε **HTTP 200** —
  //    πλήρες ευρετήριο κάθε δημοσιευμένου αρχείου, χωρίς να αγγίξει την εφαρμογή μας.
  //    Με `legacyObjectReader`: **403**, ενώ το GET με ακριβές URL μένει **200**.
  const PROVISION = readFileSync(
    join(process.cwd(), 'src/services/listings/public-shelf-provision.ts'),
    'utf8',
  );

  it('ο χορηγούμενος ρόλος είναι ο ΜΟΝΟΣ που δίνει get χωρίς list', () => {
    expect(PROVISION).toContain("const PUBLIC_READER_ROLE = 'roles/storage.legacyObjectReader'");
  });

  it('🔴 ο `objectViewer` δηλώνεται ΑΠΑΓΟΡΕΥΜΕΝΟΣ, όχι απλώς αχρησιμοποίητος', () => {
    // ⚠️ Δεν αρκεί «δεν τον χορηγούμε»: μια προηγούμενη εκτέλεση τον είχε ήδη γράψει.
    //    Η προμήθεια οφείλει να τον ΑΦΑΙΡΕΙ, αλλιώς η ένωση των δύο χορηγήσεων νικά.
    const forbidden = /FORBIDDEN_PUBLIC_ROLES[^;]*;/s.exec(PROVISION)?.[0] ?? '';
    expect(forbidden).toContain('roles/storage.objectViewer');
    expect(forbidden).toContain('roles/storage.objectAdmin');
    expect(forbidden).toContain('roles/storage.admin');
  });

  it('η προμήθεια ΣΥΜΦΙΛΙΩΝΕΙ — δεν προσθέτει μόνο', () => {
    expect(PROVISION).toContain('reconcilePublicGrant');
    expect(PROVISION).not.toContain('async function grantPublicRead');
  });
});

describe('Κ5 — ΤΟ ΠΑΡΑΘΥΡΟ ΤΗΣ ΑΠΟΣΥΡΣΗΣ ΕΙΝΑΙ ΦΡΑΓΜΕΝΟ', () => {
  // 🔴 **ΜΕΤΡΗΜΕΝΟ ΠΕΡΠΑΤΩΝΤΑΣ (2026-09-01)**: μετά από απόσυρση με `removed: 1` και
  //    **0 αντικείμενα** στον κάδο, ανώνυμο GET στο ίδιο URL απάντησε **HTTP 200,
  //    Age: 74** — το edge cache. Η τεκμηρίωση της GCS λέει ρητά ότι το built-in cache
  //    έχει **καμία ακύρωση**. Άρα το `max-age` ΕΙΝΑΙ η καθυστέρηση της απόσυρσης.
  const maxAge = Number(/max-age=(\d+)/.exec(PUBLIC_SHELF_CACHE_CONTROL)?.[1]);

  it('δηλώνει max-age, και είναι αριθμός', () => {
    expect(Number.isFinite(maxAge)).toBe(true);
  });

  it('🔴 το max-age ΔΕΝ ξεπερνά το όριο — αλλιώς η απόσυρση αργεί τόσο', () => {
    // ⚠️ ΑΝ ΚΟΚΚΙΝΙΣΕΙ: η απάντηση ΔΕΝ είναι να ανέβει το όριο. Είναι να μπει μπροστά
    //    υποδομή με ΑΚΥΡΩΣΗ (Cloud CDN / δικό μας `media.` hostname). Μέχρι τότε, ό,τι
    //    δηλώνεις εδώ είναι ο χρόνος που μια αποσυρμένη φωτογραφία μένει ορατή.
    expect(maxAge).toBeLessThanOrEqual(PUBLIC_SHELF_MAX_CACHE_SECONDS);
  });

  it('παραμένει δημόσια cache-άριστο — το όφελος δεν θυσιάστηκε', () => {
    expect(PUBLIC_SHELF_CACHE_CONTROL).toContain('public');
    expect(maxAge).toBeGreaterThanOrEqual(60);
  });
});

describe('Κ6 — το δημόσιο URL μιλά στο Cloud Storage, ΟΧΙ στο Firebase', () => {
  it('χρησιμοποιεί storage.googleapis.com — η διαδρομή που ΕΧΕΙ edge cache', () => {
    const url = publicShelfUrl('pagonis-87766-public-media', `listings/prop_1/${HASH}.webp`);
    expect(url).toBe(
      `https://storage.googleapis.com/pagonis-87766-public-media/listings/prop_1/${HASH}.webp`,
    );
  });

  it('ΔΕΝ χρησιμοποιεί firebasestorage.googleapis.com (κρίνεται από storage.rules, χωρίς cache)', () => {
    const url = publicShelfUrl('any-bucket', `listings/prop_1/${HASH}.webp`);
    expect(url).not.toContain('firebasestorage.googleapis.com');
    expect(url).not.toContain('alt=media');
    expect(url).not.toContain('token');
  });
});

describe('🔑 ΤΟ ΟΡΙΟ ΤΗΣ ΒΙΤΡΙΝΑΣ ΕΙΝΑΙ ΤΟΥ ΡΑΦΙΟΥ, ΟΧΙ ΜΙΑΣ ΟΙΚΟΓΕΝΕΙΑΣ (Ο-17)', () => {
  it('το όριο είναι μέσα στο μετρημένο εύρος της έρευνας (22–27)', () => {
    // ⚠️ **Η ΑΓΚΥΡΑ ΜΕΤΑΚΙΝΗΘΗΚΕ ΕΔΩ 2026-09-03, ΔΕΝ ΑΝΤΙΓΡΑΦΗΚΕ.** Ζούσε στη σουίτα
    //    του **ιδιώτη**, όπου ήταν σωστή όσο εκείνος ήταν ο μόνος που δημοσίευε. Μετά
    //    την Α14 δημοσιεύουν **δύο** οικογένειες ⇒ ο φρουρός ενός αριθμού που τον
    //    ζητούν και οι δύο δεν μπορεί να ζει στο σπίτι της μίας.
    //
    // 🔑 Το εύρος είναι **μέτρηση, όχι γούστο**: Zillow **22–27** (πτώση πάνω από 28),
    //    Rightmove **10–20**. Το 24 είναι μέσα στο πρώτο και πάνω από το δεύτερο.
    expect(PUBLISHED_MEDIA_LIMIT).toBeGreaterThanOrEqual(22);
    expect(PUBLISHED_MEDIA_LIMIT).toBeLessThanOrEqual(27);
  });
});
