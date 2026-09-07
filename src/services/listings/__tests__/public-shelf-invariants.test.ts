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
  parsePublicShelfKey,
  publicShelfPrefix,
  publicShelfUrl,
  shelfExtension,
  PUBLIC_SHELF_EXTENSIONS,
} from '@/services/upload/utils/storage-path-public-shelf';
import {
  FRAMING_AS_GIVEN,
  FRAMING_INK_TIGHT,
  LISTING_SHELF,
  PUBLIC_SHELF_KINDS,
  SHOWCASE_SHELF,
  isPublicShelfListingId,
  isPublicShelfShowcaseId,
  isRasterShelfKind,
  shelfRecipe,
  type ModelShelfEncoding,
} from '@/services/upload/utils/public-shelf-kinds';

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
    expect(() => publicShelfPrefix(LISTING_SHELF, 'comp_abc')).toThrow();
  });

  it('δέχεται τις ΖΩΝΤΑΝΕΣ οικογένειες αναγνωριστικών (μετρημένες στη Φ1)', () => {
    expect(isPublicShelfListingId('prop_0f3c9a11')).toBe(true);
    expect(isPublicShelfListingId('ownp_77aa21bc')).toBe(true);
  });

  it('κανένα παραγόμενο κλειδί δεν περιέχει `comp_`', () => {
    const key = buildPublicShelfKey(LISTING_SHELF, {
      subjectId: 'ownp_77aa21bc',
      contentHash: HASH,
      ext: 'webp',
    });
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
    expect(publicShelfPrefix(LISTING_SHELF, 'ownp_1')).toBe('listings/ownp_1/');
    expect(
      'listings/ownp_12/x'.startsWith(publicShelfPrefix(LISTING_SHELF, 'ownp_1')),
    ).toBe(false);
  });

  it('🔑 καμία ρίζα του πίνακα δεν κουβαλά κάθετη — αλλιώς το πρόθεμα σπάει', () => {
    // Φρουρός εναντίον του «η επόμενη γραμμή ξέχασε τη μορφή»: η κάθετη μπαίνει ΜΙΑ
    // φορά, από το `publicShelfPrefix`. Μια ρίζα γραμμένη ως `'showcases/'` θα έδινε
    // πρόθεμα με διπλή κάθετη — δηλαδή getFiles που δεν πιάνει ΤΙΠΟΤΑ, και ράφι που
    // δεν αδειάζει ποτέ.
    for (const kind of PUBLIC_SHELF_KINDS) {
      expect(kind.root).not.toContain('/');
    }
  });
});

describe('Κ4 — ο γραφέας είναι ΑΥΣΤΗΡΟΣ, ο αναγνώστης ΑΝΕΚΤΙΚΟΣ', () => {
  it('ο γραφέας πετά αντί να «καθαρίσει» σιωπηλά', () => {
    expect(() =>
      buildPublicShelfKey(LISTING_SHELF, {
        subjectId: 'ownp_1',
        contentHash: 'κοντό',
        ext: 'webp',
      }),
    ).toThrow();
    expect(() =>
      buildPublicShelfKey(LISTING_SHELF, {
        subjectId: 'ownp_1',
        contentHash: HASH.toUpperCase(),
        ext: 'webp',
      }),
    ).toThrow();
  });

  it('ο αναγνώστης επιστρέφει null για ό,τι δεν είναι δικό μας — δεν μαντεύει', () => {
    expect(parsePublicShelfKey(LISTING_SHELF, 'listings/ownp_1/not-a-hash.webp')).toBeNull();
    expect(parsePublicShelfKey(LISTING_SHELF, 'other-root/ownp_1/' + HASH + '.webp')).toBeNull();
    expect(parsePublicShelfKey(LISTING_SHELF, 'listings/ownp_1/' + HASH + '.svg')).toBeNull();
    expect(parsePublicShelfKey(LISTING_SHELF, 'listings/ownp_1/deep/' + HASH + '.webp')).toBeNull();
  });

  it('ό,τι γράφει ο γραφέας το διαβάζει ο αναγνώστης — κλειστός κύκλος, σε ΚΑΘΕ είδος', () => {
    // 🔑 Ο κύκλος δοκιμάζεται σε ΟΛΟΝ τον πίνακα, όχι μόνο στην πρώτη γραμμή: ένα είδος
    //    που γράφει κλειδί το οποίο ο ΔΙΚΟΣ ΤΟΥ αναγνώστης δεν δέχεται θα ήταν ράφι που
    //    ΔΕΝ ΜΠΟΡΕΙ να αδειάσει — το `deleteExtra` αγγίζει μόνο ό,τι αναγνωρίζει.
    const subjectOf: Record<string, string> = {
      listings: 'prop_9',
      showcases: 'comp_9c7c1a50',
    };

    for (const kind of PUBLIC_SHELF_KINDS) {
      const subjectId = subjectOf[kind.root];
      expect(subjectId).toBeDefined();

      const key = buildPublicShelfKey(kind, { subjectId, contentHash: HASH, ext: 'webp' });

      expect(key).toBe(`${kind.root}/${subjectId}/${HASH}.webp`);
      expect(parsePublicShelfKey(kind, key)).toEqual({ subjectId, contentHash: HASH, ext: 'webp' });
    }
  });
});

describe('🔴 Κ2β — ΟΙ ΔΥΟ ΡΙΖΕΣ ΔΕΝ ΜΠΟΡΟΥΝ ΝΑ ΤΑΪΣΟΥΝ Η ΜΙΑ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΑΛΛΗΣ', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Το Στάδιο 2 (Α21) έδωσε στο ράφι δεύτερο είδος με **αντίστροφο** φρουρό:
  //
  //   listings/  ΑΠΑΓΟΡΕΥΕΙ `comp_` — πρόθεμα μισθωτή σε δημόσιο URL αγγελίας
  //                                   αποκαλύπτει ΠΟΙΟΣ ΚΑΤΕΧΕΙ αυτό το σπίτι
  //   showcases/ ΑΠΑΙΤΕΙ   `comp_` — εκεί η ταυτότητα ΕΙΝΑΙ το περιεχόμενο
  //                                   (`firestore.rules:1079` → `allow read: if true`)
  //
  // ⚠️ Το Κ2 από πάνω φυλάει τη ΜΙΑ πλευρά και **δεν ρωτά ποτέ για τη βιτρίνα**. Χωρίς
  //    αυτό εδώ, λάθος στη δεύτερη γραμμή του πίνακα θα ήταν αόρατο: το Κ2 θα έμενε
  //    πράσινο — «πράσινο επειδή κανείς δεν κοίταξε», στην πιο ακριβή του μορφή.
  // ────────────────────────────────────────────────────────────────────────────

  it('η ρίζα της βιτρίνας ΑΠΑΙΤΕΙ ταυτότητα εταιρείας', () => {
    expect(isPublicShelfShowcaseId('comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757')).toBe(true);
    expect(publicShelfPrefix(SHOWCASE_SHELF, 'comp_abc')).toBe('showcases/comp_abc/');
  });

  it('🔴 η ρίζα της βιτρίνας ΑΠΟΡΡΙΠΤΕΙ τις ζωντανές ταυτότητες αγγελίας', () => {
    expect(isPublicShelfShowcaseId('ownp_77aa21bc')).toBe(false);
    expect(isPublicShelfShowcaseId('prop_0f3c9a11')).toBe(false);
    expect(() => publicShelfPrefix(SHOWCASE_SHELF, 'ownp_77aa21bc')).toThrow();
  });

  it('ο αντίστροφος φρουρός κρατά ΚΑΙ τους κοινούς όρους ασφαλείας', () => {
    // Το `comp_` δεν είναι πάσο: η διαδρομή δεν δραπετεύει ούτε εδώ.
    for (const candidate of ['..', '.', 'comp_a/b', '']) {
      expect(isPublicShelfShowcaseId(candidate)).toBe(false);
    }
  });

  it('🏆 ΚΑΘΕ ταυτότητα γίνεται δεκτή από ΤΟ ΠΟΛΥ ΜΙΑ ρίζα — ποτέ και από τις δύο', () => {
    // Η δομική εγγύηση, δοκιμασμένη ως ΙΔΙΟΤΗΤΑ των φρουρών — όχι ως δύο χωριστά
    // παραδείγματα που αύριο μπορεί να αποκλίνουν.
    for (const candidate of ['comp_abc', 'ownp_1', 'prop_9', 'comp_', 'x', '..']) {
      expect(PUBLIC_SHELF_KINDS.filter((kind) => kind.acceptsSubject(candidate)).length)
        .toBeLessThanOrEqual(1);
    }
  });

  it('ο αναγνώστης της μιας ρίζας ΔΕΝ διαβάζει κλειδί της άλλης', () => {
    const showcaseKey = `showcases/comp_abc/${HASH}.webp`;
    const listingKey = `listings/ownp_1/${HASH}.webp`;

    expect(parsePublicShelfKey(LISTING_SHELF, showcaseKey)).toBeNull();
    expect(parsePublicShelfKey(SHOWCASE_SHELF, listingKey)).toBeNull();
  });

  it('οι ρίζες είναι διακριτές — αλλιώς το πρόθεμα θα έσβηνε ΞΕΝΑ bytes', () => {
    expect(new Set(PUBLIC_SHELF_KINDS.map((kind) => kind.root)).size).toBe(
      PUBLIC_SHELF_KINDS.length,
    );
  });
});

describe('🔑 Κ2γ — ΚΑΘΕ ΕΙΔΟΣ ΕΧΕΙ ΔΙΚΗ ΤΟΥ ΣΥΝΤΑΓΗ, ΚΑΙ ΕΙΝΑΙ ΠΑΡΑΓΟΜΕΝΗ', () => {
  // Η συνταγή ταξιδεύει ως μεταδεδομένο και απαντά «βγήκε από τη ΣΗΜΕΡΙΝΗ ρύθμιση;»
  // ΧΩΡΙΣ να αποκωδικοποιηθεί τίποτα. Δύο είδη με ΙΔΙΑ συνταγή θα σήμαινε ότι τα
  // παράγωγα του ενός περνούν για έγκυρα του άλλου — και επειδή η γρήγορη διαδρομή δεν
  // κατεβάζει bytes, το λάθος θα ήταν ΑΟΡΑΤΟ: σήμα 256px να περνά για γκαλερί 2560px.

  it('οι συνταγές των ειδών είναι διακριτές', () => {
    const recipes = PUBLIC_SHELF_KINDS.map((kind) => shelfRecipe(kind.encoding, FRAMING_AS_GIVEN));

    expect(new Set(recipes).size).toBe(PUBLIC_SHELF_KINDS.length);
  });

  it('η συνταγή αλλάζει όταν αλλάξει ΟΠΟΙΟΔΗΠΟΤΕ σκέλος της κωδικοποίησης', () => {
    const base = LISTING_SHELF.encoding;
    const recipe = (encoding: typeof base) => shelfRecipe(encoding, FRAMING_AS_GIVEN);

    expect(recipe({ ...base, widths: [640] })).not.toBe(recipe(base));
    expect(recipe({ ...base, quality: 83 })).not.toBe(recipe(base));
    expect(recipe({ ...base, quality: 'lossless' })).not.toBe(recipe(base));
    // 🔴 Το `preset` ΑΛΛΑΖΕΙ τα bytes. Αν έλειπε από την υπογραφή, μια αλλαγή του θα
    //    άφηνε τα παλιά παράγωγα δημοσιευμένα ως «σωστά» — σιωπηλά.
    expect(recipe({ ...base, preset: 'icon' })).not.toBe(recipe(base));
  });

  it('🔴 και όταν αλλάξει το ΠΛΑΙΣΙΩΜΑ — τα τριμμένα bytes ΔΕΝ είναι τα ίδια bytes', () => {
    // Α21.10: το τρίμμα αλλάζει τις διαστάσεις του παραγώγου. Αν έλειπε από την
    // υπογραφή, ένα ΑΤΡΙΦΤΟ λογότυπο δημοσιευμένο πριν τη Φάση Β θα περνούσε για
    // τριμμένο και ΔΕΝ θα ξαναπαραγόταν ποτέ — η γρήγορη διαδρομή δεν αποκωδικοποιεί.
    const { encoding } = SHOWCASE_SHELF;

    expect(shelfRecipe(encoding, FRAMING_INK_TIGHT)).not.toBe(
      shelfRecipe(encoding, FRAMING_AS_GIVEN),
    );
  });

  it('🔴 και όταν αλλάξει το ΚΑΤΩΦΛΙ του τριμμένου — άλλο κατώφλι, άλλα όρια, άλλα bytes', () => {
    const { encoding } = SHOWCASE_SHELF;

    expect(shelfRecipe(encoding, { mode: 'ink-tight', threshold: 40 })).not.toBe(
      shelfRecipe(encoding, FRAMING_INK_TIGHT),
    );
  });
});

describe('🏆 Κ2γ′ — ΤΟ `as-given` ΣΙΩΠΑ ΚΑΤΑ ΓΡΑΜΜΑ, ΑΛΛΙΩΣ ΑΚΥΡΩΝΕΤΑΙ ΟΛΟ ΤΟ ΡΑΦΙ', () => {
  // 🔴 Η ΠΙΟ ΑΚΡΙΒΗ ΑΓΚΥΡΑ ΤΗΣ Α21.10, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΚΑΤΑ ΓΡΑΜΜΑ:
    // αυτές οι συμβολοσειρές ζουν **αυτή τη στιγμή** στα μεταδεδομένα κάθε δημοσιευμένου
    // αντικειμένου της παραγωγής. Αν το πλαισίωμα άρχιζε να γράφει σύμβολο και για την
    // προεπιλογή, ΚΑΘΕ φωτογραφία ΚΑΘΕ αγγελίας θα ξανακατέβαινε, θα
    // ξανα-αποκωδικοποιούνταν και θα ξανα-ανέβαινε — χιλιάδες πράξεις για μηδέν διαφορά
    // στα bytes. Ένα `not.toContain('trim')` θα άφηνε αλλαγή μορφής να περάσει· μόνο η
    // κατά γράμμα σύγκριση κλειδώνει τη σιωπή.

  it('η συνταγή της ΑΓΓΕΛΙΑΣ μένει ακριβώς όπως γράφτηκε πριν τη Φάση Β', () => {
    expect(shelfRecipe(LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).toBe(
      'webp:q82:photo:w640-1280-2560',
    );
  });

  it('η συνταγή του ΑΤΡΙΦΤΟΥ σήματος (πορτρέτο) μένει επίσης αμετάβλητη', () => {
    expect(shelfRecipe(SHOWCASE_SHELF.encoding, FRAMING_AS_GIVEN)).toBe(
      'webp:lossless:icon:w64-128-256-512',
    );
  });

  it('🔑 και ΜΟΝΟ το λογότυπο αποκτά σύμβολο — άρα μόνο αυτό ξαναπαράγεται', () => {
    expect(shelfRecipe(SHOWCASE_SHELF.encoding, FRAMING_INK_TIGHT)).toBe(
      'webp:lossless:icon:w64-128-256-512:trim25',
    );
  });
});

describe('🏆 Κ2γ″ — Η ΓΡΑΜΜΗ ΑΠΑΝΤΑ «ΠΩΣ ΠΛΑΙΣΙΩΝΕΤΑΙ ΑΥΤΟ ΤΟ ΥΛΙΚΟ;», ΟΧΙ Η ΜΗΧΑΝΗ', () => {
  it('🔴 το ΛΟΓΟΤΥΠΟ τρίβεται', () => {
    expect(SHOWCASE_SHELF.framingOf({ kind: 'logo' })).toEqual(FRAMING_INK_TIGHT);
  });

  it('🔴 το ΠΟΡΤΡΕΤΟ ΔΕΝ αγγίζεται — το περιθώριό του ΕΙΝΑΙ το κάδρο', () => {
    // Το `preset: 'icon'` είναι ΚΟΙΝΟ και στα δύο (δες Κ2δ). Γι' αυτό δεν μπορούσε ποτέ
    // να είναι αυτό το κριτήριο: θα κούρευε τη selfie του υδραυλικού.
    expect(SHOWCASE_SHELF.framingOf({ kind: 'portrait' })).toEqual(FRAMING_AS_GIVEN);
  });

  it('🔴 καμία ΦΩΤΟΓΡΑΦΙΑ ΑΚΙΝΗΤΟΥ δεν τρίβεται ποτέ, για κανένα υλικό', () => {
    // Ομοιόμορφος ουρανός στην κορυφή έχει ΑΚΡΙΒΩΣ το σχήμα που ο κριτής του
    // περιγράμματος θα έλεγε «χαρτί» — και το σαλόνι θα δημοσιευόταν κουρεμένο.
    expect(LISTING_SHELF.framingOf({ kind: 'photo' })).toEqual(FRAMING_AS_GIVEN);
    expect(LISTING_SHELF.framingOf({ kind: 'floorplan', at: '2026-09-07T00:00:00.000Z' })).toEqual(
      FRAMING_AS_GIVEN,
    );
  });
});

describe('🏆 Κ2δ — Η ΚΛΙΜΑΚΑ ΤΟΥ ΣΗΜΑΤΟΣ ΕΞΥΠΗΡΕΤΕΙ ΤΙΣ ΟΘΟΝΕΣ ΠΟΥ ΥΠΑΡΧΟΥΝ', () => {
  // Το `ShowcaseMarkView` ζωγραφίζει 44px (κάρτα, `h-11`) και 64px (προφίλ, `h-16`).
  // Η κλίμακα [64,128,256] ΔΕΝ είναι στρογγυλεμένη — είναι μετρημένη από αυτά τα δύο.
  const DRAWN_SIZES = [44, 64];
  const DEVICE_PIXEL_RATIOS = [1, 2, 3];

  it('🔴 κανένα ζεύγος (μέγεθος × πυκνότητα) δεν ΥΠΟ-εξυπηρετείται', () => {
    const largest = Math.max(...SHOWCASE_SHELF.encoding.widths);

    for (const size of DRAWN_SIZES) {
      for (const dpr of DEVICE_PIXEL_RATIOS) {
        // Υπάρχει παράγωγο ΤΟΥΛΑΧΙΣΤΟΝ όσο χρειάζεται; Αλλιώς ο περιηγητής μεγεθύνει,
        // δηλαδή θολό σήμα σε οθόνη υψηλής πυκνότητας.
        expect(largest).toBeGreaterThanOrEqual(size * dpr);
        expect(SHOWCASE_SHELF.encoding.widths.some((w) => w >= size * dpr)).toBe(true);
      }
    }
  });

  it('🔑 και δεν ΥΠΕΡ-εξυπηρετεί: το σήμα είναι ασύγκριτα μικρότερο από τη γκαλερί', () => {
    // Το εύρημα που γέννησε ολόκληρο το Στάδιο 2: παράγωγο 2560px για εικόνα 44px.
    //
    // ⚠️ **ΤΟ ΤΑΒΑΝΙ ΑΝΕΒΗΚΕ 256 → 512** *(Α21.9)*, και ο λόγος είναι μετρημένος: ένα
    //    wordmark δεν είναι πια «εικόνα 44px» — απλώνεται ως **240 λογικά px**, δηλαδή
    //    **480** σε διπλή πυκνότητα. Η αναλογία προς τη γκαλερί έπεσε από ×10 σε **×5**,
    //    και η δήλωση της σουίτας ακολουθεί: το σήμα μένει **πολλαπλάσια** μικρότερο,
    //    αλλά όχι πια «ασύγκριτα».
    // 🔴 **Το όριο παραμένει ΟΡΙΟ**: χωρίς αυτή τη γραμμή, μια «ας βάλουμε και 1024»
    //    θα περνούσε αθόρυβα — και το Στάδιο 2 γεννήθηκε ακριβώς από τέτοια σιωπή.
    const markMax = Math.max(...SHOWCASE_SHELF.encoding.widths);
    const listingMax = Math.max(...LISTING_SHELF.encoding.widths);

    expect(markMax).toBe(512);
    expect(listingMax / markMax).toBeGreaterThanOrEqual(5);
  });

  it('τα πλάτη κάθε είδους είναι ΑΥΞΟΝΤΑ — η προβολή διαβάζει το τελευταίο ως κανονικό', () => {
    for (const kind of PUBLIC_SHELF_KINDS) {
      const widths = kind.encoding.widths;
      expect(widths.length).toBeGreaterThan(0);
      expect([...widths].sort((a, b) => a - b)).toEqual([...widths]);
      expect(new Set(widths).size).toBe(widths.length);
    }
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

// ---------------------------------------------------------------------------
// ADR-845 Φ4.0 — ΤΟ ΡΑΦΙ ΜΑΘΑΙΝΕΙ ΟΤΙ ΥΠΑΡΧΟΥΝ ΜΗ-ΕΙΚΟΝΕΣ
// ---------------------------------------------------------------------------

/**
 * 🔑 **Νόμιμη τιμή, ΚΑΝΕΝΑ cast** — και είναι ο λόγος που η ένωση έχει **δύο** μέλη.
 *
 * Μια ένωση **ενός** μέλους θα έκανε τον τύπο εξίσου αυστηρό, αλλά καμία από τις
 * τέσσερις άγκυρες παρακάτω δεν θα μπορούσε να **εκτελεστεί**: δεν θα υπήρχε δεύτερη
 * τιμή να δοθεί χωρίς `as`. Και επειδή ο **N.17** απαγορεύει στον πράκτορα να τρέξει
 * `tsc`, μια εγγύηση **μόνο** σε χρόνο μεταγλώττισης θα ήταν ανεπαλήθευτη — δηλαδή
 * ακριβώς το *«0 = κανείς δεν κοίταξε»* των N.11/N.12.
 */
const MODEL_ENCODING: ModelShelfEncoding = { kind: 'model' };

describe('🏆 Α-1 (ADR-845 §8) — Η ΣΥΝΤΑΓΗ ΔΕΝ ΓΡΑΦΕΙ `webp:` ΓΙΑ ΜΗ-ΕΙΚΟΝΑ', () => {
  // Η συνταγή δεν είναι σχόλιο: γίνεται ΜΕΤΑΔΕΔΟΜΕΝΟ που ταξιδεύει με τα bytes και
  // μέρος της απόφασης «υπάρχει ήδη;». Και το κλειδί είναι content-addressed — άρα μια
  // συνταγή που λέει ψέματα γίνεται ΜΟΝΙΜΗ ΔΙΕΥΘΥΝΣΗ που λέει ψέματα.

  it('πετά αντί να μαντέψει — και το μήνυμα ονομάζει το είδος', () => {
    expect(() => shelfRecipe(MODEL_ENCODING, FRAMING_AS_GIVEN)).toThrow(/model/);
  });

  it('🔴 και ΔΕΝ γράφει `webp:` — η μετάλλαξη που πιάνει την επιστροφή στο άνευ όρων', () => {
    let written: string | null = null;
    try {
      written = shelfRecipe(MODEL_ENCODING, FRAMING_AS_GIVEN);
    } catch {
      written = null;
    }

    expect(written).toBeNull();
  });

  it('οι εικόνες μένουν ΑΝΕΠΑΦΕΣ — ο αυστηρότερος τύπος δεν άλλαξε καμία συνταγή', () => {
    expect(shelfRecipe(LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).toMatch(/^webp:/);
    expect(shelfRecipe(SHOWCASE_SHELF.encoding, FRAMING_INK_TIGHT)).toMatch(/^webp:/);
  });
});

describe('🏆 Α-1β — Η ΜΟΡΦΗ ΔΗΛΩΝΕΤΑΙ ΜΑΖΙ ΜΕ ΤΟΝ ΨΗΣΤΗ, ΠΟΤΕ ΠΡΙΝ', () => {
  // Το `storage-path-public-shelf` γράφει ότι το `glb` λείπει ΕΠΙΤΗΔΕΣ, «μαζί με τον
  // ψήστη που το παράγει», γιατί μορφή χωρίς καθαριστή είναι υπόσχεση χωρίς μηχανισμό
  // — και θα άνοιγε διαδρομή να δημοσιευτεί μοντέλο ΩΜΟ. Ήταν σχόλιο· τώρα εκτελείται.

  it('η μη-εικόνα δεν έχει μορφή — `null`, όχι προεπιλογή', () => {
    expect(shelfExtension(MODEL_ENCODING)).toBeNull();
  });

  it('🔴 το `glb` ΔΕΝ σερβίρεται ακόμη από κανένα ράφι', () => {
    expect(PUBLIC_SHELF_EXTENSIONS).not.toContain('glb');
  });

  it('η εικόνα δίνει `webp` — αμετάβλητο', () => {
    expect(shelfExtension(LISTING_SHELF.encoding)).toBe('webp');
    expect(shelfExtension(SHOWCASE_SHELF.encoding)).toBe('webp');
  });
});

describe('🏆 Α-1γ — Ο ΔΕΣΜΟΣ ΛΕΞΙΛΟΓΙΟΥ ⇄ ΕΙΔΩΝ', () => {
  // Η άγκυρα που κάνει ΔΟΜΙΚΑ ΑΔΥΝΑΤΟ ένα είδος με μορφή που το ράφι δεν σερβίρει —
  // και αντίστροφα. Οι μεγάλοι το γράφουν σε τεκμηρίωση· εδώ κοκκινίζει.

  it('κάθε γραμμή του πίνακα παράγει μορφή που το ράφι ΟΝΤΩΣ σερβίρει', () => {
    for (const kind of PUBLIC_SHELF_KINDS) {
      const ext = shelfExtension(kind.encoding);

      expect(ext).not.toBeNull();
      expect(PUBLIC_SHELF_EXTENSIONS as readonly string[]).toContain(ext);
    }
  });

  it('και κάθε σερβιριζόμενη μορφή έχει είδος που την παράγει — κανένα ορφανό', () => {
    const produced = new Set(PUBLIC_SHELF_KINDS.map((kind) => shelfExtension(kind.encoding)));

    for (const ext of PUBLIC_SHELF_EXTENSIONS) {
      expect(produced).toContain(ext);
    }
  });
});

describe('🏆 Α-1δ — ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΓΡΑΦΕΑ ΞΕΡΕΙ ΤΙ ΕΙΔΟΥΣ BYTES ΚΡΑΤΑ', () => {
  // Ό,τι είναι πίσω από τον φρουρό είναι σχήματος raster από άκρη σε άκρη: η μνήμη
  // κλειδώνεται στο ΠΛΑΤΟΣ και η γρήγορη διαδρομή ρωτά «υπάρχουν ΟΛΑ τα πλάτη;».
  // Ένα μοντέλο δεν έχει αυτή την πληθυντικότητα — τα επίπεδα λεπτομέρειας ζουν ΜΕΣΑ
  // στο αρχείο, γι' αυτό και το ADR-841 §6 λέει «το δημοσιευμένο GLB», στον ενικό.

  it('και τα δύο σημερινά είδη περνούν τον φρουρό', () => {
    for (const kind of PUBLIC_SHELF_KINDS) {
      expect(isRasterShelfKind(kind)).toBe(true);
    }
  });

  it('🔴 ένα είδος μη-εικόνας ΔΕΝ τον περνά — αλλιώς φτάνει σε μηχανή που μετρά πλάτη', () => {
    expect(isRasterShelfKind({ ...LISTING_SHELF, encoding: MODEL_ENCODING })).toBe(false);
  });

  it('ο φρουρός ρωτά την ΚΩΔΙΚΟΠΟΙΗΣΗ, ποτέ τη ρίζα', () => {
    // Ίδια ρίζα με το LISTING_SHELF, άλλο είδος bytes ⇒ πρέπει να απορριφθεί.
    // Ένα κριτήριο τύπου `kind.root === 'listings'` θα το άφηνε να περάσει.
    expect(
      isRasterShelfKind({ ...LISTING_SHELF, encoding: MODEL_ENCODING }).valueOf(),
    ).toBe(false);
  });
});
