/**
 * @fileoverview **ΤΟ ΚΟΥΤΙ ΤΟΥ ΣΗΜΑΤΟΣ** — η απόφαση «τετράγωνο ή ζώνη;» (ADR-841 §7 Α21.9).
 * @related components/mandate/showcase-mark-box · lib/agency/showcase-mark-surfaces ·
 *   ADR-777 §8.68
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το περιστατικό: λογότυπο **4:1** μέσα σε τετράγωνο 64 άφηνε μελάνι **64×16**. Καμία
 * δοκιμή δεν ρωτούσε *«πόσο μελάνι μένει;»* — ρωτούσαν μόνο *«υπάρχει κλάση;»*, και η
 * κλάση **υπήρχε**. Πράσινο που δεν σήμαινε τίποτα.
 *
 * ⚠️ **ΔΗΛΩΤΙΚΕΣ ΑΓΚΥΡΕΣ, ΚΑΙ ΤΟ ΛΕΝΕ**: το jsdom **δεν κάνει διάταξη**. Εδώ κρίνεται η
 * **απόφαση** που παράγει τα pixel — ποιο κουτί διαλέγεται και τι υπόσχεται στον
 * περιηγητή. Τα ίδια τα pixel μετριούνται μόνο σε φυλλομετρητή.
 */

import fs from 'fs';
import path from 'path';

import { markBox, type ShowcaseMarkSize } from '../showcase-mark-box';
// ⚠️ **Το «ποιο σχήμα;» μετακόμισε στον τομέα** *(Α21.13)*: το κατώφλι και το κατηγόρημα
//    τα ρωτά πλέον **και** ο κριτής, οπότε δεν μπορούσαν να μείνουν στο αρχείο των κλάσεων.
import {
  MARK_BAND_ASPECT_THRESHOLD,
  marksBand,
  type MarkBoxSubject,
} from '@/lib/agency/showcase-mark-surfaces';

/** Λογότυπο δοσμένης αναλογίας, με ύψος σταθερό στα 100 — η αναλογία είναι το θέμα. */
function logo(aspect: number): MarkBoxSubject {
  return { kind: 'logo', width: Math.round(100 * aspect), height: 100 };
}

const SIZES: readonly ShowcaseMarkSize[] = ['card', 'page'];

// =============================================================================

describe('Κ1 — 🔴 ΤΟ ΕΙΔΟΣ ΝΙΚΑ ΤΗΝ ΑΝΑΛΟΓΙΑ, ΚΑΙ ΜΟΝΟ ΤΟ ΛΟΓΟΤΥΠΟ ΡΩΤΑΕΙ', () => {
  it('🔴 πορτρέτο 4:1 ΔΕΝ γίνεται ζώνη — το `object-cover` γεμίζει το τετράγωνο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `subject.kind !== 'logo'` από το `marksBand` ⇒ ένα
    //    πανοραμικό πορτρέτο θα γινόταν ζώνη, δηλαδή **κύκλος σε ορθογώνιο κουτί**.
    expect(marksBand({ kind: 'portrait', width: 400, height: 100 })).toBe(false);
  });

  it('🔴 το πλακίδιο αρχικών ΔΕΝ έχει καν αναλογία να ρωτηθεί', () => {
    // ⚠️ Ο τύπος το επιβάλλει: το σκέλος `lettermark` **δεν δέχεται** διαστάσεις. Η
    //    δοκιμή κλειδώνει τη **συμπεριφορά** που ο τύπος περιγράφει.
    expect(marksBand({ kind: 'lettermark' })).toBe(false);
  });
});

describe('Κ2 — 🔴 ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΜΕ ΑΡΙΘΜΟ, ΟΧΙ ΑΙΣΘΗΜΑ', () => {
  it('🔑 το κατώφλι είναι 1,25 — δηλαδή «χάνω πάνω από το 20% του ύψους»', () => {
    expect(MARK_BAND_ASPECT_THRESHOLD).toBe(1.25);
  });

  it.each([
    [1.0, false, 'τετράγωνο λογότυπο — δεν χάνει τίποτα'],
    [1.2, false, 'κάτω από το κατώφλι — μια ζώνη εδώ θα ήταν θόρυβος'],
    [1.25, false, 'ΑΚΡΙΒΩΣ στο κατώφλι: αυστηρή ανισότητα, το όριο ΔΕΝ ενεργοποιεί'],
    [1.3, true, 'πάνω από το κατώφλι'],
    [4.0, true, 'wordmark — η περίπτωση του περιστατικού'],
  ])('λογότυπο %s:1 ⇒ ζώνη=%s (%s)', (aspect, expected) => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `>` σε `>=` ⇒ κοκκινίζει **μόνο** η γραμμή του 1,25.
    //    Γύρνα το κατώφλι σε 10 ⇒ κοκκινίζουν οι δύο τελευταίες.
    expect(marksBand(logo(aspect))).toBe(expected);
  });

  it('🔴 ΚΑΘΕΤΟ λογότυπο ΔΕΝ είναι ζώνη — γεμίζει το ύψος και μένει στενό', () => {
    // ⚠️ Δεν υπάρχει δεύτερο κατώφλι κάτω από το 1, **επίτηδες**: σε τετράγωνο με
    //    `object-contain` ένα κάθετο σήμα δεν χάνει τίποτα. Η δοκιμή κλειδώνει την
    //    **απουσία** μηχανισμού — αλλιώς κάποιος θα τον «συμπλήρωνε» ως παράλειψη.
    expect(marksBand(logo(0.5))).toBe(false);
    expect(marksBand(logo(0.25))).toBe(false);
  });

  it('🔴 μηδενικές ή αρνητικές διαστάσεις ⇒ τετράγωνο, ΠΟΤΕ διαίρεση με μηδέν', () => {
    // 🔑 Δεν είναι αμυντικός κώδικας για φαντάσματα: το `width`/`height` έρχεται από
    //    **δημοσιευμένο έγγραφο**, γραμμένο από παλιότερες εκδόσεις του καθαριστή.
    expect(marksBand({ kind: 'logo', width: 0, height: 0 })).toBe(false);
    expect(marksBand({ kind: 'logo', width: 400, height: 0 })).toBe(false);
    expect(marksBand({ kind: 'logo', width: -400, height: -100 })).toBe(false);
  });
});

describe('Κ3 — 🔴 Η ΚΑΡΤΑ ΜΕΝΕΙ ΤΕΤΡΑΓΩΝΗ: Ο ΡΥΘΜΟΣ ΤΗΣ ΣΕΙΡΑΣ ΝΙΚΑ', () => {
  it('🔴 στην κάρτα, wordmark και τετράγωνο παίρνουν ΤΟ ΙΔΙΟ κουτί', () => {
    // 🔑 **Η υποχώρηση είναι ΔΗΛΩΜΕΝΗ, όχι παράλειψη**: μεταβλητό πλάτος στη σειρά
    //    σημαίνει ότι κάθε τίτλος ξεκινά σε άλλο `x`. Το κόστος (44×11 μελάνι) το
    //    πληρώνει η Φάση Β, όχι η παρουσίαση.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: δώσε στο `BAND_BOX.card` ελεύθερο πλάτος ⇒ κοκκινίζει.
    expect(markBox('card', logo(4))).toEqual(markBox('card', logo(1)));
  });

  it('🔴 στη ΣΕΛΙΔΑ, ο wordmark παίρνει ΑΛΛΟ κουτί — αλλιώς η αλλαγή δεν έγινε', () => {
    expect(markBox('page', logo(4))).not.toEqual(markBox('page', logo(1)));
  });
});

describe('Κ4 — 🔴 ΤΟ ΚΟΥΤΙ ΜΕΓΑΛΩΣΕ ΕΚΕΙ ΠΟΥ ΤΟ ΣΗΜΑ ΕΙΝΑΙ ΗΡΩΑΣ', () => {
  it('🔴 η σελίδα δεν είναι πια 64 — ήταν υποσημείωση δίπλα σε τίτλο 24px', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `page` τετράγωνο σε `h-16 w-16` *(η παλιά τιμή)* ⇒
    //    κοκκινίζει. Αυτή η γραμμή είναι η ίδια η ερώτηση του Giorgio.
    expect(markBox('page', logo(1)).className).toContain('h-24');
    expect(markBox('page', { kind: 'lettermark' }).className).toContain('h-24');
  });

  it('🔴 η ζώνη έχει ΕΛΕΥΘΕΡΟ πλάτος με ταβάνι — η σχολή «ίδιο ύψος, width:auto»', () => {
    const { className } = markBox('page', logo(4));

    expect(className).toContain('h-16');
    expect(className).toContain('w-auto');
    // ⚠️ Χωρίς ταβάνι, λογότυπο 10:1 θα άπλωνε 640px και θα έσπρωχνε την επωνυμία
    //    εκτός οθόνης σε κινητό.
    expect(className).toContain('max-w-[15rem]');
  });

  it('⚠️ ΚΑΜΙΑ κλάση κειμένου μέσα στις διαστάσεις — το `<img>` δεν γράφει ποτέ', () => {
    // 🔑 Το `text-*` ζει σε **χωριστό** πεδίο, γιατί μόνο το πλακίδιο το χρησιμοποιεί.
    for (const size of SIZES) {
      for (const subject of [logo(1), logo(4), { kind: 'lettermark' } as const]) {
        expect(markBox(size, subject).className).not.toMatch(/\btext-/);
        expect(markBox(size, subject).text).toMatch(/^text-/);
      }
    }
  });

  it('🔴 το πλακίδιο κρατά κείμενο ΠΑΝΩ από το κατώφλι WCAG των 18,66px', () => {
    // ⚠️ `text-xl` = 20px · `text-4xl` = 36px, και τα δύο με `font-bold` ⇒ «μεγάλο
    //    κείμενο», όπου το δανεισμένο 3:1 ισχύει. Ένα `text-sm` εδώ θα ακύρωνε
    //    σιωπηλά ολόκληρη τη μελέτη αντίθεσης του Α21.2.
    const ALLOWED = new Set(['text-xl', 'text-4xl']);

    for (const size of SIZES) {
      expect(ALLOWED.has(markBox(size, { kind: 'lettermark' }).text)).toBe(true);
    }
  });
});

describe('Κ5 — 🔴 ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ ΠΟΥ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΣΕΙ', () => {
  /**
   * 🔴 **ΜΕΤΑΚΟΜΙΣΕ ΑΠΟ ΤΟ `showcase-mark-view.test`, ΜΑΖΙ ΜΕ ΤΟΥΣ ΠΙΝΑΚΕΣ.** Η κλάση
   * είναι **Tailwind** (`h-11`), το `sizes` είναι **αριθμός σε px** (`44px`). Κανένας
   * τύπος δεν τα συνδέει: αν κάποιος αλλάξει το `h-24` σε `h-20` «για αισθητική», το
   * `sizes="96px"` γίνεται **ψέμα** — και ο περιηγητής, που το **πιστεύει**, κατεβάζει
   * μικρότερο παράγωγο και το τεντώνει. Θολούρα χωρίς κανένα σφάλμα πουθενά.
   *
   * ⚠️ **Διαβάζει το ωμό αρχείο**: οι δύο πίνακες είναι ιδιωτικοί, και μια εξαγωγή τους
   * μόνο και μόνο για τη δοκιμή θα διεύρυνε τη δημόσια επιφάνεια για χάρη της.
   */
  const RAW = fs.readFileSync(
    path.join(process.cwd(), 'src/components/mandate/showcase-mark-box.ts'),
    'utf8',
  );

  /** `card: { className: 'h-11 w-11', … sizesAttr: '44px' }` → μία γραμμή, δύο αριθμοί. */
  const ROW = /className: '([^']+)',\s*text: '[^']+',\s*sizesAttr: '(\d+)px'/g;

  /**
   * Το **πλάτος απόδοσης** που υπόσχεται η κλάση.
   *
   * - `w-11` ⇒ 11 × 4 = **44px** *(Tailwind: 1 μονάδα = 0,25rem = 4px)*
   * - `max-w-[15rem]` ⇒ 15 × 16 = **240px** — το ταβάνι είναι το χειρότερο σενάριο, και
   *   το `sizes` οφείλει να δηλώνει **το χειρότερο**: ένα μικρότερο νούμερο θα έδινε
   *   θολή εικόνα ακριβώς στο λογότυπο που απλώνεται περισσότερο.
   */
  function promisedWidth(className: string): number | null {
    const rem = /max-w-\[(\d+(?:\.\d+)?)rem\]/.exec(className);
    if (rem !== null) return Number(rem[1]) * 16;

    const unit = /\bw-(\d+)\b/.exec(className);
    return unit !== null ? Number(unit[1]) * 4 : null;
  }

  const rows = [...RAW.matchAll(ROW)];

  it('🔑 η άγκυρα ΒΛΕΠΕΙ τα κουτιά — αλλιώς είναι πράσινο που δεν κοίταξε', () => {
    // ⚠️ Το μάθημα του «0 σημαίνει κανείς δεν κοίταξε»: 2 μεγέθη × 2 σχήματα.
    expect(rows).toHaveLength(4);
  });

  it('🔴 το `sizes` ΣΥΜΦΩΝΕΙ με το πλάτος που υπόσχεται η κλάση, σε ΚΑΘΕ κουτί', () => {
    for (const [, className, sizesAttr] of rows) {
      expect(promisedWidth(className)).toBe(Number(sizesAttr));
    }
  });

  it('🔑 κάθε `sizes` χωράει σε παράγωγο του ραφιού σε ΔΙΠΛΗ πυκνότητα', () => {
    // 🔑 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΠΙΑΣΕ ΤΟ ΕΥΡΗΜΑ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΑΛΛΑΓΗΣ.** Γράφτηκε με
    //    `LARGEST_DERIVATIVE = 256` *(το ράφι της εποχής)* και **κοκκίνισε αμέσως**:
    //    η ζώνη υπόσχεται 240 λογικά px, δηλαδή **480** σε 2×. Το ράφι απέκτησε
    //    βαθμίδα **512** ως συνέπεια — όχι το `sizes` μικρότερο νούμερο.
    //
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το 512 από το `SHOWCASE_SHELF` ⇒ ξανακοκκινίζει.
    const LARGEST_DERIVATIVE = 512;

    for (const [, , sizesAttr] of rows) {
      expect(Number(sizesAttr) * 2).toBeLessThanOrEqual(LARGEST_DERIVATIVE);
    }
  });
});

describe('🏆 Κ6 — Ο ΑΕΡΑΣ ΤΗΣ ΦΑΣΗΣ Β: ΓΕΩΜΕΤΡΙΑ, ΚΑΙ ΜΟΝΟ ΟΠΟΥ ΤΡΙΒΕΤΑΙ (Α21.10)', () => {
  // Ο καθαριστής κόβει πλέον το ΛΟΓΟΤΥΠΟ στο μελάνι του. Μελάνι που ακουμπά την άκρη
  // ενός `rounded-lg` χάνει τις γωνίες του ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΚΑΜΠΥΛΗ — δηλαδή η Φάση Β θα
  // είχε βελτιώσει το μέγεθος και χαλάσει το σχήμα.

  it('🔴 ΚΑΘΕ λογότυπο παίρνει αέρα, σε κάθε μέγεθος και σε ζώνη ή τετράγωνο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `needsClearSpace` σε `() => false` ⇒ κοκκινίζει.
    for (const size of SIZES) {
      for (const aspect of [1, 4]) {
        expect(markBox(size, logo(aspect)).clearSpace).toMatch(/^p-/);
      }
    }
  });

  it('🔴 το ΠΟΡΤΡΕΤΟ ΔΕΝ παίρνει — εσοχή σε κύκλο αφήνει δαχτυλίδι γύρω από πρόσωπο', () => {
    for (const size of SIZES) {
      expect(markBox(size, { kind: 'portrait', width: 100, height: 100 }).clearSpace).toBe('');
    }
  });

  it('🔴 ούτε το ΠΛΑΚΙΔΙΟ ΑΡΧΙΚΩΝ — το κείμενο δεν έχει γωνίες να κοπούν', () => {
    for (const size of SIZES) {
      expect(markBox(size, { kind: 'lettermark' }).clearSpace).toBe('');
    }
  });

  it('🔑 ο αέρας είναι ΞΕΧΩΡΙΣΤΟ πεδίο — δεν μολύνει τις διαστάσεις', () => {
    // Ίδιο ιδίωμα με το `text`/`sizesAttr`: κάθε πεδίο, ο καταναλωτής του. Το πλακίδιο
    // αρχικών γράφει κείμενο και ΔΕΝ διαβάζει `clearSpace`· η εικόνα το αντίστροφο.
    for (const size of SIZES) {
      expect(markBox(size, logo(4)).className).not.toMatch(/\bp-/);
    }
  });

  it('🏆 ο αριθμός ΚΑΛΥΠΤΕΙ τη γεωμετρία της καμπύλης — δεν διαλέχτηκε στο περίπου', () => {
    // `rounded-lg` = `var(--radius)` = 0.5rem = 8px. Ορθογώνιο μέσα σε στρογγυλεμένο
    // πλαίσιο ακτίνας r χρειάζεται εσοχή r·(1 − 1/√2) για να μην του κοπούν οι γωνίες.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κατέβασε το `MARK_CLEAR_SPACE` σε `p-0.5` (2px) ⇒ κοκκινίζει.
    const RADIUS_PX = 8;
    const REQUIRED_INSET_PX = RADIUS_PX * (1 - 1 / Math.SQRT2);
    const TAILWIND_SPACING_PX = 4; // η κλίμακα: p-1 = 0.25rem = 4px

    const declared = markBox('page', logo(4)).clearSpace;
    const step = Number(declared.replace('p-', ''));

    expect(step * TAILWIND_SPACING_PX).toBeGreaterThanOrEqual(REQUIRED_INSET_PX);
  });
});
