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

// ═══════════════════════════════════════════════════════════════════════════
// Κ1-Κ2 — Η ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ ΕΓΓΕΝΟΥΣ ΚΑΤΑΛΟΓΟΥ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ1-Κ2 · η γραμματική του εγγενούς καταλόγου', () => {
  const tracks = [gridPatterns.cards.media, gridPatterns.cards.tile];

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

    // Δύο οικογένειες καρτών ⇒ δύο ελάχιστα, το καθένα σε ΜΙΑ θέση.
    expect([...occurrences.keys()].sort()).toEqual(['15rem', '20rem']);
    for (const [min, files] of occurrences) {
      expect(`${min}: ${files.join(', ')}`).toBe(
        `${min}: src/styles/design-tokens/modules/layout.ts`,
      );
    }
  });

  it('Κ3β · τα δύο ελάχιστα ΔΙΑΦΕΡΟΥΝ — δύο οικογένειες καρτών, μετρημένο', () => {
    // Η κάρτα με εικόνα 192 px και το συμπαγές πλακίδιο χωρίς εικόνα ΔΕΝ έχουν το ίδιο δάπεδο.
    // Μια σύμπτυξη σε έναν αριθμό θα ήταν ισοπέδωση, όχι κεντρικοποίηση.
    expect(gridPatterns.cards.media).not.toBe(gridPatterns.cards.tile);
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
  it('Κ7 · και οι τέσσερις κατάλογοι τη ρωτούν', () => {
    // Ένας φρουρός που δεν τον καλεί κανείς είναι σχόλιο (ADR-749 §5 — 606 αδρανείς).
    const consumers = CATALOGS.filter((rel) => read(rel).includes('gridPatterns.cards'));
    expect(consumers).toHaveLength(CATALOGS.length);
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

    const raw = `<div class="${gridPatterns.cards.media} ${gridPatterns.cards.tile}"></div>`;
    const result = await postcss([
      tailwind({ content: [{ raw, extension: 'html' }], theme: {}, plugins: [] }),
    ]).process('@tailwind utilities;', { from: undefined });

    const emitted = result.css.match(/grid-template-columns:[^;}]+/g) ?? [];
    expect(emitted).toHaveLength(2);
    for (const rule of emitted) {
      expect(rule).toContain('auto-fill');
      expect(rule).toMatch(/min\(100%/);
    }
  }, 30_000);
});
