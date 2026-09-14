/**
 * @jest-environment jsdom
 *
 * @fileoverview **ΤΟ ΣΗΜΑ ΣΤΗΝ ΟΘΟΝΗ** — οι άγκυρες του ADR-841 §7 Α21.2.
 * @related components/mandate/ShowcaseMarkView.tsx · ADR-710 §10 (CHECK 3.32)
 *
 * 🔴 **Δύο από αυτές τις άγκυρες διαβάζουν το ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ**, και είναι απόφαση:
 * η κρίσιμη παγίδα *(κλάση Tailwind χτισμένη με παρεμβολή)* **δεν φαίνεται σε render**
 * — η jsdom θα έδειχνε χαρούμενα το `bg-[hsl(var(--chart-3))]` ως συμβολοσειρά κλάσης,
 * ενώ ο Tailwind **δεν θα είχε παραγάγει ούτε μία γραμμή CSS** γι' αυτό. Ένα test που
 * κοιτάζει **μόνο** το DOM είναι **δομικά ανίκανο** να πιάσει αυτό το σφάλμα.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';

import { ShowcaseMarkView } from '../ShowcaseMarkView';
import { lettermarkOf, SHOWCASE_MARK_SLOTS } from '@/lib/agency/showcase-mark';
import { SHOWCASE_MARK_ALT_KEYS } from '@/lib/agency/showcase-mark-kind';
import { SHOWCASE_MARK_FRAME } from '@/components/mandate/showcase-mark-frame';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

/**
 * ⚠️ **ΚΑΙ ΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ ΤΩΝ ΑΓΚΥΡΩΝ ΣΑΡΩΝΕΤΑΙ** — ζει κάτω από `src/components/`,
 * που είναι μέσα στο content glob του Tailwind. Ένα test που φυλά τον γείτονα και
 * αφήνει τον εαυτό του ακάλυπτο θα μπορούσε να ρίξει το stylesheet **γράφοντας το
 * αντιπαράδειγμα**.
 */
const RAW_SELF = fs.readFileSync(
  path.join(process.cwd(), 'src/components/mandate/__tests__/showcase-mark-view.test.tsx'),
  'utf8',
);

const RAW_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/components/mandate/ShowcaseMarkView.tsx'),
  'utf8',
);

/**
 * 🔑 **Η ΚΡΙΣΗ ΓΙΝΕΤΑΙ ΣΤΟΝ ΚΩΔΙΚΑ, ΟΧΙ ΣΤΗΝ ΠΡΟΖΑ** — ίδιο ιδίωμα με το
 * `stripComments` του CHECK 3.74 *(«ώστε ένα `as PublicListing` μέσα σε τεκμηρίωση
 * να μη μετρά»)*.
 *
 * 🔴 **Και το έμαθε εκτελώντας**: η πρώτη γραφή αυτού του αρχείου **κοκκίνισε στο ίδιο
 * της το σχόλιο** — η τεκμηρίωση του component γράφει το **αντιπαράδειγμα** αυτολεξεί,
 * για να διδάξει την παγίδα. Η θεραπεία **δεν** είναι να σβηστεί το αντιπαράδειγμα
 * *(θα έχανε ο επόμενος το μάθημα)*: είναι να ρωτά η άγκυρα **αυτό που εκτελείται**.
 */
const SOURCE = RAW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Α21.2 — το σήμα ΔΕΝ μιλά στον αναγνώστη οθόνης', () => {
  it('🔑 είναι aria-hidden: η επωνυμία είναι δίπλα, τα αρχικά θα ήταν θόρυβος', () => {
    const { container } = render(
      <ShowcaseMarkView mark={{ lettermark: { initials: 'ΠΥ', slot: 3 } }} size="card" />,
    );
    const mark = container.firstElementChild;
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('τα γράμματα υπάρχουν στο DOM (οπτικά), απλώς δεν εκφωνούνται', () => {
    render(<ShowcaseMarkView mark={{ lettermark: { initials: 'ΠΥ', slot: 3 } }} size="card" />);
    expect(screen.getByText('ΠΥ')).toBeInTheDocument();
  });
});

describe('Α21.2 — 🔴 Η ΠΑΓΙΔΑ TAILWIND: οι κλάσεις είναι ΓΡΑΜΜΕΝΕΣ, όχι παραγόμενες', () => {
  it.each(Array.from({ length: SHOWCASE_MARK_SLOTS }, (_, i) => i + 1))(
    'το χρώμα του slot %i υπάρχει ΑΥΤΟΛΕΞΕΙ στην πηγή',
    (slot) => {
      // ΜΕΤΑΛΛΑΞΗ: αντικατέστησε την οκτάδα με μια κλάση χτισμένη με παρεμβολή και
      // αυτές οι 8 γραμμές κοκκινίζουν. Χωρίς αυτές, η μετάλλαξη περνά ΠΡΑΣΙΝΗ και
      // το σήμα βγαίνει ΑΟΡΑΤΟ στην παραγωγή, χωρίς κανένα σφάλμα πουθενά.
      // ⚠️ **ΣΥΝΕΝΩΣΗ, ΟΧΙ ΠΑΡΕΜΒΟΛΗ** — και το έπιασε η αδελφή άγκυρα παρακάτω:
      // με template literal, ΑΥΤΗ η γραμμή γίνεται υποψήφια κλάση για τον Tailwind
      // (σαρώνει `./src/components/**`, **και τα tests**) και ρίχνει το stylesheet.
      expect(SOURCE).toContain('bg-[hsl(var(--chart-' + slot + '))]');
    },
  );

  /**
   * 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΡΩΤΑ ΤΟ **ΩΜΟ** ΚΕΙΜΕΝΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΜΑΘΗΜΑ ΤΗΣ ΗΜΕΡΑΣ.**
   *
   * Ο Tailwind **δεν διαβάζει JavaScript**: ταιριάζει υποψήφιες κλάσεις **οπουδήποτε
   * στο αρχείο, σχόλια συμπεριλαμβανομένων** *(`tailwind.config` → `./src/components/**`)*.
   * Όταν η τεκμηρίωση του component έγραψε το αντιπαράδειγμα **ακέραιο**, ο Tailwind
   * παρήγαγε άκυρο επιλογέα και **ΕΠΕΣΕ ΟΛΟ ΤΟ STYLESHEET** — `HTTP 500`,
   * *«Parsing CSS source code failed»*, μετρημένο στον φυλλομετρητή.
   *
   * ⚠️ **Γι' αυτό ΔΕΝ χρησιμοποιεί το `SOURCE`**: ένας έλεγχος που σβήνει πρώτα τα
   * σχόλια είναι **δομικά ανίκανος** να δει αυτή τη βλάβη — θα ήταν πράσινος ενώ η
   * εφαρμογή δεν σηκώνεται.
   */
  it.each([
    ['ShowcaseMarkView.tsx', RAW_SOURCE],
    ['showcase-mark-view.test.tsx', RAW_SELF],
  ])('🔴 το %s δεν κρύβει υποψήφια κλάση με παρεμβολή', (_name, raw) => {
    // 🔴 ΔΥΟ ΑΠΟΤΥΧΙΕΣ ΔΙΔΑΞΑΝ ΑΥΤΗ ΤΗ ΔΙΑΤΥΠΩΣΗ:
    //
    //  (1) Η πρώτη έψαχνε το κείμενο **σκέτο** και πέρασε ΠΡΑΣΙΝΗ ενώ η εφαρμογή
    //      γύριζε HTTP 500 — η βλάβη ήταν γραμμένη στην **ξεφευγμένη** μορφή, με
    //      ανάποδη κάθετο πριν από κάθε αγκύλη, που ο Tailwind δέχεται ΤΟ ΙΔΙΟ.
    //      ⇒ Γι' αυτό οι κάθετοι **φεύγουν πρώτα**: κρίνουμε ό,τι βλέπει ο Tailwind.
    //
    //  (2) Η δεύτερη απαιτούσε ψηφίο μετά από **κάθε** `--chart-` και κοκκίνιζε στην
    //      ίδια της την πρόζα. Πύλη που χτυπά σε σωστό κείμενο διδάσκει να την
    //      παρακάμπτουν (ο πήχης ≤10% ψευδώς θετικών της Google).
    //
    // ⇒ Ρωτά **ακριβώς το παρατηρημένο σφάλμα**: `$` ή `{` μέσα σε τιμή CSS
    //   («Unexpected token Delim('$')»), δηλαδή πρόθεμα κλάσης + παρεμβολή.
    const asTailwindSees = raw.split('\\').join('');

    expect(asTailwindSees).not.toMatch(/bg-\[hsl\(var\(--chart-[${]/);
  });

  it('η οκτάδα έχει ΑΚΡΙΒΩΣ όσα slots δηλώνει το lib', () => {
    const declared = SOURCE.match(/bg-\[hsl\(var\(--chart-\d\)\)\]/g) ?? [];
    expect(new Set(declared).size).toBe(SHOWCASE_MARK_SLOTS);
  });
});

describe('Α21.2 — το slot διαλέγει ΤΟ ΣΩΣΤΟ χρώμα (1-based, όχι 0-based)', () => {
  it.each([1, 4, 8])('slot %i ⇒ --chart-%i', (slot) => {
    const { container } = render(
      <ShowcaseMarkView mark={{ lettermark: { initials: 'ΑΒ', slot } }} size="card" />,
    );
    expect(container.firstElementChild?.className).toContain(`--chart-${slot}))]`);
  });

  it('🔴 κάθε πραγματικό σήμα βρίσκει χρώμα — ποτέ `undefined` κλάση', () => {
    for (let i = 0; i < 200; i += 1) {
      const mark = lettermarkOf(`comp_${i}`, 'Δοκιμαστική Εταιρεία');
      const { container } = render(<ShowcaseMarkView mark={{ lettermark: mark }} size="card" />);
      expect(container.firstElementChild?.className).toContain('bg-[hsl(var(--chart-');
    }
  });
});

describe('Α21.2 — 🔴 Ο ΟΡΟΣ ΤΟΥ ΔΑΝΕΙΣΜΕΝΟΥ 3:1 — ΜΕΓΑΛΟ, ΕΝΤΟΝΟ ΚΕΙΜΕΝΟ', () => {
  /**
   * Το CHECK 3.32 εγγυάται `--chart-N` vs `--card` ≥ **3:1**. Στο WCAG AA το 3:1 είναι
   * το κατώφλι **μεγάλου** κειμένου — δηλαδή **bold ≥18,66px**. Αν κάποιος μικρύνει τα
   * γράμματα «για αισθητική», η δανεισμένη εγγύηση **παύει να ισχύει σιωπηλά**.
   */
  it.each(['card', 'page'] as const)('το μέγεθος %s είναι bold και ≥ 20px', (size) => {
    const { container } = render(
      <ShowcaseMarkView mark={{ lettermark: { initials: 'ΑΒ', slot: 1 } }} size={size} />,
    );
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('font-bold');
    // text-xl = 20px · text-3xl = 30px — και τα δύο πάνω από το 18,66px.
    expect(className).toMatch(/\btext-(xl|2xl|3xl|4xl)\b/);
  });

  it('το κείμενο είναι η ΑΛΛΗ ΠΛΕΥΡΑ του μετρημένου ζεύγους (`--card`)', () => {
    const { container } = render(
      <ShowcaseMarkView mark={{ lettermark: { initials: 'ΑΒ', slot: 1 } }} size="card" />,
    );
    expect(container.firstElementChild?.className).toContain('text-[hsl(var(--card))]');
  });
});

// ===========================================================================
// ADR-841 §7 Α21, ΦΑΣΗ 2 — ΤΟ ΔΗΛΩΜΕΝΟ ΣΗΜΑ
// ===========================================================================

/**
 * Ένα δηλωμένο σήμα, όπως το γράφει ο **γραφέας** — τρία παράγωγα, όπως το ράφι.
 *
 * ⚠️ Τα πλάτη είναι της **πραγματικής** κλίμακας (`SHOWCASE_SHELF`): μια αυθαίρετη
 * τριάδα εδώ θα έκανε την άγκυρα του `sizes` να μετρά κόσμο που δεν υπάρχει.
 */
function declaredMark(kind: 'logo' | 'portrait'): DeclaredShowcaseMark {
  return {
    kind,
    image: {
      url: 'https://cdn.example/showcases/comp_1/abc.webp',
      width: 256,
      height: 256,
      altKey: SHOWCASE_MARK_ALT_KEYS[kind],
      sources: [
        { url: 'https://cdn.example/showcases/comp_1/abc-64.webp', width: 64 },
        { url: 'https://cdn.example/showcases/comp_1/abc-128.webp', width: 128 },
        { url: 'https://cdn.example/showcases/comp_1/abc-256.webp', width: 256 },
      ],
    },
  };
}

describe('🔴 Φάση 2 — Η ΕΙΚΟΝΑ ΜΙΛΑ, ΤΟ ΠΛΑΚΙΔΙΟ ΣΩΠΑΙΝΕΙ', () => {
  it('🔴 το δηλωμένο σήμα ΔΕΝ είναι aria-hidden — λέει κάτι που ο τίτλος ΔΕΝ λέει', () => {
    render(<ShowcaseMarkView mark={{ declared: declaredMark('portrait') }} size="card" />);

    // 🔑 Το `t()` των δοκιμών επιστρέφει το ίδιο το κλειδί· αρκεί για να αποδείξει ότι
    //    το `alt` **γεμίζει** και ότι το στοιχείο είναι **προσβάσιμο ως εικόνα**.
    const image = screen.getByRole('img');
    expect(image).not.toHaveAttribute('aria-hidden');
    expect(image.getAttribute('alt')).not.toBe('');
  });

  it('🔴 το alt ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΕΙΔΟΣ — δύο είδη, δύο διαφορετικοί ισχυρισμοί', () => {
    const { unmount } = render(
      <ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size="card" />,
    );
    const logoAlt = screen.getByRole('img').getAttribute('alt');
    unmount();

    render(<ShowcaseMarkView mark={{ declared: declaredMark('portrait') }} size="card" />);
    // ⚠️ Ένα κοινό «σήμα του επαγγελματία» θα ήταν αληθές και **άχρηστο**: ο άνθρωπος που
    //    ακούει την οθόνη χρειάζεται να ξέρει αν κοιτά λογότυπο ή **πρόσωπο κάποιου**.
    expect(screen.getByRole('img').getAttribute('alt')).not.toBe(logoAlt);
  });

  it('🔴 ΤΟ `sizes` ΥΠΑΡΧΕΙ ΚΑΙ ΕΙΝΑΙ ΣΕ px — αλλιώς ΟΛΗ η κλίμακα είναι νεκρή', () => {
    // Χωρίς `sizes`, ο περιηγητής υποθέτει `100vw` και κατεβάζει **πάντα** το 256w για
    // σήμα 44 εικονοστοιχείων.
    for (const [size, expected] of [
      ['card', '44px'],
      ['page', '96px'],
    ] as const) {
      const { unmount } = render(
        <ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size={size} />,
      );
      expect(screen.getByRole('img')).toHaveAttribute('sizes', expected);
      unmount();
    }
  });

  it('🔑 το `srcSet` έχει ΚΑΘΕ παράγωγο, με `w` descriptors', () => {
    render(<ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size="card" />);

    const srcSet = screen.getByRole('img').getAttribute('srcset') ?? '';
    expect(srcSet).toContain('64w');
    expect(srcSet).toContain('128w');
    expect(srcSet).toContain('256w');
  });

  it('🔴 ΤΟ ΣΧΗΜΑ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ SSoT: λογότυπο τετράγωνο/contain, πορτρέτο κύκλος/cover', () => {
    for (const kind of ['logo', 'portrait'] as const) {
      const { unmount } = render(
        <ShowcaseMarkView mark={{ declared: declaredMark(kind) }} size="card" />,
      );
      const className = screen.getByRole('img').className;
      // 🔑 Η σύγκριση γίνεται με τον **πίνακα**, ποτέ με γραμμένες κλάσεις: αν το SSoT
      //    αλλάξει νόμιμα, η άγκυρα ακολουθεί· αν η οθόνη αποκλίνει, κοκκινίζει.
      expect(className).toContain(SHOWCASE_MARK_FRAME[kind].shape);
      expect(className).toContain(SHOWCASE_MARK_FRAME[kind].fit);
      unmount();
    }
  });

  it('🔑 ΕΠΙΦΑΝΕΙΑ ΑΠΟ ΚΑΤΩ: το ράφι κρατά τη διαφάνεια, άρα η εικόνα χρειάζεται φόντο', () => {
    // 🔴 **Α21.15 — ΤΟ `bg-card` ΗΤΑΝ ΤΟ ΙΔΙΟ ΤΟ ΣΦΑΛΜΑ**: στο σκοτεινό θέμα, σκούρο
    //    λογότυπο σε διαφανές φόντο πάνω σε `--card` ήταν αόρατο *(μετρημένο στην
    //    παραγωγή)*. Η επιφάνεια έρχεται πλέον από το πλαίσιο, ανά είδος.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: ξαναγράψε σκέτο `bg-card` στο `<img>` ⇒ κοκκινίζει το λογότυπο.
    for (const kind of ['logo', 'portrait'] as const) {
      const { unmount } = render(
        <ShowcaseMarkView mark={{ declared: declaredMark(kind) }} size="card" />,
      );
      for (const cls of SHOWCASE_MARK_FRAME[kind].surface.split(' ')) {
        expect(screen.getByRole('img')).toHaveClass(cls);
      }
      unmount();
    }
  });

  it('🔴 Α21.15 — το ΛΟΓΟΤΥΠΟ κάθεται σε ΛΕΥΚΗ πλάκα, ανεξάρτητα από το θέμα', () => {
    render(<ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size="card" />);

    expect(screen.getByRole('img')).toHaveClass('bg-white');
    expect(screen.getByRole('img')).not.toHaveClass('bg-card');
  });

  it('🔴 ΠΟΤΕ ΤΑ ΔΥΟ ΜΑΖΙ: το πλακίδιο ΔΕΝ αποδίδεται όταν υπάρχει δηλωμένο σήμα', () => {
    const { container } = render(
      <ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size="card" />,
    );

    // 🔑 «ΕΝΑ σήμα ανά επαγγελματία»: η κάρτα έχει **μία** θέση για «ποιος είσαι;».
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});

describe('Α21.9 — 🔴 ΤΟ ΚΟΥΤΙ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΟΘΟΝΗ, ΟΧΙ ΜΟΝΟ ΩΣ ΤΗ ΣΥΝΑΡΤΗΣΗ', () => {
  /**
   * 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΤΟ `showcase-mark-box.test`.** Εκείνο κρίνει την
   * **απόφαση**· αυτό κρίνει ότι η απόφαση **φοριέται**. Οι δύο μπορούν να αποκλίνουν:
   * μια οθόνη που ξεχνά να περάσει `width`/`height`, ή που κρατά δική της κλάση ύψους,
   * θα άφηνε το SSoT πράσινο και τον επισκέπτη με το παλιό κουτί.
   *
   * ⚠️ **Οι πίνακες μεγεθών ΕΦΥΓΑΝ από το `ShowcaseMarkView`** — μαζί τους μετακόμισε
   * και η άγκυρα «κλάση ↔ `sizes`», που τώρα ζει στο `showcase-mark-box.test` (Κ5).
   */
  function wordmark(): DeclaredShowcaseMark {
    const mark = declaredMark('logo');
    return { ...mark, image: { ...mark.image, width: 256, height: 64 } };
  }

  it('🔴 wordmark 4:1 στη ΣΕΛΙΔΑ ⇒ ζώνη: ελεύθερο πλάτος και `sizes` 240px', () => {
    // 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΑΥΤΟΛΕΞΕΙ**: αυτή ακριβώς η εικόνα έδινε μελάνι 64×16.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: πάψε να περνάς `width`/`height` στο `markBox` *(δηλαδή
    //    ξαναγράψε το ως τετράγωνο)* ⇒ κοκκινίζει.
    render(<ShowcaseMarkView mark={{ declared: wordmark() }} size="page" />);

    const img = screen.getByRole('img');
    expect(img).toHaveClass('w-auto');
    expect(img).toHaveClass('max-w-[15rem]');
    expect(img).toHaveAttribute('sizes', '240px');
  });

  it('🔴 ΠΟΡΤΡΕΤΟ 4:1 στη σελίδα ⇒ ΤΕΤΡΑΓΩΝΟ: το είδος νικά την αναλογία', () => {
    const mark = declaredMark('portrait');
    const wide = { ...mark, image: { ...mark.image, width: 256, height: 64 } };

    render(<ShowcaseMarkView mark={{ declared: wide }} size="page" />);

    const img = screen.getByRole('img');
    expect(img).toHaveClass('h-24');
    expect(img).toHaveClass('w-24');
    expect(img).toHaveAttribute('sizes', '96px');
  });

  it('🔴 Α21.15 — στην ΚΑΡΤΑ ο wordmark παίρνει ΣΤΑΘΕΡΗ ζώνη 96×48, όχι τετράγωνο 44', () => {
    // 🔴 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ**: 512×122 σε 44×44 έδινε μελάνι 36×9 — «δεν φαίνεται».
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `BAND_BOX.card` σε `h-11 w-11` ⇒ κοκκινίζει.
    render(<ShowcaseMarkView mark={{ declared: wordmark() }} size="card" />);

    const img = screen.getByRole('img');
    expect(img).toHaveClass('h-12');
    expect(img).toHaveClass('w-24');
    expect(img).toHaveAttribute('sizes', '96px');
  });

  it('🔑 οι ΠΡΑΓΜΑΤΙΚΕΣ διαστάσεις φτάνουν στα χαρακτηριστικά — όχι σταθερό 96', () => {
    // ⚠️ Το `width`/`height` του `<img>` δεσμεύει χώρο πριν φορτώσει η εικόνα. Λάθος
    //    αναλογία εκεί = **τίναγμα διάταξης** (CLS) τη στιγμή που έρχονται τα bytes.
    render(<ShowcaseMarkView mark={{ declared: wordmark() }} size="page" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '256');
    expect(img).toHaveAttribute('height', '64');
  });
});

describe('Α21.10 — 🏆 Ο ΑΕΡΑΣ ΤΗΣ ΦΑΣΗΣ Β ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΟΘΟΝΗ', () => {
  /**
   * 🔴 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΤΟ `showcase-mark-box.test`** — ίδιο σκεπτικό με την
   * Α21.9: εκείνο κρίνει ότι η **απόφαση** παίρνεται, αυτό ότι **φοριέται**. Το
   * `clearSpace` είναι νέο πεδίο, και ένα πεδίο που κανείς δεν διαβάζει είναι σιωπηλά
   * ανενεργό: το SSoT θα έμενε πράσινο και το τριμμένο λογότυπο θα έχανε τις γωνίες του
   * στην καμπύλη του `rounded-lg`, χωρίς κανένα σφάλμα πουθενά.
   */
  it('🔴 το ΛΟΓΟΤΥΠΟ φοράει την εσοχή — αλλιώς το τριμμένο μελάνι κόβεται στην καμπύλη', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `box.clearSpace` από το `cn(...)` ⇒ κοκκινίζει.
    render(<ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size="page" />);

    expect(screen.getByRole('img').className).toMatch(/\bp-\d/);
  });

  it('🔴 το ΠΟΡΤΡΕΤΟ ΔΕΝ τη φοράει — δαχτυλίδι `bg-card` γύρω από πρόσωπο', () => {
    render(<ShowcaseMarkView mark={{ declared: declaredMark('portrait') }} size="page" />);

    expect(screen.getByRole('img').className).not.toMatch(/\bp-\d/);
  });

  it('🔴 και ΚΑΙ ΣΤΑ ΔΥΟ μεγέθη του λογοτύπου, γιατί η ακτίνα είναι η ίδια', () => {
    for (const size of ['card', 'page'] as const) {
      const { unmount } = render(
        <ShowcaseMarkView mark={{ declared: declaredMark('logo') }} size={size} />,
      );
      expect(screen.getByRole('img').className).toMatch(/\bp-\d/);
      unmount();
    }
  });
});
