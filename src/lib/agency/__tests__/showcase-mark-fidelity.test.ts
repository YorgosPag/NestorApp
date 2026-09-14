/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ, ΤΩΝ ΕΠΙΦΑΝΕΙΩΝ ΚΑΙ ΤΟΥ ΠΛΑΙΣΙΟΥ**
 *   (ADR-841 §7 Α21, Φάση 2 · Α21.13).
 * @related lib/agency/showcase-mark-fidelity · lib/agency/showcase-mark-surfaces ·
 *   components/mandate/showcase-mark-frame · components/mandate/showcase-mark-box
 * @module lib/agency/__tests__/showcase-mark-fidelity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΩΜΟ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η υπόσχεση του κριτή είναι ότι τα κατώφλια **παράγονται**: η άρνηση από την κλίμακα του
 * ραφιού, η προειδοποίηση από τα **κουτιά που ζωγραφίζει η οθόνη**. Μια άγκυρα που έγραφε
 * `expect(MARK_MIN_EDGE).toBe(64)` θα επαλήθευε **αντιγραφή** — και θα κοκκίνιζε την ημέρα
 * που η κλίμακα αλλάξει **νόμιμα**, δηλαδή θα δίδασκε τον επόμενο να «διορθώσει το test»
 * αντί να σκεφτεί.
 *
 * ⇒ Οι ισχυρισμοί ρωτούν τη **σχέση** με την πηγή, ποτέ την τιμή. Οι μόνες εξαιρέσεις
 * είναι το **Κ0** και το **Ε**, που κρίνουν **ακριβώς** αυτές τις σχέσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ Η ΟΜΑΔΑ **Ε** ΔΕΝ ΕΙΝΑΙ ΥΠΟΘΕΤΙΚΗ — Η ΠΡΟΗΓΟΥΜΕΝΗ ΤΗΣ ΜΟΡΦΗ ΑΦΗΣΕ ΨΕΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως την **Α21.13** η ίδια ομάδα έλεγχε *«τα ΥΨΗ που ζωγραφίζει η οθόνη ΕΙΝΑΙ αυτά που
 * κρίνει ο κριτής»* — αλλά **μόνο για τα τετράγωνα κουτιά**, και το έγραφε ρητά. Δηλαδή η
 * **ζώνη 64×240** που πρόσθεσε η Α21.9 έμεινε **έξω από κάθε άγκυρα**, ο κριτής δεν την
 * έμαθε ποτέ, και έκρινε κάθε wordmark με το κουτί του πορτρέτου. **Πράσινο που σήμαινε
 * «δεν κοίταξα εκεί».**
 *
 * ⇒ Η νέα μορφή **δεν εξαιρεί σχήμα**: διαβάζει **και τις τρεις** γραμμές κλάσεων και
 * απαιτεί οι επιφάνειες να τις **αναπαράγουν**.
 */

import fs from 'node:fs';
import path from 'node:path';

import { SHOWCASE_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import { SHOWCASE_MARK_KINDS, type ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import { judgeShowcaseMark, markReach, MARK_MIN_EDGE } from '../showcase-mark-fidelity';
import {
  MARK_BAND_ASPECT_THRESHOLD,
  MARK_GUARANTEED_DENSITY,
  markFill,
  markSurfaces,
  marksBand,
} from '../showcase-mark-surfaces';
import {
  CIRCULAR_MASK_COVERAGE,
  SHOWCASE_MARK_FRAME,
  frameOf,
  maskCrops,
} from '@/components/mandate/showcase-mark-frame';

const square = (edge: number) => ({ width: edge, height: edge });

/** Το προεπιλεγμένο είδος των αγκυρών: το λογότυπο, γιατί **μόνο αυτό** αλλάζει σχήμα. */
const judge = (dimensions: { width: number; height: number }, kind: ShowcaseMarkKind = 'logo') =>
  judgeShowcaseMark(dimensions, kind);

/** Ένα **οριζόντιο** λογότυπο δοσμένης αναλογίας, με το ύψος ως παράμετρο. */
const wordmark = (aspect: number, height: number) => ({
  width: Math.round(height * aspect),
  height,
});

const surfaceOf = (subject: { kind: ShowcaseMarkKind; width: number; height: number }, name: string) => {
  const found = markSurfaces(subject).find((surface) => surface.name === name);
  if (found === undefined) throw new Error(`Δεν υπάρχει επιφάνεια «${name}»`);
  return found;
};

// ===========================================================================

describe('🔴 Κ0 — ΤΑ ΚΑΤΩΦΛΙΑ ΠΑΡΑΓΟΝΤΑΙ ΑΠΟ ΤΙΣ ΠΗΓΕΣ ΤΟΥΣ, ΔΕΝ ΑΝΤΙΓΡΑΦΟΝΤΑΙ', () => {
  it('το ελάχιστο ΕΙΝΑΙ η μικρότερη βαθμίδα — κάτω από εκεί δεν υπάρχει τι να παραχθεί', () => {
    const widths = [...SHOWCASE_SHELF.encoding.widths].sort((a, b) => a - b);

    expect(MARK_MIN_EDGE).toBe(widths[0]);
  });

  it('🔴 η ΑΠΑΙΤΗΣΗ δεν είναι πια σταθερά — ΠΑΡΑΓΕΤΑΙ ανά εικόνα, από το κουτί της', () => {
    // 🔴 **ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΩΔΙΚΟΠΟΙΟΥΣΕ ΤΟ ΠΑΛΙΟ `MARK_IDEAL_EDGE = 192`** *(Α21.13)*: ήταν
    //    *«η μεγαλύτερη ακμή που ζωγραφίζει οποιαδήποτε επιφάνεια, σε 2×»*, δηλαδή η
    //    απάντηση για **τετράγωνο** κουτί. Ένα wordmark μπαίνει σε **ζώνη 240×64** και
    //    χρειάζεται **128** — το σταθερό νούμερο του ζητούσε **50% παραπάνω**.
    //
    // 🔑 Η άγκυρα δεν γράφει το 192: το **ζητά από τις επιφάνειες**, όπως ο κριτής.
    const page = surfaceOf({ kind: 'portrait', ...square(10) }, 'page');
    const portrait = markReach(square(1), 'portrait');

    expect(portrait.needed).toBe(page.height * MARK_GUARANTEED_DENSITY);
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: ξαναδέσε την απαίτηση σε σταθερά ⇒ οι δύο γραμμές αποκλίνουν.
    expect(markReach(wordmark(4, 1), 'logo').needed).toBeLessThan(portrait.needed);
  });

  it('🔴 ΔΕΝ αναδιατάσσει την κλίμακα του γραφέα ενώ τη διαβάζει', () => {
    // ⚠️ Το `sort` μεταλλάσσει **επί τόπου**. Ένα `SHOWCASE_SHELF.encoding.widths.sort()`
    //    μέσα στο module θα άλλαζε σιωπηλά τη διαμόρφωση που παράγει τα bytes — και τα
    //    `widths` είναι `readonly` **μόνο για τον μεταγλωττιστή**.
    expect([...SHOWCASE_SHELF.encoding.widths]).toEqual([64, 128, 256, 512]);
  });
});

describe('🔴 Κ1 — Η ΑΡΝΗΣΗ: κάτω από τη μικρότερη βαθμίδα δεν υπάρχει τι να παραχθεί', () => {
  it('απορρίπτει εικόνα κάτω από το ελάχιστο, και ΛΕΕΙ και τα δύο νούμερα', () => {
    const verdict = judge(square(MARK_MIN_EDGE - 1));

    expect(verdict.outcome).toBe('tooSmall');
    if (verdict.outcome !== 'tooSmall') return;
    expect(verdict.reach.shortest).toBe(MARK_MIN_EDGE - 1);
    expect(verdict.required).toBe(MARK_MIN_EDGE);
  });

  it('🔑 ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΣΥΜΠΕΡΙΛΗΠΤΙΚΟ: ΑΚΡΙΒΩΣ στο ελάχιστο περνά', () => {
    // ⚠️ Ένα `<=` αντί για `<` θα απέρριπτε την εικόνα που παράγει **ακριβώς** τη
    //    μικρότερη βαθμίδα χωρίς καμία μεγέθυνση — τέλεια είσοδο.
    expect(judge(square(MARK_MIN_EDGE)).outcome).not.toBe('tooSmall');
  });

  it('🔴 κρίνει τη ΜΙΚΡΗ πλευρά: 1000×30 έχει άφθονα pixel και δεν παράγει παράγωγο', () => {
    const verdict = judge({ width: 1000, height: 30 });

    expect(verdict.outcome).toBe('tooSmall');
    if (verdict.outcome === 'tooSmall') expect(verdict.reach.shortest).toBe(30);
  });

  it('🔑 μηδενικές ή μη πεπερασμένες διαστάσεις ΔΕΝ πετούν — απαντούν', () => {
    for (const dimensions of [
      { width: 0, height: 0 },
      { width: Number.NaN, height: 100 },
      { width: -50, height: 300 },
      { width: Number.POSITIVE_INFINITY, height: 100 },
    ]) {
      expect(judge(dimensions).outcome).toBe('tooSmall');
    }
  });

  it('🔴 Η ΑΡΝΗΣΗ ΕΙΝΑΙ ΑΣΦΑΛΗΣ ΠΑΡΟΤΙ ΜΕΤΡΑ ΤΟ ΑΡΧΕΙΟ — και ο λόγος είναι ανισότητα', () => {
    // 🔑 Το τρίμμα *(Α21.10)* **μόνο μικραίνει**: `μελάνι ≤ αρχείο` σε κάθε άξονα. Άρα
    //    αρχείο που περνά μπορεί να δώσει μελάνι που δεν περνά *(και τότε μιλά ο κριτής
    //    της ΕΞΟΔΟΥ)* — αλλά αρχείο που **κόβεται** δεν θα μπορούσε ποτέ να δώσει
    //    αποδεκτό μελάνι. Η άρνηση δεν χάνει ποτέ σωστή εικόνα.
    const ink = { width: 40, height: 40 };
    const file = { width: 200, height: 200 };

    expect(judge(file).outcome).not.toBe('tooSmall');
    expect(judge(ink).outcome).toBe('tooSmall');
  });
});

describe('🔴 Κ2 — Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ: δεκτή, αλλά ο άνθρωπος ξέρει ΠΟΥ θα φανεί θολή', () => {
  it('🔴 «warned» ΔΕΝ είναι άρνηση — είναι αποδοχή που κουβαλά κάτι να ειπωθεί', () => {
    const verdict = judge(square(100));

    expect(verdict.outcome).toBe('warned');
    // 🔑 Ό,τι κι αν λέει, το αρχείο **ανεβαίνει**. Η ένωση με το `tooSmall` θα ανάγκαζε
    //    κάθε σημείο χρήσης να ρωτά «είναι από αυτά που μπλοκάρουν;».
    expect(verdict.outcome).not.toBe('tooSmall');
  });

  it('🏆 μιλά σε ΕΠΙΦΑΝΕΙΕΣ, όχι σε ανάλυση: η κάρτα ναι, η σελίδα όχι', () => {
    const verdict = judge(square(100));

    expect(verdict).toEqual({
      outcome: 'warned',
      reach: { shortest: 100, needed: 192, coversCard: true, coversPage: false },
    });
  });

  it('🔑 πολύ μικρή αλλά αποδεκτή: ΟΥΤΕ η κάρτα δεν καλύπτεται', () => {
    const verdict = judge(square(MARK_MIN_EDGE));

    expect(verdict.outcome).toBe('warned');
    if (verdict.outcome !== 'warned') return;
    expect(verdict.reach.coversCard).toBe(false);
    expect(verdict.reach.coversPage).toBe(false);
  });

  it('🔑 ΣΩΠΑΙΝΕΙ όταν καλύπτονται όλες οι επιφάνειες — προειδοποίηση που ανάβει πάντα είναι θόρυβος', () => {
    expect(judge(square(192)).outcome).toBe('accepted');
    expect(judge(square(4000)).outcome).toBe('accepted');
  });

  it('🔑 στρογγυλοποιεί ΠΡΟΣ ΤΑ ΚΑΤΩ ό,τι δείχνει, και ΠΡΟΣ ΤΑ ΠΑΝΩ ό,τι ζητά', () => {
    // ⚠️ Το `needed` **οφείλει** να λύνει το πρόβλημα: ένα `round` θα μπορούσε να ζητήσει
    //    127 για εικόνα που χρειάζεται 127,2 — οδηγία που αφήνει το ίδιο μήνυμα στην οθόνη.
    // ⚠️ **Πορτρέτο**, γιατί εκεί το `object-cover` κάνει τη **μικρή** πλευρά να δεσμεύει.
    //    Το ίδιο σχήμα ως λογότυπο *(`contain` σε τετράγωνο)* είναι **αποδεκτό** — το ύψος
    //    των 240 χωράει άνετα στα 96×2, και αυτό ακριβώς διόρθωσε η Α21.13.
    const verdict = judgeShowcaseMark({ width: 149.7, height: 240 }, 'portrait');

    expect(verdict.outcome).toBe('warned');
    if (verdict.outcome !== 'warned') return;
    expect(verdict.reach.shortest).toBe(149);
    expect(verdict.reach.needed).toBeGreaterThan(verdict.reach.shortest);
    expect(Number.isInteger(verdict.reach.needed)).toBe(true);
  });

  it('🏆 το «needed» ΛΥΝΕΙ το πρόβλημα: στο μέγεθος που ζητά, ο κριτής σωπαίνει', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `ceil` σε `floor` ⇒ ο άνθρωπος ακολουθεί την οδηγία και
    //    ξαναβλέπει το **ίδιο** μήνυμα. Αυτό είναι το χειρότερο είδος βοήθειας.
    for (const dimensions of [square(70), square(100), wordmark(4, 40), wordmark(2.5, 90)]) {
      const verdict = judge(dimensions);
      if (verdict.outcome !== 'warned') continue;

      const factor = verdict.reach.needed / Math.min(dimensions.width, dimensions.height);
      const grown = { width: dimensions.width * factor, height: dimensions.height * factor };

      expect(judge(grown).outcome).toBe('accepted');
    }
  });
});

describe('🏆 Β — Η ΖΩΝΗ: ο κριτής ΚΡΙΝΕΙ ΜΕ ΤΟ ΚΟΥΤΙ ΤΟΥ ΣΗΜΑΤΟΣ, ΟΧΙ ΜΕ ΤΕΤΡΑΓΩΝΟ', () => {
  /**
   * 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕ ΤΟΥΣ ΠΡΑΓΜΑΤΙΚΟΥΣ ΑΡΙΘΜΟΥΣ** *(Α21.13)*. Το σήμα του Giorgio
   * δημοσιεύεται **512×122** *(μετρημένο ζωντανά στη `/pro/comp_9c7c1a50-…`)*. Ο κριτής
   * όπως τον βρήκε η Α21.13 ρωτούσε *«μικρή πλευρά ≥ 192;»* ⇒ **122 < 192 ⇒ «θολό»**.
   *
   * Και ήταν **ψέμα**: η ζώνη ζωγραφίζει 240×64 με `object-contain`, άρα η κλίμακα είναι
   * `min(240/512, 64/122) = 0,469` και σε 2× δίνει **0,94 ≤ 1** — καθαρό.
   *
   * 🔴 Δηλαδή ο «κριτής της εξόδου» γραμμένος **όπως ζητήθηκε** θα κρεμούσε μόνιμη
   * προειδοποίηση πάνω στο ίδιο το σήμα του Giorgio, και σε **κάθε** wordmark.
   */
  it('🔴 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΣΗΜΑ (512×122) ΕΙΝΑΙ ΑΠΟΔΕΚΤΟ — ο παλιός κανόνας το έλεγε θολό', () => {
    const real = { width: 512, height: 122 };

    expect(marksBand({ kind: 'logo', ...real })).toBe(true);
    expect(judge(real).outcome).toBe('accepted');
    // 🔑 Η απόδειξη ότι ο **παλιός** κανόνας θα μιλούσε: η μικρή πλευρά είναι κάτω από την
    //    απαίτηση του **τετράγωνου** κουτιού. Η άγκυρα κρατά τη διαφορά ορατή.
    expect(Math.min(real.width, real.height)).toBeLessThan(markReach(square(1), 'portrait').needed);
  });

  it('🔴 ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΩΣ ΠΟΡΤΡΕΤΟ ΠΡΟΕΙΔΟΠΟΙΕΙ — το είδος αλλάζει την απάντηση', () => {
    // 🔑 Το πορτρέτο **δεν παίρνει ποτέ ζώνη** και γεμίζει με `object-cover`: εκεί η μικρή
    //    πλευρά **είναι** το κριτήριο, και τα 122 δεν φτάνουν.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `kind` προαιρετικό με προεπιλογή ⇒ η γραμμή κοκκινίζει.
    expect(judgeShowcaseMark({ width: 512, height: 122 }, 'portrait').outcome).toBe('warned');
  });

  it('🏆 η ζώνη ζητά ΛΙΓΟΤΕΡΑ από το τετράγωνο, και το «πόσο» βγαίνει από τα κουτιά', () => {
    const bandPage = surfaceOf({ kind: 'logo', ...wordmark(3, 100) }, 'page');
    const squarePage = surfaceOf({ kind: 'logo', ...square(100) }, 'page');

    // ⚠️ **Αναλογία 3, όχι 4**: πάνω από `240/64 = 3,75` δεσμεύει το **πλάτος** της ζώνης
    //    και η απαίτηση παύει να είναι «το ύψος επί την πυκνότητα» — δες την επόμενη άγκυρα.
    expect(markReach(wordmark(3, 10), 'logo').needed).toBe(bandPage.height * MARK_GUARANTEED_DENSITY);
    expect(markReach(square(10), 'logo').needed).toBe(squarePage.height * MARK_GUARANTEED_DENSITY);
    expect(bandPage.height).toBeLessThan(squarePage.height);
  });

  it('🔴 ΠΟΛΥ πλατύ λογότυπο δεσμεύεται από το ΠΛΑΤΟΣ της ζώνης, όχι από το ύψος', () => {
    // ⚠️ Πάνω από αναλογία `240/64 = 3,75` το ταβάνι πλάτους «δένει» πρώτο. Ένας κριτής
    //    που κοίταζε **μόνο** το ύψος θα έλεγε «καθαρό» για λογότυπο 10:1 που τεντώνεται.
    const veryWide = { width: 400, height: 70 }; // ~5,7:1 — το πλάτος δεσμεύει
    const scale = Math.min(240 / veryWide.width, 64 / veryWide.height);

    expect(scale * MARK_GUARANTEED_DENSITY).toBeGreaterThan(1);
    expect(judge(veryWide).outcome).toBe('warned');
  });

  it('🔑 κάτω από το κατώφλι της ζώνης το λογότυπο κρίνεται ΤΕΤΡΑΓΩΝΟ — μία αυθεντία', () => {
    const belowThreshold = wordmark(MARK_BAND_ASPECT_THRESHOLD, 100);
    const aboveThreshold = wordmark(MARK_BAND_ASPECT_THRESHOLD + 0.5, 100);

    expect(surfaceOf({ kind: 'logo', ...belowThreshold }, 'page')).toEqual(
      surfaceOf({ kind: 'logo', ...square(100) }, 'page'),
    );
    expect(surfaceOf({ kind: 'logo', ...aboveThreshold }, 'page')).not.toEqual(
      surfaceOf({ kind: 'logo', ...square(100) }, 'page'),
    );
  });
});

describe('🏆 Ξ — Ο ΚΡΙΤΗΣ ΤΗΣ ΕΞΟΔΟΥ: Ο ΙΔΙΟΣ ΚΡΙΤΗΣ, ΑΛΛΟΙ ΑΡΙΘΜΟΙ', () => {
  /**
   * 🔴 **ΤΟ ΚΕΝΟ**: ο κριτής μετρούσε το **ΑΡΧΕΙΟ**, το ράφι δημοσίευε το **ΜΕΛΑΝΙ**.
   * Λογότυπο 200×200 με 80% περιθώριο ακούει *«εντάξει»* και δημοσιεύεται **40×40**.
   *
   * 🔑 Η άγκυρα **δεν προσποιείται τρίμμα**: περνά τους δύο αριθμούς που θα έγραφε ο
   * καθαριστής, ακριβώς όπως τους περνά η οθόνη από το `published.image`. Το ότι δεν
   * χρειάζεται τίποτε άλλο **είναι** ολόκληρο το επιχείρημα της Α21.13.
   */
  it('🔴 ΤΟ ΑΡΧΕΙΟ ΠΕΡΝΑ ΚΑΙ ΤΟ ΜΕΛΑΝΙ ΟΧΙ — αυτή είναι η ολόκληρη Α21.13', () => {
    const file = square(200);
    const ink = square(40);

    expect(judge(file).outcome).toBe('accepted');
    expect(judge(ink).outcome).not.toBe('accepted');
  });

  it('🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: εικόνα ΧΩΡΙΣ περιθώριο μένει ΣΙΩΠΗΛΗ', () => {
    // ⚠️ Άγκυρα που δείχνει μόνο ότι «εμφανίζεται προειδοποίηση» μένει **πράσινη** και όταν
    //    εμφανίζεται **πάντα**. Εδώ κρίνεται η **σιωπή**, σε κάθε σχήμα και κάθε είδος.
    const silent: readonly [{ width: number; height: number }, ShowcaseMarkKind][] = [
      [square(192), 'portrait'],
      [square(512), 'portrait'],
      [square(192), 'logo'],
      [{ width: 512, height: 122 }, 'logo'],
      [wordmark(3, 128), 'logo'],
      [wordmark(2, 200), 'logo'],
    ];

    for (const [dimensions, kind] of silent) {
      expect(judgeShowcaseMark(dimensions, kind).outcome).toBe('accepted');
    }
  });

  it('🔑 ΚΑΜΙΑ ΑΡΝΗΣΗ ΣΤΗΝ ΕΞΟΔΟ: το «tooSmall» κουβαλά ΚΑΙ reach, ώστε να μιλήσει η οθόνη', () => {
    // 🔑 Το σήμα είναι **ήδη δημοσιευμένο** — δεν υπάρχει τίποτα να απορριφθεί αναδρομικά.
    //    Η οθόνη της εξόδου χρειάζεται το **ίδιο** λεξιλόγιο *(«πού φαίνεται θολό;»)* και
    //    για τη ζώνη κάτω από το ελάχιστο.
    const verdict = judge(square(20));

    expect(verdict.outcome).toBe('tooSmall');
    if (verdict.outcome !== 'tooSmall') return;
    expect(verdict.reach.coversCard).toBe(false);
    expect(verdict.reach.coversPage).toBe(false);
    expect(verdict.reach.shortest).toBe(20);
  });

  it('🔑 ο κριτής ΔΕΝ ξέρει από πού ήρθαν οι αριθμοί — ίδια είσοδος, ίδια απάντηση', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: πρόσθεσε δεύτερο κριτή για την έξοδο ⇒ αυτή η ισότητα παύει να
    //    είναι εγγυημένη, και οι δύο μπορούν να αποκλίνουν σιωπηλά.
    const dimensions = { width: 300, height: 150 };

    expect(judgeShowcaseMark(dimensions, 'logo')).toEqual(judgeShowcaseMark({ ...dimensions }, 'logo'));
  });
});

describe('🔴 Π — ΤΟ ΠΛΑΙΣΙΟ: το σχήμα προκύπτει από το ΤΙ ΕΙΝΑΙ το περιεχόμενο', () => {
  it('🔑 ΚΑΘΕ είδος έχει πλαίσιο — ο πίνακας είναι εξαντλητικός', () => {
    for (const kind of SHOWCASE_MARK_KINDS) {
      expect(SHOWCASE_MARK_FRAME[kind]).toBeDefined();
      expect(SHOWCASE_MARK_FRAME[kind].shape).not.toBe('');
      expect(SHOWCASE_MARK_FRAME[kind].fit).not.toBe('');
    }
  });

  it('🔴 το λογότυπο ΔΕΝ κόβεται και το πορτρέτο γεμίζει — οι δύο μισές αποφάσεις', () => {
    // ⚠️ Κυκλική περικοπή **κόβει γράμματα**· `contain` σε κύκλο αφήνει κενές λωρίδες.
    //    Τα δύο πεδία ταξιδεύουν μαζί γιατί απαντούν στο ίδιο ερώτημα.
    expect(SHOWCASE_MARK_FRAME.logo).toEqual({
      shape: 'rounded-lg',
      fit: 'object-contain',
      surface: 'bg-white ring-1 ring-border',
    });
    expect(SHOWCASE_MARK_FRAME.portrait).toEqual({
      shape: 'rounded-full',
      fit: 'object-cover',
      surface: 'bg-card',
    });
  });

  it('🔑 το «κόβει;» βγαίνει ΑΠΟ ΤΟ ΣΧΗΜΑ, όχι από λίστα ειδών', () => {
    expect(maskCrops('portrait')).toBe(true);
    expect(maskCrops('logo')).toBe(false);

    // 🔴 Η απόδειξη ότι δεν είναι δεύτερη αυθεντία: το κατηγόρημα συμφωνεί με τον πίνακα
    //    για **κάθε** είδος, χωρίς να ξέρει κανένα όνομα.
    for (const kind of SHOWCASE_MARK_KINDS) {
      expect(maskCrops(kind)).toBe(SHOWCASE_MARK_FRAME[kind].shape === 'rounded-full');
    }
  });

  it('🔴 FAIL-CLOSED: ιστορική τιμή από τον δίσκο δεν ρίχνει τη σελίδα', () => {
    // ⚠️ Ένα σκέτο `SHOWCASE_MARK_FRAME[kind]` δίνει `undefined`, και το `undefined.shape`
    //    ρίχνει **ολόκληρη** τη σελίδα — για ένα σήμα μεγέθους νυχιού.
    expect(frameOf('mascot')).toEqual(SHOWCASE_MARK_FRAME.logo);
    expect(frameOf('')).toEqual(SHOWCASE_MARK_FRAME.logo);
    // 🔑 Και η εφεδρεία είναι η **ασφαλής**: `contain` δεν κόβει τίποτα.
    expect(frameOf('mascot').fit).toBe('object-contain');
  });

  it('🔑 η κάλυψη της μάσκας είναι π/4 — ΓΕΩΜΕΤΡΙΑ, όχι η «ζώνη ασφαλείας» του ~70%', () => {
    expect(CIRCULAR_MASK_COVERAGE).toBeCloseTo(0.785, 3);
  });
});

describe('🔴 Ε — ΟΙ ΕΠΙΦΑΝΕΙΕΣ ΠΟΥ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΣΕΙ', () => {
  /**
   * 🔴 Το `showcase-mark-surfaces` κρίνει σε **λογικά εικονοστοιχεία**, γιατί τόσο
   * ζωγραφίζει το `ShowcaseMarkView`. Εκείνα όμως είναι **κλάσεις Tailwind** — κανένας
   * τύπος δεν συνδέει τα δύο. Αν η κάρτα μεγαλώσει, ο κριτής θα λέει *«καθαρό στην
   * κάρτα»* για εικόνα που **θα φαίνεται θολή εκεί**.
   *
   * ⚠️ Ένας «έξυπνος» υπολογισμός από τις κλάσεις θα ήταν **αναλυτής Tailwind** — πολύ
   * ακριβότερος από μία άγκυρα που διαβάζει το ωμό αρχείο και μπορεί να **κοκκινίσει**.
   *
   * 🔴 **ΚΑΙ Η ΠΡΟΗΓΟΥΜΕΝΗ ΤΗΣ ΜΟΡΦΗ ΕΞΑΙΡΟΥΣΕ ΤΗ ΖΩΝΗ — ΓΙ' ΑΥΤΟ ΥΠΑΡΧΕΙ Η Α21.13.**
   */
  const REM_PX = 16;
  const TAILWIND_UNIT = 4;
  const RAW = fs.readFileSync(
    path.join(process.cwd(), 'src/components/mandate/showcase-mark-box.ts'),
    'utf8',
  );

  /** Κάθε κουτί **σταθερών** διαστάσεων: `'h-11 w-11'` → 44×44 · `'h-12 w-24'` → 96×48. */
  const fixedBoxes = [...RAW.matchAll(/className: 'h-(\d+) w-(\d+)'/g)].map((m) => ({
    height: Number(m[1]) * TAILWIND_UNIT,
    width: Number(m[2]) * TAILWIND_UNIT,
  }));

  /** Τα **τετράγωνα** κουτιά — `h` ίσο με `w`. */
  const squareEdges = fixedBoxes.filter((b) => b.height === b.width).map((b) => b.height);

  /**
   * Οι **ζώνες**: `'h-16 w-auto max-w-[15rem]'` → 240×64, **και** η σταθερή ζώνη της
   * κάρτας *(Α21.15)* — κουτί σταθερών διαστάσεων με `w` ≠ `h`.
   */
  const bands = [
    ...[...RAW.matchAll(/className: 'h-(\d+) w-auto max-w-\[(\d+)rem\]'/g)].map((m) => ({
      height: Number(m[1]) * TAILWIND_UNIT,
      width: Number(m[2]) * REM_PX,
    })),
    ...fixedBoxes.filter((b) => b.height !== b.width),
  ];

  it('🔴 ΟΙ ΚΛΑΣΕΙΣ ΔΙΑΒΑΖΟΝΤΑΙ — αλλιώς όλη η ομάδα είναι πράσινη χωρίς να κοιτά τίποτα', () => {
    // ⚠️ Η ίδια η άγκυρα μπορεί να «περάσει» επειδή το regex δεν ταίριαξε τίποτα. Αυτή η
    //    γραμμή είναι που **αρνείται** να είναι πράσινη τότε.
    expect(squareEdges.length).toBeGreaterThan(0);
    expect(bands.length).toBeGreaterThan(0);
  });

  it('🔴 ΤΑ ΤΕΤΡΑΓΩΝΑ ΚΟΥΤΙΑ που ζωγραφίζει η οθόνη ΕΙΝΑΙ αυτά που κρίνει ο κριτής', () => {
    const judged = markSurfaces({ kind: 'portrait', ...square(100) }).map((s) => s.height);

    for (const edge of new Set(squareEdges)) {
      expect(judged).toContain(edge);
    }
  });

  it('🔴 ΚΑΙ Η ΖΩΝΗ — το κενό που άφησε η Α21.9 και έκλεισε η Α21.13', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `markSurfaces` να δίνει πάντα τετράγωνο ⇒ κοκκινίζει.
    const bandPage = surfaceOf({ kind: 'logo', ...wordmark(4, 100) }, 'page');

    expect(bands).toContainEqual({ width: bandPage.width, height: bandPage.height });
  });

  it('🔴 Α21.15 — ΚΑΙ Η ΖΩΝΗ ΤΗΣ ΚΑΡΤΑΣ: ο κριτής κρίνει το 96×48 που ζωγραφίζεται', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα την κάρτα του `markSurfaces` σε 44×44 για τη ζώνη ⇒ ο
    //    κριτής θα έκρινε wordmark με κουτί που **δεν υπάρχει πια** στην οθόνη.
    const bandCard = surfaceOf({ kind: 'logo', ...wordmark(4, 100) }, 'card');

    expect(bands).toContainEqual({ width: bandCard.width, height: bandCard.height });
  });

  it('🔴 ΤΟ ΓΕΜΙΣΜΑ συμφωνεί με το πλαίσιο, για ΚΑΘΕ είδος', () => {
    // ⚠️ Το `contain` και το `cover` δίνουν **διαφορετική κλίμακα** για την ίδια εικόνα στο
    //    ίδιο κουτί. Μια απόκλιση εδώ θα έκανε τον κριτή να απαντά για **άλλη** οθόνη.
    for (const kind of SHOWCASE_MARK_KINDS) {
      expect(SHOWCASE_MARK_FRAME[kind].fit).toBe(`object-${markFill(kind)}`);
      expect(markSurfaces({ kind, ...square(100) }).every((s) => s.fill === markFill(kind))).toBe(true);
    }
  });

  it('🔑 η εγγύηση δίνεται για πυκνότητα 2× — ούτε 1× (άχρηστη) ούτε 3× (θόρυβος)', () => {
    const card = surfaceOf({ kind: 'logo', ...square(100) }, 'card');
    const exact = card.height * MARK_GUARANTEED_DENSITY;

    const at = (edge: number) => {
      const verdict = judge(square(edge));
      return verdict.outcome === 'warned' && verdict.reach.coversCard;
    };

    expect(at(exact)).toBe(true);
    expect(at(exact - 1)).toBe(false);
  });
});

describe('🔴 Τ — Ο TAILWIND ΠΡΕΠΕΙ ΝΑ ΒΛΕΠΕΙ ΤΙΣ ΚΛΑΣΕΙΣ ΤΟΥ ΠΛΑΙΣΙΟΥ', () => {
  /**
   * 🔴 **ΤΟ ΒΡΗΚΕ ΖΩΝΤΑΝΟΣ ΕΛΕΓΧΟΣ ΤΗΣ ΔΙΑΜΟΡΦΩΣΗΣ, ΟΧΙ ΤΟ TEST.** Η πρώτη γραφή έβαλε
   * το `SHOWCASE_MARK_FRAME` στο `src/lib/agency/` — φάκελο που το `content` του
   * `tailwind.config.ts` **δεν απαριθμεί**. Δούλευε **από τύχη**: και οι τέσσερις κλάσεις
   * παράγονταν επειδή τις χρησιμοποιούσαν εκατοντάδες *άλλα* αρχεία.
   *
   * ⚠️ **Η αποτυχία θα ήταν σιωπηλή ΚΑΙ ΜΕΛΛΟΝΤΙΚΗ**: τρίτο είδος με σπανιότερη κλάση
   * *(`rounded-3xl`)* θα έδινε σήμα **χωρίς σχήμα**, χωρίς κανένα σφάλμα πουθενά.
   *
   * 🔑 **Η άγκυρα ρωτά τη ΔΙΑΜΟΡΦΩΣΗ, όχι μια σταθερά**: αν το `content` αλλάξει —
   * προστεθεί ή αφαιρεθεί φάκελος — αυτό το test το μαθαίνει.
   */
  const CONFIG = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf8');

  /** Τα πρώτα τμήματα των globs του `content` — `'./src/components/**...'` → `components`. */
  const scannedRoots = new Set([...CONFIG.matchAll(/'\.\/src\/([\w-]+)/g)].map((m) => m[1]));

  it('🔴 το αρχείο του πλαισίου ζει σε φάκελο που ο σαρωτής ΑΠΑΡΙΘΜΕΙ', () => {
    // Το `require.resolve` θα έδινε το μεταγλωττισμένο μονοπάτι· εδώ θέλουμε το **πηγαίο**.
    const frameRoot = 'src/components/mandate/showcase-mark-frame.ts'.split('/')[1];

    expect(scannedRoots.size).toBeGreaterThan(0);
    expect([...scannedRoots]).toContain(frameRoot);
  });

  it('🔴 ΚΑΘΕ κλάση του πίνακα εμφανίζεται ΚΑΙ σε σαρωμένο αρχείο', () => {
    const frameSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/mandate/showcase-mark-frame.ts'),
      'utf8',
    );

    for (const kind of SHOWCASE_MARK_KINDS) {
      for (const cls of [SHOWCASE_MARK_FRAME[kind].shape, SHOWCASE_MARK_FRAME[kind].fit]) {
        // 🔑 Η κλάση οφείλει να είναι **κυριολεκτική** στο αρχείο — ποτέ χτισμένη με
        //    παρεμβολή, που ο σαρωτής **δεν εκτελεί ποτέ**.
        expect(frameSource).toContain(`'${cls}'`);
      }
    }
  });

  it('🔴 ΚΑΜΙΑ κλάση Tailwind στο αρχείο των ΕΠΙΦΑΝΕΙΩΝ — ζει εκεί που ο σαρωτής ΔΕΝ κοιτά', () => {
    // ⚠️ Το `lib/` **δεν σαρώνεται**: μια κλάση εδώ θα δούλευε μόνο όσο τη χρησιμοποιεί
    //    κάποιος γείτονας, και θα έσβηνε σιωπηλά την ημέρα που εκείνος αλλάξει.
    const surfaces = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/agency/showcase-mark-surfaces.ts'),
      'utf8',
    );

    expect([...scannedRoots]).not.toContain('lib');
    expect(surfaces).not.toMatch(/className/);
  });
});

describe('🔴 Ζ — ΟΙ ΔΥΟ ΖΩΝΕΣ: ΤΟ ΠΛΗΘΟΣ ΤΟΥΣ ΕΙΝΑΙ ΘΕΩΡΗΜΑ, ΟΧΙ ΠΑΡΑΤΗΡΗΣΗ', () => {
  /**
   * 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΛΕΙΠΕ, ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΗΣ ΑΦΗΣΕ ΨΕΜΑ ΝΑ ΠΕΡΑΣΕΙ.**
   *
   * Η οθόνη διάλεγε μήνυμα με `coversCard ? blurryPage : blurryEverywhere` — δηλαδή
   * διάβαζε **ένα** κατηγόρημα για να απαντήσει σε **δύο** ερωτήματα. Οι παλιές άγκυρες
   * ήταν **πράσινες**: δοκίμαζαν το `reach` *(που ήταν σωστό)* και ποτέ τη
   * **χαρτογράφηση σε μήνυμα** *(που ήταν λάθος)*.
   */
  const zoneOf = (dimensions: { width: number; height: number }, kind: ShowcaseMarkKind = 'logo') => {
    const v = judgeShowcaseMark(dimensions, kind);
    if (v.outcome === 'accepted') return 'accepted';
    return `${v.reach.coversCard ? 'card' : '-'}/${v.reach.coversPage ? 'page' : '-'}`;
  };

  it('🏆 ΤΟ ΘΕΩΡΗΜΑ: «καλύπτεται η σελίδα» ΣΥΝΕΠΑΓΕΤΑΙ «καλύπτεται η κάρτα», ΠΑΝΤΑ', () => {
    // 🔑 Η σελίδα είναι μεγαλύτερη από την κάρτα **και στις δύο** πλευρές, σε **κάθε**
    //    σχήμα, και η κλίμακα του `contain`/`cover` είναι μονότονη ως προς το κουτί.
    //    ⇒ Ο συνδυασμός «σελίδα ναι, κάρτα όχι» **δεν υπάρχει** ⇒ οι ζώνες είναι **δύο**.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε την κάρτα μεγαλύτερη από τη σελίδα σε έναν άξονα ⇒ γεννιέται
    //    τρίτη ζώνη, και το `BlurryReach` χρειάζεται τρίτο μήνυμα ξανά.
    for (const kind of SHOWCASE_MARK_KINDS) {
      for (const aspect of [0.25, 0.8, 1, 1.25, 2, 4, 10]) {
        for (const height of [64, 70, 88, 100, 128, 150, 192, 256, 400]) {
          const reach = markReach(wordmark(aspect, height), kind);
          if (reach.coversPage) expect(reach.coversCard).toBe(true);
        }
      }
    }
  });

  it('🔴 ΚΑΘΕ ΖΩΝΗ ΕΙΝΑΙ ΔΙΑΚΡΙΤΗ — αλλιώς ένα μήνυμα θα ήταν περιττό ή ψεύτικο', () => {
    const samples = [zoneOf(square(70)), zoneOf(square(100)), zoneOf(square(192))];

    expect(new Set(samples).size).toBe(samples.length);
    expect(samples).toEqual(['-/-', 'card/-', 'accepted']);
  });

  it('🔑 «και τα δύο ναι» ΕΙΝΑΙ η αποδοχή — δεν υπάρχει προειδοποίηση να ειπωθεί εκεί', () => {
    // 🔴 Το τρίτο μήνυμα (`blurryDense`) της Α21.9 ήταν **νεκρός κλάδος από τη γέννησή
    //    του**, και διαγράφηκε στην Α21.13 μαζί με τα δύο του κείμενα.
    for (const kind of SHOWCASE_MARK_KINDS) {
      for (const aspect of [0.5, 1, 2, 4]) {
        for (const height of [64, 100, 128, 192, 400]) {
          const verdict = judgeShowcaseMark(wordmark(aspect, height), kind);
          if (verdict.outcome !== 'warned') continue;
          expect(verdict.reach.coversPage).toBe(false);
        }
      }
    }
  });

  it('🔑 και στα δύο άκρα σωπαίνει: κάτω άρνηση, πάνω αποδοχή', () => {
    expect(judge(square(MARK_MIN_EDGE - 1)).outcome).toBe('tooSmall');
    expect(zoneOf(square(4000))).toBe('accepted');
  });
});
