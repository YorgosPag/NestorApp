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
  LISTING_MODEL_SHELF,
  LISTING_SHELF,
  PUBLIC_SHELF_KINDS,
  SHOWCASE_SHELF,
  isPublicShelfListingId,
  isPublicShelfShowcaseId,
  isModelShelfKind,
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
    //
    // 🔴 **ΔΙΟΡΘΩΘΗΚΕ ΣΤΗ Φ4.2 (ADR-845): Η ΜΟΡΦΗ ΡΩΤΙΕΤΑΙ, ΔΕΝ ΚΑΡΦΩΝΕΤΑΙ.** Ως τη Φ4.1
    //    αυτός ο βρόχος έγραφε `ext: 'webp'` **κυριολεκτικά** για κάθε γραμμή — αληθές όσο
    //    κάθε γραμμή ήταν εικόνα, και **δομικά λάθος**: η άγκυρα ισχυριζόταν *«ο κύκλος
    //    κλείνει σε κάθε είδος»* ενώ στην πραγματικότητα δοκίμαζε **μία** μορφή σε όλα.
    //    Με τη γραμμή του μοντέλου ο αυστηρός γραφέας **πετά** — και σωστά.
    //    ⇒ Ίδια κλάση με την Α-1δ, βρέθηκε **διαβάζοντας** τη σουίτα και όχι από αποτυχία.
    const subjectOf: Record<string, string> = {
      listings: 'prop_9',
      showcases: 'comp_9c7c1a50',
    };

    for (const kind of PUBLIC_SHELF_KINDS) {
      const subjectId = subjectOf[kind.root];
      expect(subjectId).toBeDefined();

      // ⚠️ Η μορφή έρχεται από την **κωδικοποίηση αυτής της γραμμής**. Ένα `?? 'webp'` εδώ
      //    θα ξαναγεννούσε ακριβώς το σφάλμα που η γραμμή διορθώνει.
      const ext = shelfExtension(kind.encoding);
      // ⚠️ `throw` και όχι `expect(...).not.toBeNull()`: το δεύτερο **δεν στενεύει τον
      //    τύπο**, οπότε η επόμενη γραμμή θα χρειαζόταν `as` — που ο N.2 απαγορεύει.
      if (ext === null) throw new Error(`Η γραμμή ${kind.root} δεν δηλώνει μορφή`);

      const key = buildPublicShelfKey(kind, { subjectId, contentHash: HASH, ext });

      expect(key).toBe(`${kind.root}/${subjectId}/${HASH}.${ext}`);
      expect(parsePublicShelfKey(kind, key)).toEqual({ subjectId, contentHash: HASH, ext });
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
    //
    // 🔴 **ΔΙΟΡΘΩΘΗΚΕ ΣΤΗ Φ4.2 (ADR-845): ΜΕΤΡΑΕΙ ΡΙΖΕΣ, ΟΠΩΣ ΛΕΕΙ Ο ΤΙΤΛΟΣ ΤΟΥ.** Ως τη
    //    Φ4.1 μετρούσε **ΓΡΑΜΜΕΣ** — ταυτόσημο όσο κάθε ρίζα είχε ακριβώς μία γραμμή, και
    //    **δεν είναι** από τη στιγμή που η ρίζα των αγγελιών έχει δύο *(εικόνες, μοντέλα)*.
    //    Ο κίνδυνος που φυλάει ΔΕΝ ήταν ποτέ «δύο γραμμές δέχονται το ίδιο id» — είναι
    //    **«η ταυτότητα του μισθωτή εμφανίζεται σε δημόσια διαδρομή αγγελίας»**, δηλαδή
    //    ερώτηση για **ρίζες**. Η υλοποίηση είχε αποκλίνει από τον δικό της τίτλο.
    for (const candidate of ['comp_abc', 'ownp_1', 'prop_9', 'comp_', 'x', '..']) {
      const roots = new Set(
        PUBLIC_SHELF_KINDS.filter((kind) => kind.acceptsSubject(candidate)).map((kind) => kind.root),
      );

      expect(roots.size).toBeLessThanOrEqual(1);
    }
  });

  it('ο αναγνώστης της μιας ρίζας ΔΕΝ διαβάζει κλειδί της άλλης', () => {
    const showcaseKey = `showcases/comp_abc/${HASH}.webp`;
    const listingKey = `listings/ownp_1/${HASH}.webp`;

    expect(parsePublicShelfKey(LISTING_SHELF, showcaseKey)).toBeNull();
    expect(parsePublicShelfKey(SHOWCASE_SHELF, listingKey)).toBeNull();
  });

  it('🔴 καμία γραμμή δεν μπορεί να διεκδικήσει ΤΟ ΙΔΙΟ ΚΛΕΙΔΙ με άλλη', () => {
    // 🔴 **ΔΙΟΡΘΩΘΗΚΕ ΣΤΗ Φ4.2 (ADR-845), ΚΑΙ ΕΙΝΑΙ Η ΠΙΟ ΛΕΠΤΗ ΑΛΛΑΓΗ ΤΗΣ ΦΑΣΗΣ.**
    //
    // Ως τη Φ4.1 έλεγε *«οι ρίζες είναι διακριτές»* — και ήταν **σωστός μεσολαβητής** όσο
    // κάθε ρίζα είχε μία γραμμή. Από τη Φ4.2 το `LISTING_SHELF` και το `LISTING_MODEL_SHELF`
    // μοιράζονται ρίζα **επίτηδες**: είναι το υλικό της ΙΔΙΑΣ αγγελίας, και μια τέταρτη ρίζα
    // θα ήταν δεύτερη θέση με δικό της κύκλο ζωής και δική της απόσυρση.
    //
    // ⚠️ **Ο ΚΙΝΔΥΝΟΣ ΟΜΩΣ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΟΣ ΚΑΙ ΔΕΝ ΕΞΑΦΑΝΙΖΕΤΑΙ**: ο γραφέας σαρώνει
    //    πρόθεμα και **σβήνει ό,τι περισσεύει**. Άρα η ερώτηση δεν ήταν ποτέ *«ίδια ρίζα;»* —
    //    ήταν **«μπορούν δύο γραμμές να γράψουν το ΙΔΙΟ κλειδί;»**. Το κλειδί είναι
    //    `<ρίζα>/<ταυτότητα>/<hash>.<μορφή>`, οπότε το ζεύγος που πρέπει να είναι διακριτό
    //    είναι **(ρίζα, μορφή)**. Δύο γραμμές με ίδια ρίζα ΚΑΙ ίδια μορφή θα έσβηναν η μία
    //    τα bytes της άλλης — σιωπηλά, και μόνιμα.
    //
    // 🔑 Η **εκτέλεση** αυτής της εγγύησης πάνω σε πραγματικά κλειδιά ζει στην **Α-1ε**.
    const claims = PUBLIC_SHELF_KINDS.map((kind) => `${kind.root}::${shelfExtension(kind.encoding)}`);

    expect(new Set(claims).size).toBe(PUBLIC_SHELF_KINDS.length);
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

  it('τα πλάτη κάθε είδους ΕΙΚΟΝΑΣ είναι ΑΥΞΟΝΤΑ — η προβολή διαβάζει το τελευταίο ως κανονικό', () => {
    // 🔴 **ΔΙΑΜΕΡΙΣΗ ΑΠΟ ΤΗ Φ4.2 (ADR-845)**: τα «πλάτη» είναι ιδιότητα της **εικόνας**.
    //    Ως τη Φ4.1 ο βρόχος διέτρεχε ολόκληρο τον πίνακα και διάβαζε `kind.encoding.widths`
    //    άνευ όρων — με τη γραμμή του μοντέλου αυτό είναι `undefined.length`, δηλαδή
    //    κατάρρευση με μήνυμα που **δεν ονομάζει την αιτία**.
    // ⚠️ Το φίλτρο **δεν αδυνατίζει** την άγκυρα: το πλήθος ελέγχεται από κάτω, αλλιώς ένα
    //    κενό φίλτρο θα την έκανε μονίμως πράσινη χωρίς να ρωτά τίποτα.
    const rasterKinds = PUBLIC_SHELF_KINDS.filter(isRasterShelfKind);
    expect(rasterKinds.length).toBeGreaterThanOrEqual(2);

    for (const kind of rasterKinds) {
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
const MODEL_ENCODING: ModelShelfEncoding = {
  kind: 'model',
  meshopt: 'high',
  quantise: { position: 14, normal: 10, texcoord: 12 },
};

describe('🏆 Α-1 (ADR-845 §8) — Η ΣΥΝΤΑΓΗ ΔΕΝ ΓΡΑΦΕΙ `webp:` ΓΙΑ ΜΗ-ΕΙΚΟΝΑ', () => {
  // Η συνταγή δεν είναι σχόλιο: γίνεται ΜΕΤΑΔΕΔΟΜΕΝΟ που ταξιδεύει με τα bytes και
  // μέρος της απόφασης «υπάρχει ήδη;». Και το κλειδί είναι content-addressed — άρα μια
  // συνταγή που λέει ψέματα γίνεται ΜΟΝΙΜΗ ΔΙΕΥΘΥΝΣΗ που λέει ψέματα.

  // ⚠️ **Η ΕΡΩΤΗΣΗ ΕΙΝΑΙ Η ΙΔΙΑ, Η ΑΠΑΝΤΗΣΗ ΑΛΛΑΞΕ ΣΤΗ Φ4.2 — ΚΑΙ ΕΙΝΑΙ ΤΟ ΖΗΤΟΥΜΕΝΟ.**
  //    Ως τη Φ4.1 η συνταγή του μοντέλου **πετούσε** *(«no baker produces it yet»)*, και η
  //    άγκυρα το κλείδωνε. Τώρα υπάρχει ψήστης, άρα το `throw` θα ήταν το ψέμα. Ο φρουρός
  //    δεν χαλαρώνει: μετακινείται από *«δεν γράφει τίποτα»* σε *«γράφει ΤΗ ΔΙΚΗ ΤΟΥ μορφή,
  //    και ΠΟΤΕ `webp:`»* — που είναι το πράγμα που πάντα προστάτευε.

  it('🔴 ΔΕΝ γράφει `webp:` για μη-εικόνα — η μετάλλαξη που πιάνει την επιστροφή στο άνευ όρων', () => {
    expect(shelfRecipe(MODEL_ENCODING)).not.toMatch(/webp/);
  });

  it('γράφει τη ΔΙΚΗ του μορφή, και ονομάζει το είδος', () => {
    expect(shelfRecipe(MODEL_ENCODING)).toMatch(/^glb:/);
  });

  it('🔴 η συνταγή του μοντέλου κουβαλά ΚΑΘΕ παράμετρο που αλλάζει τα bytes', () => {
    // Η συνταγή είναι content-addressed μεταδεδομένο: παράμετρος που αλλάζει bytes και
    // ΔΕΝ φαίνεται εδώ σημαίνει ότι δύο διαφορετικά αρχεία μοιράζονται ταυτότητα, και η
    // γρήγορη διαδρομή (που δεν αποκωδικοποιεί ΤΙΠΟΤΑ) θα σερβίριζε το λάθος για πάντα.
    const base = MODEL_ENCODING;

    expect(shelfRecipe({ ...base, meshopt: 'medium' })).not.toBe(shelfRecipe(base));
    expect(shelfRecipe({ ...base, quantise: { ...base.quantise, position: 12 } })).not.toBe(
      shelfRecipe(base),
    );
    expect(shelfRecipe({ ...base, quantise: { ...base.quantise, normal: 8 } })).not.toBe(
      shelfRecipe(base),
    );
    expect(shelfRecipe({ ...base, quantise: { ...base.quantise, texcoord: 10 } })).not.toBe(
      shelfRecipe(base),
    );
  });

  it('οι εικόνες μένουν ΑΝΕΠΑΦΕΣ — ο αυστηρότερος τύπος δεν άλλαξε καμία συνταγή', () => {
    expect(shelfRecipe(LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).toMatch(/^webp:/);
    expect(shelfRecipe(SHOWCASE_SHELF.encoding, FRAMING_INK_TIGHT)).toMatch(/^webp:/);
  });

  it('🔴 και το ΠΛΑΙΣΙΩΜΑ δεν ταξιδεύει ΠΟΤΕ σε συνταγή μοντέλου', () => {
    // Ένα μοντέλο δεν έχει «περιθώριο εικόνας». Μια συνταγή που έγραφε `:trim25` για GLB
    // θα δήλωνε πράξη που ΔΕΝ ΕΚΤΕΛΕΙΤΑΙ ΠΟΤΕ — δηλαδή μεταδεδομένο που λέει ψέματα, και
    // επειδή είναι content-addressed, ψέμα με μόνιμη διεύθυνση.
    expect(shelfRecipe(MODEL_ENCODING)).not.toMatch(/trim/);
  });
});

describe('🏆 Α-1β — Η ΜΟΡΦΗ ΔΗΛΩΝΕΤΑΙ ΜΑΖΙ ΜΕ ΤΟΝ ΨΗΣΤΗ, ΠΟΤΕ ΠΡΙΝ', () => {
  // Το `storage-path-public-shelf` γράφει ότι το `glb` λείπει ΕΠΙΤΗΔΕΣ, «μαζί με τον
  // ψήστη που το παράγει», γιατί μορφή χωρίς καθαριστή είναι υπόσχεση χωρίς μηχανισμό
  // — και θα άνοιγε διαδρομή να δημοσιευτεί μοντέλο ΩΜΟ. Ήταν σχόλιο· τώρα εκτελείται.

  // ⚠️ **Η Φ4.2 ΕΦΕΡΕ ΤΟΝ ΨΗΣΤΗ, ΑΡΑ ΕΦΕΡΕ ΤΗ ΜΟΡΦΗ — ΜΑΖΙ, ΠΟΤΕ Η ΜΙΑ ΠΡΙΝ ΤΟΝ ΑΛΛΟΝ.**
  //    Ως τη Φ4.1 και τα δύο πρώτα test ρωτούσαν *«λείπει ακόμη;»* και η απάντηση ήταν ναι.
  //    Η ερώτηση που **προστάτευαν** δεν ήταν ποτέ *«λείπει;»* — ήταν *«υπάρχει μορφή που
  //    κανείς δεν ψήνει;»*. Αυτή ζει τώρα ολόκληρη στην **Α-1γ**, εκτελούμενη και προς τις
  //    δύο κατευθύνσεις.

  it('η μορφή του μοντέλου είναι `glb` — ΔΗΛΩΜΕΝΗ, ποτέ μαντεμένη', () => {
    expect(shelfExtension(MODEL_ENCODING)).toBe('glb');
  });

  it('🔴 το `glb` σερβίρεται πλέον, ΚΑΙ ΜΟΝΟ ΕΠΕΙΔΗ ΥΠΑΡΧΕΙ ΨΗΣΤΗΣ', () => {
    expect(PUBLIC_SHELF_EXTENSIONS).toContain('glb');
  });

  it('🔴 και το σύνολο μένει ΚΛΕΙΣΤΟ — καμία μορφή δεν μπήκε λαθραία μαζί του', () => {
    // Το ράφι σερβίρει σε ΑΝΩΝΥΜΟ. Κάθε μορφή είναι απόφαση με συνέπειες — π.χ. SVG ΠΟΤΕ,
    // γιατί εκτελεί script στον περιηγητή του επισκέπτη. Χωρίς αυτή τη γραμμή, η προσθήκη
    // του `glb` θα ήταν η στιγμή που «το σύνολο μεγαλώνει» παύει να προσέχεται.
    expect([...PUBLIC_SHELF_EXTENSIONS].sort()).toEqual(['glb', 'webp']);
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
  // στο αρχείο (`MSFT_lod`), δηλαδή «ένα μοντέλο = ΕΝΑ ΑΡΧΕΙΟ».
  // ⚠️ ΔΙΟΡΘΩΘΗΚΕ 2026-09-08 (ADR-845 Φ4.1): εδώ έγραφε «το ADR-841 §6 λέει «το δημοσιευμένο
  //    GLB», στον ενικό». Η φράση ΔΕΝ ΥΠΑΡΧΕΙ στο ADR-841 (μετρημένο, 7.120 γρ.) — και το
  //    «ένα ΑΡΧΕΙΟ ανά μοντέλο» δεν συνεπάγεται «ένα ΜΟΝΤΕΛΟ ανά αγγελία»: η Α11 δημοσιεύει
  //    ΚΑΙ `as-built` ΚΑΙ `proposal`, γι' αυτό το δημόσιο σχήμα κρατά πίνακα `models[]`.

  // 🔴 **ΑΠΟ ΤΗ Φ4.2 Ο ΠΙΝΑΚΑΣ ΔΕΝ ΕΙΝΑΙ ΟΜΟΙΟΓΕΝΗΣ, ΚΑΙ Η ΑΓΚΥΡΑ ΕΓΙΝΕ ΔΙΑΜΕΡΙΣΗ.**
  //    Ως τη Φ4.1 έλεγε *«ΚΑΘΕ γραμμή περνά τον φρουρό του raster»* — αληθές όσο κάθε
  //    γραμμή ήταν εικόνα, και **σιωπηλά ψευδές** την ημέρα που θα έμπαινε η πρώτη που δεν
  //    είναι. Είναι **ακριβώς** η κλάση που μέτρησε η Φ4.1: *«ισχυρισμός πάνω σε λεξιλόγιο
  //    που μεγαλώνει γίνεται σιωπηλά ψευδής κάθε φορά που προστίθεται τιμή»*.
  //    ⇒ Η ερώτηση που **αξίζει** δεν ήταν ποτέ «είναι όλες raster;» αλλά **«ξέρει κάθε
  //    γραμμή ΤΙ ΕΙΝΑΙ, και ξέρει ΑΚΡΙΒΩΣ ΕΝΑ πράγμα;»**.

  it('🔴 κάθε γραμμή είναι raster **Ή** μοντέλο — ποτέ και τα δύο, ποτέ κανένα', () => {
    for (const kind of PUBLIC_SHELF_KINDS) {
      const raster = isRasterShelfKind(kind);
      const model = isModelShelfKind(kind);

      // Αποκλειστική διάζευξη: μια γραμμή που απαντούσε «ναι» και στους δύο φρουρούς θα
      // έφτανε ΚΑΙ στη μηχανή που μετρά πλάτη ΚΑΙ σε εκείνη που ψήνει γεωμετρία· μια που
      // απαντούσε «όχι» και στους δύο θα ΔΙΑΦΗΜΙΖΟΤΑΝ στο ράφι χωρίς κανέναν να την ψήνει.
      expect(raster !== model).toBe(true);
    }
  });

  it('🔴 και ο πίνακας περιέχει ΚΑΙ ΤΑ ΔΥΟ είδη — αλλιώς η διαμέριση είναι κενή υπόσχεση', () => {
    // Χωρίς αυτό, το test από πάνω θα έμενε πράσινο σε πίνακα που έχασε τη γραμμή του
    // μοντέλου — «πράσινο επειδή κανείς δεν κοίταξε», στην ακριβή του μορφή.
    expect(PUBLIC_SHELF_KINDS.some((kind) => isRasterShelfKind(kind))).toBe(true);
    expect(PUBLIC_SHELF_KINDS.some((kind) => isModelShelfKind(kind))).toBe(true);
  });

  it('🔴 οι δύο φρουροί ρωτούν την ΚΩΔΙΚΟΠΟΙΗΣΗ, ποτέ τη ρίζα — και το αποδεικνύει η ΙΔΙΑ ρίζα', () => {
    // Το `LISTING_MODEL_SHELF` μοιράζεται ρίζα ΚΑΙ φρουρό ταυτότητας με το `LISTING_SHELF`.
    // Ένα κριτήριο τύπου `kind.root === 'listings'` θα τα έλεγε ΚΑΙ ΤΑ ΔΥΟ raster.
    expect(LISTING_MODEL_SHELF.root).toBe(LISTING_SHELF.root);
    expect(isRasterShelfKind(LISTING_MODEL_SHELF)).toBe(false);
    expect(isModelShelfKind(LISTING_MODEL_SHELF)).toBe(true);
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

// ---------------------------------------------------------------------------
// ADR-845 Φ4.2 — ΤΟ ΡΑΦΙ ΑΠΟΚΤΑ ΨΗΣΤΗ, ΚΑΙ ΔΥΟ ΕΙΔΗ ΜΟΙΡΑΖΟΝΤΑΙ ΠΡΟΘΕΜΑ
// ---------------------------------------------------------------------------

describe('🏆 Α-1ε — ΟΙ ΔΥΟ ΓΡΑΜΜΕΣ ΤΗΣ ΙΔΙΑΣ ΑΓΓΕΛΙΑΣ ΔΕΝ ΤΡΩΝΕ Η ΜΙΑ ΤΑ BYTES ΤΗΣ ΑΛΛΗΣ', () => {
  // 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΑΓΚΥΡΑ, ΚΑΙ ΓΙΑΤΙ ΤΩΡΑ:
  //
  // Από τη Φ4.2 το `LISTING_SHELF` (εικόνες) και το `LISTING_MODEL_SHELF` (μοντέλα)
  // μοιράζονται ΡΙΖΑ και ΤΑΥΤΟΤΗΤΑ ΥΠΟΚΕΙΜΕΝΟΥ, άρα και ΠΡΟΘΕΜΑ: `listings/<id>/`.
  // Ο γραφέας σαρώνει το πρόθεμα και ΣΒΗΝΕΙ ό,τι περισσεύει (`deleteExtra`) — οπότε η
  // συμφιλίωση των φωτογραφιών θα μπορούσε, θεωρητικά, να σβήσει το δημοσιευμένο `.glb`.
  //
  // ✅ Δεν μπορεί, και η εγγύηση είναι ΔΟΜΙΚΗ: το `deleteExtra` αγγίζει μόνο κλειδιά που
  //    αναγνωρίζει το `parsePublicShelfKey(kind, …)`, κι εκείνο απαντά `null` όταν η
  //    κατάληξη δεν είναι εκείνη ΑΥΤΟΥ του είδους.
  //
  // ⚠️ ΩΣ ΕΔΩ ΑΥΤΟ ΗΤΑΝ **ΣΧΟΛΙΟ**. Η Φ4.1 μέτρησε δύο ισχυρισμούς γραμμένους σε σχόλια
  //    που ήταν ψευδείς επί μήνες, και ο ένας είχε περάσει αυτούσιος μέσα σε ADR ως
  //    τεκμηριωμένο γεγονός. Ένας ισχυρισμός που ΚΡΑΤΑ ΔΗΜΟΣΙΕΥΜΕΝΑ BYTES ΖΩΝΤΑΝΑ δεν
  //    επιτρέπεται να ζει σε σχόλιο.

  const LISTING_ID = 'prop_coexist_1';

  // ⚠️ **ΣΥΝΑΡΤΗΣΕΙΣ ΚΑΙ ΟΧΙ ΣΤΑΘΕΡΕΣ ΤΟΥ `describe`, ΚΑΙ ΤΟ ΕΔΕΙΞΕ ΜΕΤΑΛΛΑΞΗ.** Το σώμα
  //    ενός `describe` τρέχει στη **συλλογή**: μια εξαίρεση εκεί ρίχνει **ΟΛΟΚΛΗΡΟ** το
  //    αρχείο με `Tests: 0 total` — δηλαδή 65 άγκυρες σιωπούν και το μήνυμα δεν ονομάζει
  //    καμία. Μετρημένο 2026-09-08: η μετάλλαξη «η μορφή του μοντέλου γίνεται `webp`»
  //    έδωσε ακριβώς αυτό. Μια άγκυρα που **σκοτώνει τις γειτόνισσές της** όταν πέφτει
  //    δεν είναι άγκυρα — είναι μοχλός.
  const photoKey = (): string =>
    buildPublicShelfKey(LISTING_SHELF, { subjectId: LISTING_ID, contentHash: HASH, ext: 'webp' });
  const modelKey = (): string =>
    buildPublicShelfKey(LISTING_MODEL_SHELF, {
      subjectId: LISTING_ID,
      contentHash: HASH,
      ext: 'glb',
    });

  it('🔴 τα δύο είδη γράφουν στο ΙΔΙΟ πρόθεμα — αλλιώς η άγκυρα δεν ρωτά τίποτα', () => {
    expect(publicShelfPrefix(LISTING_MODEL_SHELF, LISTING_ID)).toBe(
      publicShelfPrefix(LISTING_SHELF, LISTING_ID),
    );
    expect(photoKey()).not.toBe(modelKey());
  });

  it('🔴 η συμφιλίωση των ΕΙΚΟΝΩΝ δεν αναγνωρίζει το κλειδί του μοντέλου ⇒ δεν το σβήνει', () => {
    expect(parsePublicShelfKey(LISTING_SHELF, modelKey())).toBeNull();
  });

  it('🔴 και η συμφιλίωση των ΜΟΝΤΕΛΩΝ δεν αναγνωρίζει το κλειδί της φωτογραφίας', () => {
    expect(parsePublicShelfKey(LISTING_MODEL_SHELF, photoKey())).toBeNull();
  });

  it('καθένα αναγνωρίζει ΤΟ ΔΙΚΟ του — αλλιώς τα δύο από πάνω περνούν για λάθος λόγο', () => {
    // Χωρίς αυτό, ένα `parsePublicShelfKey` που γύριζε ΠΑΝΤΑ `null` θα έκανε τα δύο
    // προηγούμενα πράσινα ενώ ο γραφέας δεν θα καθάριζε ΤΙΠΟΤΑ, ποτέ.
    expect(parsePublicShelfKey(LISTING_SHELF, photoKey())).not.toBeNull();
    expect(parsePublicShelfKey(LISTING_MODEL_SHELF, modelKey())).not.toBeNull();
  });

  it('🔴 ο ΑΥΣΤΗΡΟΣ γραφέας πετά αν του ζητηθεί λάθος μορφή για το είδος του', () => {
    // Ο ανεκτικός αναγνώστης λέει `null`· ο γραφέας ΠΕΤΑ. Δύο συμβόλαια, μία ερώτηση.
    expect(() =>
      buildPublicShelfKey(LISTING_MODEL_SHELF, {
        subjectId: LISTING_ID,
        contentHash: HASH,
        ext: 'webp',
      }),
    ).toThrow();
    expect(() =>
      buildPublicShelfKey(LISTING_SHELF, { subjectId: LISTING_ID, contentHash: HASH, ext: 'glb' }),
    ).toThrow();
  });
});
