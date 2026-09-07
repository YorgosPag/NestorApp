/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΕΙΣΟΔΟΥ ΚΑΙ ΤΟΥ ΠΛΑΙΣΙΟΥ** (ADR-841 §7 Α21, Φάση 2).
 * @related lib/agency/showcase-mark-input · components/mandate/showcase-mark-frame
 * @module lib/agency/__tests__/showcase-mark-input
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΩΜΟ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η υπόσχεση του κριτή είναι ότι τα κατώφλια **παράγονται** από την κλίμακα του ραφιού.
 * Μια άγκυρα που έγραφε `expect(MARK_MIN_EDGE).toBe(64)` θα επαλήθευε **αντιγραφή** —
 * και θα κοκκίνιζε την ημέρα που η κλίμακα αλλάξει **νόμιμα**, δηλαδή θα δίδασκε τον
 * επόμενο να «διορθώσει το test» αντί να σκεφτεί.
 *
 * ⇒ Οι ισχυρισμοί ρωτούν τη **σχέση** με το `SHOWCASE_SHELF`, ποτέ την τιμή. Η μόνη
 * εξαίρεση είναι το Κ0, που κρίνει **ακριβώς** αυτή τη σχέση.
 */

import fs from 'node:fs';
import path from 'node:path';

import { SHOWCASE_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import { SHOWCASE_MARK_KINDS } from '@/lib/agency/showcase-mark-kind';
import {
  judgeShowcaseMarkInput,
  MARK_IDEAL_EDGE,
  MARK_MIN_EDGE,
} from '../showcase-mark-input';
import {
  CIRCULAR_MASK_COVERAGE,
  SHOWCASE_MARK_FRAME,
  frameOf,
  maskCrops,
} from '@/components/mandate/showcase-mark-frame';

const square = (edge: number) => ({ width: edge, height: edge });

// ===========================================================================

describe('🔴 Κ0 — ΤΑ ΚΑΤΩΦΛΙΑ ΠΑΡΑΓΟΝΤΑΙ ΑΠΟ ΤΟ ΡΑΦΙ, ΔΕΝ ΑΝΤΙΓΡΑΦΟΝΤΑΙ', () => {
  it('το ελάχιστο ΕΙΝΑΙ η μικρότερη βαθμίδα, και το ιδανικό η μεγαλύτερη', () => {
    const widths = [...SHOWCASE_SHELF.encoding.widths].sort((a, b) => a - b);

    expect(MARK_MIN_EDGE).toBe(widths[0]);
    expect(MARK_IDEAL_EDGE).toBe(widths[widths.length - 1]);
  });

  it('🔴 ΔΕΝ αναδιατάσσει την κλίμακα του γραφέα ενώ τη διαβάζει', () => {
    // ⚠️ Το `sort` μεταλλάσσει **επί τόπου**. Ένα `SHOWCASE_SHELF.encoding.widths.sort()`
    //    μέσα στο module θα άλλαζε σιωπηλά τη διαμόρφωση που παράγει τα bytes — και τα
    //    `widths` είναι `readonly` **μόνο για τον μεταγλωττιστή**.
    expect([...SHOWCASE_SHELF.encoding.widths]).toEqual([64, 128, 256]);
  });
});

describe('🔴 Κ1 — Η ΑΡΝΗΣΗ: κάτω από τη μικρότερη βαθμίδα δεν υπάρχει τι να παραχθεί', () => {
  it('απορρίπτει εικόνα κάτω από το ελάχιστο, και ΛΕΕΙ και τα δύο νούμερα', () => {
    const verdict = judgeShowcaseMarkInput(square(MARK_MIN_EDGE - 1));

    expect(verdict).toEqual({
      outcome: 'tooSmall',
      shortest: MARK_MIN_EDGE - 1,
      required: MARK_MIN_EDGE,
    });
  });

  it('🔑 ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΣΥΜΠΕΡΙΛΗΠΤΙΚΟ: ΑΚΡΙΒΩΣ στο ελάχιστο περνά', () => {
    // ⚠️ Ένα `<=` αντί για `<` θα απέρριπτε την εικόνα που παράγει **ακριβώς** τη
    //    μικρότερη βαθμίδα χωρίς καμία μεγέθυνση — τέλεια είσοδο.
    expect(judgeShowcaseMarkInput(square(MARK_MIN_EDGE)).outcome).not.toBe('tooSmall');
  });

  it('🔴 κρίνει τη ΜΙΚΡΗ πλευρά: 1000×30 έχει άφθονα pixel και είναι άχρηστη', () => {
    const verdict = judgeShowcaseMarkInput({ width: 1000, height: 30 });

    expect(verdict.outcome).toBe('tooSmall');
    if (verdict.outcome === 'tooSmall') expect(verdict.shortest).toBe(30);
  });

  it('🔑 μηδενικές ή μη πεπερασμένες διαστάσεις ΔΕΝ πετούν — απαντούν', () => {
    for (const dimensions of [
      { width: 0, height: 0 },
      { width: Number.NaN, height: 100 },
      { width: -50, height: 300 },
    ]) {
      expect(judgeShowcaseMarkInput(dimensions).outcome).toBe('tooSmall');
    }
  });
});

describe('🔴 Κ2 — Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ: δεκτή, αλλά ο άνθρωπος ξέρει ΠΟΥ θα φανεί θολή', () => {
  it('🔴 «warned» ΔΕΝ είναι άρνηση — είναι αποδοχή που κουβαλά κάτι να ειπωθεί', () => {
    const verdict = judgeShowcaseMarkInput(square(100));

    expect(verdict.outcome).toBe('warned');
    // 🔑 Ό,τι κι αν λέει, το αρχείο **ανεβαίνει**. Η ένωση με το `tooSmall` θα ανάγκαζε
    //    κάθε σημείο χρήσης να ρωτά «είναι από αυτά που μπλοκάρουν;».
    expect(verdict.outcome).not.toBe('tooSmall');
  });

  it('🏆 μιλά σε ΕΠΙΦΑΝΕΙΕΣ, όχι σε ανάλυση: η κάρτα ναι, η σελίδα όχι', () => {
    // 100px ≥ 44×2 (κάρτα@2×) αλλά < 64×2 (σελίδα@2×) — ακριβώς η ενδιάμεση ζώνη που
    // κανένας από τους μεγάλους δεν ονομάζει.
    const verdict = judgeShowcaseMarkInput(square(100));

    expect(verdict).toEqual({
      outcome: 'warned',
      reach: { shortest: 100, coversCard: true, coversPage: false },
    });
  });

  it('🔑 πολύ μικρή αλλά αποδεκτή: ΟΥΤΕ η κάρτα δεν καλύπτεται', () => {
    const verdict = judgeShowcaseMarkInput(square(MARK_MIN_EDGE));

    expect(verdict).toEqual({
      outcome: 'warned',
      reach: { shortest: MARK_MIN_EDGE, coversCard: false, coversPage: false },
    });
  });

  it('🔑 ΣΩΠΑΙΝΕΙ στο ιδανικό και πάνω — προειδοποίηση που ανάβει πάντα είναι θόρυβος', () => {
    expect(judgeShowcaseMarkInput(square(MARK_IDEAL_EDGE)).outcome).toBe('accepted');
    expect(judgeShowcaseMarkInput(square(4000)).outcome).toBe('accepted');
  });

  it('🔑 στρογγυλοποιεί ΠΡΟΣ ΤΑ ΚΑΤΩ: το 199,7 δεν ανακοινώνεται ως 200', () => {
    const verdict = judgeShowcaseMarkInput({ width: 199.7, height: 240 });

    expect(verdict.outcome).toBe('warned');
    if (verdict.outcome === 'warned') expect(verdict.reach.shortest).toBe(199);
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
    expect(SHOWCASE_MARK_FRAME.logo).toEqual({ shape: 'rounded-lg', fit: 'object-contain' });
    expect(SHOWCASE_MARK_FRAME.portrait).toEqual({ shape: 'rounded-full', fit: 'object-cover' });
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

describe('🔴 Ε — ΟΙ ΔΥΟ ΕΠΙΦΑΝΕΙΕΣ ΠΟΥ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΣΕΙ', () => {
  /**
   * 🔴 Το `showcase-mark-input` κρίνει σε **44** και **64** εικονοστοιχεία, γιατί τόσο
   * ζωγραφίζει το `ShowcaseMarkView`. Εκείνα όμως είναι **κλάσεις Tailwind**
   * (`h-11` · `h-16`) — κανένας τύπος δεν συνδέει τα δύο. Αν η κάρτα μεγαλώσει, ο
   * κριτής θα λέει *«καθαρό στην κάρτα»* για εικόνα που **θα φαίνεται θολή εκεί**.
   *
   * ⚠️ Ένας «έξυπνος» υπολογισμός από τις κλάσεις θα ήταν **αναλυτής Tailwind** — πολύ
   * ακριβότερος από μία άγκυρα που διαβάζει το ωμό αρχείο και μπορεί να **κοκκινίσει**.
   */
  const RAW = fs.readFileSync(
    path.join(process.cwd(), 'src/components/mandate/ShowcaseMarkView.tsx'),
    'utf8',
  );

  it('🔴 τα μεγέθη της οθόνης ΕΙΝΑΙ αυτά που κρίνει ο κριτής', () => {
    const drawn = [...RAW.matchAll(/^\s{2}\w+: 'h-(\d+) w-\d+/gm)].map((m) => Number(m[1]) * 4);

    // ⚠️ Ο κριτής δεν τα εξάγει — τα κρατά ιδιωτικά. Η άγκυρα τα ζητά από την **πηγή**
    //    τους (τον renderer) και επαληθεύει ότι το αρχείο του κριτή τα αναφέρει.
    const judge = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/agency/showcase-mark-input.ts'),
      'utf8',
    );

    expect(drawn.length).toBeGreaterThan(0);
    for (const edge of drawn) {
      expect(judge).toContain(`= ${edge};`);
    }
  });

  it('🔑 η εγγύηση δίνεται για πυκνότητα 2× — ούτε 1× (άχρηστη) ούτε 3× (θόρυβος)', () => {
    // 44×2 = 88 ⇒ ακριβώς στο όριο η κάρτα καλύπτεται· 87 όχι.
    const at88 = judgeShowcaseMarkInput(square(88));
    const at87 = judgeShowcaseMarkInput(square(87));

    expect(at88.outcome === 'warned' && at88.reach.coversCard).toBe(true);
    expect(at87.outcome === 'warned' && at87.reach.coversCard).toBe(false);
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
   * προστεθεί ή αφαιρεθεί φάκελος — αυτό το test το μαθαίνει. Ένα καρφωμένο
   * `expect(path).toContain('components')` θα επαλήθευε **τον εαυτό του**.
   */
  const CONFIG = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf8');

  /** Τα πρώτα τμήματα των globs του `content` — `'./src/components/**...'` → `components`. */
  const scannedRoots = new Set(
    [...CONFIG.matchAll(/'\.\/src\/([\w-]+)/g)].map((m) => m[1]),
  );

  it('🔴 το αρχείο του πλαισίου ζει σε φάκελο που ο σαρωτής ΑΠΑΡΙΘΜΕΙ', () => {
    // Το `require.resolve` θα έδινε το μεταγλωττισμένο μονοπάτι· εδώ θέλουμε το **πηγαίο**.
    const frameRoot = 'src/components/mandate/showcase-mark-frame.ts'.split('/')[1];

    expect(scannedRoots.size).toBeGreaterThan(0);
    expect([...scannedRoots]).toContain(frameRoot);
  });

  it('🔴 ΚΑΘΕ κλάση του πίνακα εμφανίζεται ΚΑΙ σε σαρωμένο αρχείο', () => {
    // ⚠️ Το ίδιο το αρχείο του πλαισίου **είναι** σαρωμένο μετά τη μετακίνηση, οπότε η
    //    συνθήκη ικανοποιείται από μόνη της. Η αξία της άγκυρας είναι ότι **κοκκινίζει**
    //    αν κάποιος το ξαναμετακινήσει σε `lib/`, `types/` ή `constants/`.
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
});
