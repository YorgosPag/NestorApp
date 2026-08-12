/**
 * 🔴 **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΚΑΡΤΩΝ** — ADR-777 §8.21 · SPEC-777D §26.9.
 *
 * ── ΤΙ ΦΥΛΑΝΕ ──
 *
 * Μέχρι τις 2026-08-11 το ερώτημα «**πόσες στήλες έχει ένας κατάλογος καρτών;**» είχε **πέντε**
 * απαντήσεις: τέσσερις ιδιωτικές σκάλες breakpoint (που διαφωνούσαν μεταξύ τους) και μία
 * επιφάνεια που δεν απαντούσε καθόλου — απέδιδε **και τις δύο** τιμές του `viewMode` σε κάθετη
 * στοίβα μιας στήλης, μέσα σε δοχείο καθηλωμένο στα 640 px. Η **δηλωμένη** αυθεντία
 * (`gridPatterns.cards`) είχε **μηδέν καταναλωτές** — αδρανής φρουρός, ADR-749 §5.
 *
 * Καμία υπάρχουσα πύλη δεν το έβλεπε: το CHECK 3.28 (jscpd) ψάχνει **ίδιο** κώδικα, και εδώ οι
 * πέντε γραφές ήταν **διαφορετικές**· τα CHECK 3.26/3.38/3.42 κρίνουν **χρώμα**. Μια απόκλιση
 * που κανένα όργανο δεν ρωτά ζει για πάντα.
 *
 * 🔑 **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΠΥΛΗ, ΟΧΙ ΣΧΟΛΙΟ.** Από το **CHECK 3.54 / ADR-783** η σουίτα jest
 * τρέχει **άνευ όρων** και **μπλοκάρει**. Πριν από αυτό, 3.289 άγκυρες έτρεχαν σε κάθε PR και
 * καμία δεν μπορούσε να κοκκινίσει τίποτα.
 *
 * ── ⚠️ ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ ΚΑΙ ΤΙ ΟΧΙ — δηλωμένο, όχι υπονοούμενο (Π4) ──
 *
 * Το **jsdom δεν έχει διάταξη**: δεν λύνει `grid`, δεν αποτιμά `minmax()`, κάθε πλάτος είναι 0.
 * Άρα εδώ αποδεικνύεται η **απόφαση** — ποια δήλωση γράφεται, ποιος αριθμός υπάρχει, ποιος
 * ρωτά ποιον — **όχι** η γεωμετρία, που είναι του περιηγητή εξ ορισμού. Τη γεωμετρία την
 * αποδεικνύει η **ζωντανή** μέτρηση (SPEC-777D §26.9.4).
 * **Εξαίρεση:** η `Κ8` δεν ρωτά το jsdom — ρωτά **το ίδιο το Tailwind**, και είναι η μόνη που
 * αποδεικνύει ότι οι κλάσεις **γίνονται CSS** αντί να είναι νεκρό γράμμα.
 *
 * ── ⚠️ Π1 — ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΔΩ ΚΑΜΙΑ ΠΛΗΡΗΣ ΑΠΑΓΟΡΕΥΜΕΝΗ ΚΛΑΣΗ ──
 *
 * Τα αρχεία κάτω από `src/features/**` **σαρώνονται από το Tailwind** (`tailwind.config.ts`
 * content). Ένα literal με πλήρη κλάση-σκάλα μέσα σε αυτό το αρχείο θα γινόταν **αληθινό CSS** —
 * δηλαδή το test που απαγορεύει τη σκάλα θα την **παρήγαγε**. Γι' αυτό τα μοτίβα παρακάτω είναι
 * **regex με εναλλαγή**, ποτέ έγκυρο όνομα κλάσης. Ίδιο μάθημα με το σχόλιο που έγινε ζωντανός
 * κανόνας και γύρισε **κάθε** διαδρομή σε 500.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { gridPatterns } from '@/styles/design-tokens';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const SRC = join(REPO_ROOT, 'src');

/** Ο SSoT και οι τέσσερις κατάλογοι που τον καταναλώνουν. */
const CATALOGS = [
  'src/features/property-grid/PropertyGridView.tsx',
  'src/components/space-management/ParkingPage/ParkingGridView.tsx',
  'src/components/space-management/StoragesPage/StorageGridView.tsx',
  'src/components/property-viewer/PropertyGrid.tsx',
] as const;

/**
 * ⚠️ Π2 — ο σαρωτής **δεν επιτρέπεται να μετρά σχόλια**: αλλιώς κάθε αρχείο που **εξηγεί** το
 * λάθος **είναι** το λάθος, και η τεκμηρίωση γίνεται παραβίαση.
 */
const withoutComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), 'utf8');

/** Κάθε `.ts`/`.tsx` του `src/`, χωρίς `node_modules`. */
function walkSource(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkSource(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Κάθε αρχείο του `src/` που **μπορεί να δηλώσει πλέγμα** — `.ts` · `.tsx` **και
 * `.css`**.
 *
 * ⚠️ **Το `.css` ΔΕΝ είναι πληρότητα για την πληρότητα.** Οι τρεις διάλεκτοι
 * (Tailwind arbitrary · CSS-in-JS · CSS module) καταλήγουν στο **ίδιο**
 * μεταγλωττισμένο stylesheet — ο διαχωρισμός υπάρχει **μόνο στην πηγή**. Ένας
 * σαρωτής που διαβάζει μόνο TypeScript είναι **δομικά τυφλός** στο ένα τρίτο του
 * ερωτήματος. Το ίδιο μάθημα πληρώθηκε μετρημένα στο CHECK 3.50.
 */
function walkStyleSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkStyleSources(full, out);
    else if (/\.(?:tsx?|css)$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * ⚠️ **Στο CSS το `//` ΔΕΝ είναι σχόλιο.** Ο γενικός `withoutComments` κόβει και
 * `//…` — σε `.css` αυτό ακρωτηριάζει κάθε γραμμή με `url(https://…)` και μπορεί
 * να **εξαφανίσει** δήλωση που ακολουθεί. Δύο γλώσσες, δύο γραμματικές σχολίων.
 */
const stripComments = (text: string, isCss: boolean): string =>
  isCss ? text.replace(/\/\*[\s\S]*?\*\//g, '') : withoutComments(text);

// ═══════════════════════════════════════════════════════════════════════════
// Κ1-Κ2 — Η ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ ΕΓΓΕΝΟΥΣ ΚΑΤΑΛΟΓΟΥ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ1-Κ2 · η γραμματική του εγγενούς καταλόγου', () => {
  const tracks = [gridPatterns.cards.media, gridPatterns.cards.tile, gridPatterns.cards.chip];

  it.each(tracks)(
    'Κ1 · %s χρησιμοποιεί auto-fill, ΠΟΤΕ auto-fit',
    (track) => {
      // Το `auto-fit` ΣΥΜΠΤΥΣΣΕΙ τις κενές στήλες: με ΕΝΑ ακίνητο σε οθόνη 2560 px, εκείνη η
      // μία κάρτα τεντώνεται σε 2560 px. Για κατάλογο η σωστή απάντηση είναι πάντα auto-fill.
      expect(track).toContain('auto-fill');
      expect(track).not.toContain('auto-fit');
    },
  );

  it.each(tracks)(
    'Κ2 · %s έχει τον φρουρό min(100%%,…) — αλλιώς το πλέγμα ξεχειλίζει στο κινητό',
    (track) => {
      // Χωρίς αυτό, όταν το δοχείο είναι στενότερο από το ελάχιστο, η στήλη μένει στο ελάχιστο
      // και το πλέγμα ξεχειλίζει οριζόντια — ακριβώς η βλάβη που υποτίθεται ότι λύνουμε.
      expect(track).toMatch(/minmax\(min\(100%,/);
    },
  );

  it('Κ2β · η «λίστα» είναι μία στήλη, με τον ΙΔΙΟ μηχανισμό πλέγματος', () => {
    expect(gridPatterns.cards.single).toBe('grid-cols-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ3 — ΚΑΘΕ ΑΡΙΘΜΟΣ ΑΚΡΙΒΩΣ ΜΙΑ ΦΟΡΑ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ3 · κάθε ελάχιστο εμφανίζεται ΑΚΡΙΒΩΣ ΜΙΑ ΦΟΡΑ σε όλο το src/', () => {
  it('Κ3 · καμία δεύτερη γραφή του ίδιου αριθμού', () => {
    const sources = walkSource(SRC);
    const occurrences = new Map<string, string[]>();

    for (const file of sources) {
      const text = withoutComments(readFileSync(file, 'utf8'));
      for (const m of text.matchAll(/repeat\(auto-fill,minmax\(min\(100%,([^)]+)\)/g)) {
        const rel = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/');
        occurrences.set(m[1], [...(occurrences.get(m[1]) ?? []), rel]);
      }
    }

    // ΤΡΕΙΣ οικογένειες καρτών ⇒ τρία ελάχιστα, το καθένα σε ΜΙΑ θέση (ADR-784 §10).
    expect([...occurrences.keys()].sort()).toEqual(['10rem', '15rem', '20rem']);
    for (const [min, files] of occurrences) {
      expect(`${min}: ${files.join(', ')}`).toBe(
        `${min}: src/styles/design-tokens/modules/layout.ts`,
      );
    }
  });

  it('Κ3β · τα τρία ελάχιστα ΔΙΑΦΕΡΟΥΝ — τρεις οικογένειες καρτών, μετρημένο', () => {
    // Η κάρτα με εικόνα 192 px, το συμπαγές πλακίδιο και το τσιπάκι εικονιδίου-και-ετικέτας
    // ΔΕΝ έχουν το ίδιο δάπεδο. Μια σύμπτυξη σε έναν αριθμό θα ήταν ισοπέδωση.
    const minima = [gridPatterns.cards.media, gridPatterns.cards.tile, gridPatterns.cards.chip];
    expect(new Set(minima).size).toBe(minima.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ3γ — 🔴 ΤΟ ΤΡΙΤΟ ΕΛΑΧΙΣΤΟ ΗΤΑΝ ΑΝΑΓΚΗ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ (ADR-784 §10)
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ3γ · το τσιπάκι αναπαράγει τη σκάλα που έστειλε ο σχεδιαστής', () => {
  /**
   * Ο κανόνας του `repeat(auto-fill, minmax(X, 1fr))`: χωράνε `n` στήλες όσο
   * `n·X + (n−1)·gap ≤ container`, δηλαδή `n = ⌊(container + gap) / (X + gap)⌋`.
   *
   * ⚠️ Αυτό είναι **αριθμητική**, όχι διάταξη — το jsdom δεν λύνει `grid` (Π4). Αποδεικνύει
   * ότι ο **αριθμός** που διαλέχτηκε είναι ο σωστός· ότι η μηχανή τον εφαρμόζει το αποδεικνύει
   * η ζωντανή μέτρηση.
   */
  const columns = (containerPx: number, minPx: number, gapPx: number): number =>
    Math.floor((containerPx + gapPx) / (minPx + gapPx));

  /**
   * ⚠️ **ΥΠΟΛΟΓΙΖΕΤΑΙ ΜΕΣΑ ΣΤΟ TEST, ΠΟΤΕ ΣΕ ΕΠΙΠΕΔΟ `describe`.** Η πρώτη γραφή το έκανε στο
   * σώμα του `describe` και μια άσχετη μετάλλαξη (αφαίρεση του φρουρού `min(100%)`) **σκότωνε
   * ολόκληρη τη σουίτα** με «Test suite failed to run»: η μετάλλαξη πιανόταν, αλλά **καμία
   * ονομασμένη άγκυρα δεν το έλεγε**, δηλαδή το test έχανε ακριβώς την ιδιότητα για την οποία
   * υπάρχει — να ονομάζει τι έσπασε. Το έπιασε η μετάλλαξη `Μμ3`.
   */
  const minPx = (track: string): number => {
    const m = track.match(/min\(100%,(\d+)rem\)/);
    return m ? Number(m[1]) * 16 : Number.NaN;
  };

  const GAP = 8; // `gap-2`, το κενό που ήδη χρησιμοποιούν τα πλέγματα των επιλογέων

  it.each([
    [344, 2], // κινητό — η σκάλα έλεγε `grid-cols-2`
    [600, 3], // σκαλί `sm` — η σκάλα έλεγε `sm:grid-cols-3`
    [800, 4], // σκαλί `lg` — η σκάλα έλεγε `lg:grid-cols-4`
  ])('Κ3γ · δοχείο %i px ⇒ %i στήλες, ΑΚΡΙΒΩΣ όσες έλεγε η σκάλα', (container, expected) => {
    expect(columns(container, minPx(gridPatterns.cards.chip), GAP)).toBe(expected);
  });

  it('Κ3γβ · το ΠΛΑΚΙΔΙΟ θα κατέρρεε σε μία στήλη στο κινητό — γι΄ αυτό χρειάστηκε τρίτο', () => {
    // Η απόδειξη ότι ο τρίτος αριθμός δεν είναι γούστο: το υπάρχον ελάχιστο δίνει ΜΙΑ στήλη
    // εκεί που ο σχεδιαστής έστειλε δύο, δηλαδή ένα τσιπάκι με εικονίδιο 40 px θα έπιανε
    // ολόκληρη τη γραμμή του κινητού.
    expect(columns(344, minPx(gridPatterns.cards.tile), GAP)).toBe(1);
    expect(columns(344, minPx(gridPatterns.cards.chip), GAP)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ4 — ΤΟ `full` ΣΥΝΤΙΘΕΤΑΙ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ4 · οι σύνθετες μορφές ΣΥΝΤΙΘΕΝΤΑΙ, δεν ξαναγράφονται', () => {
  it('Κ4 · το full περιέχει αυτούσια τη σταθερά, όχι αντίγραφό της', () => {
    expect(gridPatterns.cards.full).toContain(gridPatterns.cards.media);
    expect(gridPatterns.cards.full).toContain(gridPatterns.cards.gap);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ5 — 🔴 Η ΠΥΛΗ: ΚΑΜΙΑ ΙΔΙΩΤΙΚΗ ΣΚΑΛΑ ΣΕ ΚΑΝΕΝΑΝ ΚΑΤΑΛΟΓΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ5 · κανένας κατάλογος δεν δηλώνει δική του σκάλα', () => {
  /**
   * ⚠️ Π1 — regex με εναλλαγή, **ποτέ** έγκυρο όνομα κλάσης: αλλιώς αυτό το αρχείο θα παρήγαγε
   * ακριβώς την κλάση που απαγορεύει.
   */
  const PRIVATE_LADDER = /\b(?:sm|md|lg|xl|2xl):grid-cols-\d/;

  it.each(CATALOGS)('Κ5 · %s ρωτά τον SSoT, όχι το παράθυρο', (rel) => {
    const code = withoutComments(read(rel));
    expect(code).not.toMatch(PRIVATE_LADDER);
    expect(code).toContain('gridPatterns.cards');
  });

  it('Κ5β · η καθήλωση των 640 px έφυγε από τον κατάλογο ακινήτων', () => {
    // Ήταν η ΜΟΝΗ καθήλωση πλάτους σε όλη την περιοχή — μεμονωμένη ανωμαλία: σε οθόνη 2560 px
    // ο χρήστης έβλεπε 640 px στη μέση και 1920 px κενό.
    expect(withoutComments(read(CATALOGS[0]))).not.toContain('max-w-screen-sm');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ6 — Η ΓΕΩΜΕΤΡΙΑ ΣΤΟ CSS, Η ΕΠΙΛΟΓΗ ΣΤΗΝ ΚΑΤΑΣΤΑΣΗ (§26.7)
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ6 · δύο ερωτήματα, δύο μηχανισμοί', () => {
  const view = () => withoutComments(read(CATALOGS[0]));

  it('Κ6 · το «ποια κάρτα;» το απαντά το viewMode — κατάσταση τομέα', () => {
    expect(view()).toMatch(
      /viewMode === 'grid'\s*\?\s*gridPatterns\.cards\.media\s*:\s*gridPatterns\.cards\.single/,
    );
  });

  it('Κ6β · το «πόσες στήλες;» ΔΕΝ περνά από μέτρηση JavaScript', () => {
    // Η γεωμετρία σε JS θα σήμαινε ότι ο διακομιστής πρέπει να μαντέψει, και η μία από τις δύο
    // μερίδες κοινού θα έβλεπε πλήρη αναδιάταξη μετά την ενυδάτωση (Α19: CLS < 0,1).
    // Με τη γεωμετρία στο CSS το CLS είναι μηδέν ΕΚ ΚΑΤΑΣΚΕΥΗΣ.
    expect(view()).not.toMatch(/useViewportClass|useIsMobile|window\.innerWidth|matchMedia/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ7 — Η ΑΥΘΕΝΤΙΑ ΕΠΑΨΕ ΝΑ ΕΙΝΑΙ ΑΔΡΑΝΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ7 · η δηλωμένη αυθεντία έχει καταναλωτές', () => {
  it('Κ7 · και οι τέσσερις αρχικοί κατάλογοι τη ρωτούν', () => {
    // Ένας φρουρός που δεν τον καλεί κανείς είναι σχόλιο (ADR-749 §5 — 606 αδρανείς).
    const consumers = CATALOGS.filter((rel) => read(rel).includes('gridPatterns.cards'));
    expect(consumers).toHaveLength(CATALOGS.length);
  });

  /**
   * 🔴 **Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΤΩΝ 44 (ADR-784 §10).** Ο αριθμός **δεν** καρφώνεται: μια χειρόγραφη
   * λίστα καταναλωτών θα ήταν **δεύτερη αυθεντία** που αποκλίνει σιωπηλά (σχήμα των δύο
   * λιστών namespace του CHECK 3.34, που είχαν αποκλίνει κατά 63). Η άγκυρα ρωτά **τον δίσκο**
   * και απαιτεί τάξη μεγέθους: αν οι καταναλωτές πέσουν κάτω από 20, κάποιος ξήλωσε τη
   * μετανάστευση χωρίς να το πει.
   */
  it('Κ7β · η αυθεντία έχει ΔΕΚΑΔΕΣ καταναλωτές μετά τη μετανάστευση', () => {
    const consumers = walkSource(SRC).filter(
      (f) => withoutComments(readFileSync(f, 'utf8')).includes('gridPatterns.cards'),
    );
    expect(consumers.length).toBeGreaterThanOrEqual(20);
  });

  /**
   * 🔴 **ΤΟ ΠΛΕΓΜΑ ΠΟΛΥΜΕΣΩΝ ΤΟΥ SHOWCASE ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΠΕΝΤΕ ΦΟΡΕΣ.** Τέσσερα ιδιωτικά
   * `MediaGrid` (ένα ανά showcase client) συν το `ShowcasePhotoGrid` — και ο τύπος δεδομένων
   * τους ήταν **ήδη** ένας (ADR-698), δηλαδή η αιτία της αντιγραφής είχε ήδη εξαλειφθεί.
   */
  it('Κ7γ · κανένα ιδιωτικό αντίγραφο του πλέγματος πολυμέσων δεν επέζησε', () => {
    const offenders = walkSource(SRC).filter(
      (f) => /function\s+MediaGrid\s*\(/.test(withoutComments(readFileSync(f, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ8 — 🔴 ΟΙ ΚΛΑΣΕΙΣ ΓΙΝΟΝΤΑΙ ΠΡΑΓΜΑΤΙΚΟ CSS (ρωτά το ΙΔΙΟ το Tailwind)
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ8 · οι κλάσεις του καταλόγου ΓΙΝΟΝΤΑΙ CSS', () => {
  /**
   * 🔑 Η **μόνη** άγκυρα που δεν ρωτά το jsdom. Ο σαρωτής του Tailwind διαβάζει **κείμενο
   * πηγής**: μια αυθαίρετη τιμή που ο parser του **δεν** δέχεται δεν γίνεται ποτέ κανόνας, και
   * το πλέγμα καταρρέει σιωπηλά σε μία στήλη με **όλα τα υπόλοιπα tests πράσινα**. Το ίδιο
   * μάθημα με το container query που μετρούσε πάντα 384 px: «CSS που περνά σε test και είναι
   * νεκρό στην οθόνη».
   *
   * Χρησιμοποιείται **ελάχιστο** config επίτηδες: το ερώτημα είναι αν ο parser δέχεται τη
   * **γραμματική**, όχι τι περιέχει το πραγματικό θέμα.
   */
  it('Κ8 · ο parser του Tailwind δέχεται τη γραμματική και εκπέμπει grid-template-columns', async () => {
    const postcss = require('postcss');
    const tailwind = require('tailwindcss');

    const raw = `<div class="${gridPatterns.cards.media} ${gridPatterns.cards.tile} ${gridPatterns.cards.chip}"></div>`;
    const result = await postcss([
      tailwind({ content: [{ raw, extension: 'html' }], theme: {}, plugins: [] }),
    ]).process('@tailwind utilities;', { from: undefined });

    const emitted = result.css.match(/grid-template-columns:[^;}]+/g) ?? [];
    expect(emitted).toHaveLength(3);
    for (const rule of emitted) {
      expect(rule).toContain('auto-fill');
      expect(rule).toMatch(/min\(100%/);
    }
  }, 30_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ9 — 🔴 Ο ΦΡΟΥΡΟΣ ΓΙΑ ΤΗΝ **ΚΛΑΣΗ**, ΟΧΙ ΓΙΑ ΤΙΣ ΤΡΕΙΣ ΣΤΑΘΕΡΕΣ
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔑 **ΓΙΑΤΙ ΤΟ Κ2 ΔΕΝ ΑΡΚΟΥΣΕ.** Το Κ2 ρωτά τις **τρεις σταθερές του SSoT** — τις
// μόνες που κανείς δεν πρόκειται να ξαναγράψει λάθος, ακριβώς επειδή τις φυλάει.
// Το εγγενές μοτίβο όμως γράφεται **οπουδήποτε**: μετρήθηκαν **τέσσερις** ζωντανές
// δηλώσεις χωρίς φρουρό, σε τρία αρχεία που καμία πύλη δεν κοίταζε — και το ίδιο το
// ADR-777 §8.21.6 τις δήλωσε ανοιχτές γράφοντας «**13**», αριθμό που η μέτρηση της
// 2026-08-11 ανέτρεψε (ADR-784 §8 #4).
//
// Ένας φρουρός που φυλάει τρία σημεία και αγνοεί τα υπόλοιπα **δεν είναι πύλη,
// είναι δείγμα**. Η πέμπτη δήλωση γράφεται αύριο.
//
// ⚠️ **Π1 ΞΑΝΑ, ΚΑΙ ΑΥΤΗ ΤΗ ΦΟΡΑ ΥΠΕΡ ΜΑΣ**: τα μοτίβα παρακάτω είναι **regex με
// διαφυγές** (`repeat\(` — τα ψηφία `r,e,p,e,a,t,\,(`). Στο **κείμενο** αυτού του
// αρχείου η ακολουθία `repeat(` **δεν εμφανίζεται ποτέ**, άρα ούτε το Tailwind
// παράγει κλάση ούτε ο ίδιος ο σαρωτής βρίσκει τον εαυτό του. Η διαφυγή είναι η
// **αιτία** που το αρχείο δεν αυτοκαταγγέλλεται — όχι σύμπτωση.

describe('Κ9 · ΚΑΘΕ εγγενής κατάλογος του src/ έχει τον φρουρό — κλειστή λογιστική', () => {
  /**
   * Επιστρέφει το **πρώτο όρισμα** κάθε `minmax()` που ζει μέσα σε
   * `repeat(auto-fill|auto-fit, …)`.
   *
   * ⚠️ **ΔΕΝ γίνεται με σκέτο regex.** Το ίδιο το όρισμα περιέχει παρενθέσεις
   * (`min(100%, 20rem)`), οπότε ένα `[^)]+` θα σταματούσε στην **εσωτερική**
   * παρένθεση και θα διάβαζε τον φρουρό ως «`min(100%`» — δηλαδή η πύλη θα
   * αποτύγχανε ακριβώς πάνω στη **σωστή** γραφή. Μετράμε βάθος.
   */
  const intrinsicMinima = (text: string): string[] => {
    const opener = /repeat\(\s*auto-fi(?:ll|t)\s*,\s*minmax\(/g;
    const minima: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = opener.exec(text)) !== null) {
      let depth = 0;
      let arg = '';
      for (let i = match.index + match[0].length; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          if (depth === 0) break;
          depth--;
        } else if (ch === ',' && depth === 0) break;
        arg += ch;
      }
      minima.push(arg.trim());
    }
    return minima;
  };

  /**
   * 🔶 **Η ΜΟΝΗ ΔΗΛΩΜΕΝΗ ΕΞΑΙΡΕΣΗ, ΜΕ ΛΟΓΟ.** Οι email clients (Outlook · Gmail)
   * **δεν στηρίζουν τη συνάρτηση `min()`** της CSS. Ένας φρουρός εκεί δεν θα ήταν
   * αυστηρότητα — θα ήταν κανόνας που **δεν φτάνει ποτέ στον παραλήπτη**.
   * (ADR-777 §8.21.6.)
   */
  const EMAIL_EXEMPT = 'src/services/email-templates.service.ts';

  /** ⛔ Ξένη περιοχή (άλλος ιδιοκτήτης) — **ονομάζεται**, δεν σιωπάται. */
  const isForeign = (rel: string): boolean => rel.startsWith('src/subapps/');

  const GUARDED = /^min\(\s*100%\s*,/;
  /** Ελάχιστο `0` δεν μπορεί να υπερχειλίσει — δεν χρειάζεται φρουρό. */
  const ZERO_MIN = /^0(?:px|rem|%)?$/;

  type Bucket =
    | 'guarded'
    | 'zero-min'
    | 'email-exempt'
    | 'foreign-subapp'
    | 'unguarded';

  /**
   * 🔴 **Ο ΤΑΞΙΝΟΜΗΤΗΣ ΕΠΙΣΤΡΕΦΕΙ ΟΝΟΜΑ ΚΑΤΑΣΤΑΣΗΣ, ΔΕΝ ΓΡΑΦΕΙ ΣΕ ΚΑΔΟ — ΚΑΙ
   * ΑΥΤΟ ΜΕΤΡΗΘΗΚΕ, ΔΕΝ ΠΡΟΤΙΜΗΘΗΚΕ.** Η πρώτη γραφή είχε αλυσίδα
   * `if / else if / else` που έσπρωχνε απευθείας στους κάδους, με το `Κ9β` να
   * φυλάει το άθροισμα. Η μετάλλαξη «**σβήσε τον τελευταίο κλάδο**» πέρασε
   * **ΠΡΑΣΙΝΗ**: ο κάδος `unguarded` είναι **κενός σήμερα**, οπότε το να πάψει
   * να γεμίζει δεν μετακινεί κανένα άθροισμα — ο φρουρός της λογιστικής **δεν
   * μπορούσε να ασκηθεί ακριβώς εκεί που είχε σημασία**. Είναι το μάθημα `Μμ7`
   * του CHECK 3.39: *κάδος που δηλώνεται αλλά δεν ασκείται ποτέ είναι φρουρός
   * χωρίς απόδειξη ζωής, και το «0» του διαβάζεται ως «κοίταξα»*.
   *
   * Με τον ταξινομητή να **επιστρέφει** `Bucket` και το `push` να γίνεται
   * **πάντα**, η σιωπηλή απόρριψη δεν φυλάσσεται — γίνεται **δομικά αδύνατη**:
   * κάθε μονοπάτι οφείλει να επιστρέψει όνομα, και το απαιτεί ο μεταγλωττιστής.
   * *Ένας φρουρός που δεν μπορεί να ασκηθεί αντικαθίσταται από κατασκευή που δεν
   * τον χρειάζεται — δεν κρατιέται για διακόσμηση.*
   */
  const classify = (rel: string, min: string): Bucket => {
    if (GUARDED.test(min)) return 'guarded';
    if (ZERO_MIN.test(min)) return 'zero-min';
    if (rel === EMAIL_EXEMPT) return 'email-exempt';
    if (isForeign(rel)) return 'foreign-subapp';
    return 'unguarded';
  };

  const census = (): { total: number; buckets: Record<Bucket, string[]> } => {
    const buckets: Record<Bucket, string[]> = {
      guarded: [],
      'zero-min': [],
      'email-exempt': [],
      'foreign-subapp': [],
      unguarded: [],
    };
    let total = 0;

    for (const file of walkStyleSources(SRC)) {
      const rel = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/');
      const text = stripComments(readFileSync(file, 'utf8'), rel.endsWith('.css'));

      for (const min of intrinsicMinima(text)) {
        total++;
        buckets[classify(rel, min)].push(`${rel} → minmax(${min}, …)`);
      }
    }
    return { total, buckets };
  };

  it('Κ9 · καμία δική μας δήλωση χωρίς τον φρουρό min(100%,…)', () => {
    // ⚠️ Η αποτυχία ΟΝΟΜΑΖΕΙ αρχείο και ελάχιστο — μια πύλη που λέει μόνο «κόκκινο»
    // στέλνει τον επόμενο να ψάξει, και τότε παρακάμπτεται.
    expect(census().buckets.unguarded).toEqual([]);
  });

  it('Κ9β · η λογιστική ΚΛΕΙΝΕΙ — καμία δήλωση δεν χάνεται σιωπηλά', () => {
    // Ένα άθροισμα που δεν κλείνει σημαίνει ότι ο ταξινομητής έχει σιωπηλή
    // απόρριψη, δηλαδή το «0 παραβιάσεις» θα μπορούσε να σημαίνει «δεν κοίταξα».
    const { total, buckets } = census();
    const counted = Object.values(buckets).reduce((n, list) => n + list.length, 0);
    expect(counted).toBe(total);
    expect(total).toBeGreaterThan(0); // ο σαρωτής βρίσκει ΚΑΤΙ — αλλιώς είναι νεκρός
  });

  it('Κ9γ · η εξαίρεση των email ισχύει για ΕΝΑ αρχείο, ονομασμένο', () => {
    // Μια εξαίρεση χωρίς όριο είναι ανοιχτή πόρτα: αν αύριο κάποιος επικαλεστεί
    // «email» σε δεύτερο αρχείο, το μαθαίνουμε εδώ και όχι στην οθόνη.
    const emails = census().buckets['email-exempt'];
    expect(emails.length).toBeGreaterThan(0);
    for (const entry of emails) expect(entry.startsWith(EMAIL_EXEMPT)).toBe(true);
  });

  it('Κ9δ · οι τρεις σταθερές του SSoT μετριούνται ως φρουρημένες', () => {
    // Βαθμονόμηση: αν ο σαρωτής δεν βλέπει τις τρεις που ΞΕΡΟΥΜΕ ότι είναι σωστές,
    // τότε το «καμία παραβίαση» του Κ9 δεν αποδεικνύει τίποτα.
    const guarded = census().buckets.guarded.filter((entry) =>
      entry.startsWith('src/styles/design-tokens/modules/layout.ts'),
    );
    expect(guarded).toHaveLength(3);
  });
});
