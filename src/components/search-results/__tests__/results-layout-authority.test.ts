/**
 * 🔴 **ΟΙ ΔΕΣΜΟΙ ΑΝΑΜΕΣΑ ΣΤΟΥΣ ΔΥΟ ΜΗΧΑΝΙΣΜΟΥΣ** — SPEC-777D §26.7.
 *
 * Η οθόνη 2 απαντά **δύο** ερωτήματα με **δύο** μηχανισμούς: τη γεωμετρία το CSS (στο
 * πρώτο βάψιμο) και τη συμπεριφορά το `useViewportClass` (μετά τη μέτρηση). Αυτό είναι
 * σωστό **μόνο** όσο μοιράζονται **έναν** αριθμό και **ένα** λεξιλόγιο. Χωρίς αυτές τις
 * άγκυρες θα ήταν ακριβώς το σχήμα του ADR-749: δύο αλήθειες, καμία να ρωτά την άλλη.
 *
 * 🔑 **Ρωτιέται η ΑΥΘΕΝΤΙΑ, όχι ένα αντίγραφο**: το κατώφλι το απαντά το ίδιο το Tailwind
 * (`loadConfig` + `resolveConfig`, ~80 ms) και τα ύψη το ίδιο το `.module.css`. Ένας
 * πίνακας εδώ θα ήταν τρίτη αλήθεια — και θα έμενε πράσινος πάνω στη διάσταση.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE_BREAKPOINT } from '@/constants/layout';
import { BOTTOM_SHEET_STOPS } from '@/lib/layout/bottom-sheet-stops';

const SHEET_MODULE = readFileSync(join(__dirname, '..', 'ResultsSheet.module.css'), 'utf8');

/**
 * 🔴 **ΤΑ ΣΧΟΛΙΑ ΔΕΝ ΕΙΝΑΙ ΖΩΝΤΑΝΟΣ ΚΩΔΙΚΑΣ — και το πλήρωσε αυτή ακριβώς η άγκυρα.**
 *
 * Η πρώτη γραφή του Α2 ήταν **κόκκινη** επειδή το `SearchResultsContent.tsx` **τεκμηριώνει**
 * τη βλάβη που έφυγε (`grid-cols-1 … lg:grid-cols-[…]`) μέσα σε σχόλιο JSX. Ένας σαρωτής
 * που μετρά σχόλια κάνει **κάθε αρχείο που εξηγεί το λάθος να είναι το λάθος** — το ίδιο
 * μάθημα με το `Κ7β` του CHECK 3.50, όπου μια «μετάλλαξη» χτύπησε σχόλιο και δεν άλλαξε
 * τίποτα. Ο κώδικας ρωτιέται **χωρίς** την αφήγησή του.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

const SCREEN_SOURCE = withoutComments(
  readFileSync(join(__dirname, '..', 'SearchResultsContent.tsx'), 'utf8')
);

/** Το δηλωμένο ύψος μιας στάσης, όπως το γράφει **η αυθεντία** — ή `null` αν λείπει. */
function declaredStopPercent(stop: string): number | null {
  const match = new RegExp(`--sheet-${stop}\\s*:\\s*([0-9.]+)%`).exec(SHEET_MODULE);
  return match ? Number(match[1]) : null;
}

describe('Το κατώφλι είναι ΕΝΑΣ αριθμός, για δύο μηχανισμούς', () => {
  it('Α1: το `md` του Tailwind ΕΙΝΑΙ το MOBILE_BREAKPOINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- CommonJS-only εσωτερικά του Tailwind
    const { loadConfig } = require('tailwindcss/lib/lib/load-config');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resolveConfig = require('tailwindcss/resolveConfig');

    const resolved = resolveConfig(loadConfig(join(process.cwd(), 'tailwind.config.ts')));

    // 🔴 Αν αποκλίνουν, υπάρχει ζώνη πλάτους όπου το CSS ζωγραφίζει **στήλη** ενώ η
    // συμπεριφορά λέει **φύλλο**: στάσεις που δεν κινούν τίποτα, πίσω κουμπί που κλείνει
    // αόρατη επιφάνεια. Και τα δύο αρχεία θα φαίνονταν σωστά.
    expect(resolved.theme.screens.md).toBe(`${MOBILE_BREAKPOINT}px`);
  });

  it('Α2: η οθόνη 2 ΔΕΝ στοιβάζει, και δεν κρατά δεύτερο κατώφλι', () => {
    // Το ελάττωμα που έκλεισε το §26.7: `grid-cols-1 … lg:grid-cols-[…]` έδινε δύο
    // στοιβαγμένα μισά στο στενό, και το `lg` (1024) ήταν αριθμός δίπλα στο 768.
    expect(SCREEN_SOURCE).not.toMatch(/className="[^"]*\bgrid-cols-1\b/);
    expect(SCREEN_SOURCE).not.toMatch(/\blg:grid-cols-/);
    expect(SCREEN_SOURCE).toMatch(/md:grid-cols-\[minmax\(/);
  });
});

describe('Τα ύψη είναι ΜΙΑ αυθεντία, και η σειρά τους είναι συμβόλαιο', () => {
  it('Α3: κάθε στάση του λεξιλογίου έχει δήλωση στο CSS — και καμία περισσότερη', () => {
    for (const stop of BOTTOM_SHEET_STOPS) {
      expect(declaredStopPercent(stop)).not.toBeNull();
    }
    // Μια τέταρτη δήλωση χωρίς άγκυρα στο DOM θα ήταν ύψος που **δεν φτάνει κανείς**.
    const declared = [...SHEET_MODULE.matchAll(/--sheet-([a-z]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set(BOTTOM_SHEET_STOPS));
  });

  it('Α4: τα ύψη είναι ΓΝΗΣΙΩΣ ΑΥΞΟΝΤΑ με τη σειρά του λεξιλογίου', () => {
    const heights = BOTTOM_SHEET_STOPS.map((stop) => declaredStopPercent(stop));

    // 🔴 Μια αντιμετάθεση εδώ θα έκανε το κουμπί «Μεγαλύτερη λίστα» να **μικραίνει** τη
    // λίστα, με τον μεταγλωττιστή σιωπηλό: η σειρά του `BOTTOM_SHEET_STOPS` είναι
    // ταυτόχρονα «πιο κάτω στο κύλισμα» και «περισσότερη λίστα», και μόνο εδώ ελέγχεται.
    // Ισοβαθμία = δύο ονόματα για ένα σκαλί, δηλαδή μια στάση που δεν κάνει τίποτα.
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1] as number);
    }
  });

  it('Α5: η ΠΛΗΡΗΣ στάση αφήνει χάρτη ορατό — ο κανόνας 2 ως αριθμός', () => {
    const full = declaredStopPercent(BOTTOM_SHEET_STOPS[BOTTOM_SHEET_STOPS.length - 1]);

    // Στο 100% ο χάρτης καλύπτεται ολόκληρος και το «μη-αποκλειστικό» γίνεται λέξη χωρίς
    // συνέπεια: το `pointer-events` θα ίσχυε ακόμη, αλλά δεν θα είχε πού να εφαρμοστεί.
    expect(full).toBeLessThan(100);
    expect(full).toBeGreaterThan(0);
  });

  it('Α6: το φύλλο ΔΕΝ κρατά αντίγραφο των υψών σε TypeScript', () => {
    const controller = readFileSync(
      join(process.cwd(), 'src', 'hooks', 'media', 'useSheetSnap.ts'),
      'utf8'
    );
    const vocabulary = readFileSync(
      join(process.cwd(), 'src', 'lib', 'layout', 'bottom-sheet-stops.ts'),
      'utf8'
    );

    // Ο ελεγκτής διαβάζει `offsetTop` από τον δίσκο· το λεξιλόγιο κρατά ονόματα. Ένα
    // ποσοστό σε οποιοδήποτε από τα δύο θα ήταν δεύτερη γεωμετρία που αποκλίνει σιωπηλά
    // — και η `scroll-snap` θα τραβούσε το φύλλο πίσω, δηλαδή αναπήδηση χωρίς ένοχο.
    for (const source of [controller, vocabulary]) {
      expect(withoutComments(source)).not.toMatch(/\d+\s*%/);
    }
  });
});

/**
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΤΗΣ ΛΙΣΤΑΣ — Ο ΧΑΡΤΗΣ ΔΕΝ ΕΧΕΙ ΣΕΙΡΑ, ΕΧΕΙ ΘΕΣΕΙΣ**
 * (ADR-777 §8.61).
 *
 * Πριν από τη σειρά, οι δύο καταναλωτές έπαιρναν **τον ίδιο πίνακα**. Η ταξινόμηση
 * παράγει **νέα ταυτότητα** — και νέα ταυτότητα στον `ResultsMap` σημαίνει
 * **επανα-αρχικοποίηση MapLibre**, δηλαδή **μαύρη οθόνη** σε κάθε αλλαγή σειράς. Το
 * `InteractiveMapContainer` το γράφει ήδη: *«new function every render caused Map
 * re-init»*.
 *
 * ⚠️ **Ρωτιέται η πηγή χωρίς την αφήγησή της** — ίδιο ιδίωμα με τα παραπάνω: το ίδιο
 * αρχείο **τεκμηριώνει** τον κίνδυνο σε σχόλιο, και ένας σαρωτής που μετρά σχόλια θα
 * έκανε την εξήγηση να είναι το σφάλμα.
 */
describe('Η ΣΕΙΡΑ ΦΤΑΝΕΙ ΣΤΗ ΛΙΣΤΑ ΚΑΙ ΟΧΙ ΣΤΟΝ ΧΑΡΤΗ', () => {
  /** Το σώμα μιας κλήσης στοιχείου, χωρίς σχόλια. */
  function propsOf(element: string): string {
    // ⚠️ **`\\b`, ΟΧΙ `\b`** — μέσα σε template literal το `\b` είναι ο χαρακτήρας
    //    **backspace**, όχι όριο λέξης. Μετρήθηκε: η πρώτη γραφή δεν ταίριαζε ΠΟΤΕ, και
    //    η άγκυρα κοκκίνιζε με `null` αντί να μετρά το JSX.
    const match = new RegExp(`<${element}\\b([^>]*?)/?>`, 's').exec(SCREEN_SOURCE);
    expect(match).not.toBeNull();
    return match![1];
  }

  it('🔴 Σ1: ο `ResultsMap` παίρνει τον ΑΤΑΞΙΝΟΜΗΤΟ πίνακα', () => {
    const props = propsOf('ResultsMap');

    expect(props).toMatch(/listings=\{mapped\}/);
    // Η ρητή άρνηση είναι που φυλάει: ένα «περιέχει `mapped`» θα περνούσε **και** με
    // `orderedMapped`, γιατί το δεύτερο περιέχει το πρώτο ως υποσυμβολοσειρά.
    expect(props).not.toMatch(/listings=\{ordered/);
  });

  it('Σ2: ο `ResultsList` παίρνει τον ΤΑΞΙΝΟΜΗΜΕΝΟ — μέσα από το **ΕΝΑ** δοχείο (§8.62)', () => {
    const props = propsOf('ResultsList');

    // ⚠️ **ΤΟ ΟΝΟΜΑ ΑΛΛΑΞΕ ΔΥΟ ΦΟΡΕΣ, Η ΕΓΓΥΗΣΗ ΟΧΙ.** Ως το §8.61 τα props ήταν
    //    κατευθείαν `orderedMapped`/`orderedUnmapped`. Το §8.62 τα πέρασε μέσα από **ένα**
    //    `listView`, ώστε ο μετρητής να μετρά **ό,τι ακριβώς** παίρνει η λίστα (δες Σ2γ).
    //    Το §8.60.14 άλλαξε τον **τύπο**: η λίστα παίρνει **τμήματα**, γιατί ποσά
    //    διαφορετικού ρόλου είναι ασύγκριτα και ένας επίπεδος πίνακας θα επέτρεπε σε
    //    κάθε καταναλωτή να υποθέσει ενιαία κατάταξη.
    expect(props).toMatch(/sections=\{listView\.sections\}/);
    expect(props).toMatch(/unmapped=\{listView\.unmapped\}/);

    // Η ρητή άρνηση μένει: η λίστα δεν επιτρέπεται να πάρει τον **ωμό** πίνακα.
    expect(props).not.toMatch(/sections=\{mapped\}/);
    expect(props).not.toMatch(/unmapped=\{unmapped\}/);
  });

  it('🔴 Σ2β: το `listView` ΕΙΝΑΙ οι ταξινομημένοι — ο κρίκος που κρατά το Σ2 ειλικρινές', () => {
    // Χωρίς αυτό, το Σ2 θα ήταν **πράσινο ακόμη κι αν** το `listView` κρατούσε τους
    // αταξινόμητους: θα επαλήθευε το **όνομα** του δοχείου, όχι το περιεχόμενό του.
    // Η εγγύηση έγινε αλυσίδα δύο κρίκων, άρα χρειάζεται δύο ισχυρισμούς.
    expect(SCREEN_SOURCE).toMatch(/sections:\s*orderedSections/);
    expect(SCREEN_SOURCE).toMatch(/unmapped:\s*orderedUnmapped/);
  });

  it('🔴 Σ2γ: ο μετρητής μετρά **ΤΟ ΙΔΙΟ** δοχείο που πάει στη λίστα (§8.62)', () => {
    // Ο πυρήνας του Βήματος 2: για να κοπεί η λίστα, το κόψιμο πρέπει να συμβεί μέσα
    // στο `listView` — και τότε το `renderedCount` πέφτει **στην ίδια αναπνοή**. Αν
    // κάποιος ξαναδώσει στον μετρητή άλλο σύνολο (π.χ. `visible.length`), εδώ κοκκινίζει.
    //
    // 🔴 **ΚΑΙ ΜΕΤΡΑΕΙ ΤΑ ΤΜΗΜΑΤΑ, ΟΧΙ ΤΟΝ ΑΡΧΙΚΟ ΠΙΝΑΚΑ** (§8.60.14): ένα
    //    `mapped.length` εδώ θα έμενε σωστό ακόμη κι αν η διαμέριση έχανε αγγελία —
    //    δηλαδή ο μετρητής θα ήταν ξανά «ταυτόχρονα συνεπής και ψεύτης».
    expect(SCREEN_SOURCE).toMatch(
      /renderedCount\s*=\s*countListingSections\(listView\.sections\)\s*\+\s*listView\.unmapped\.length/
    );
    expect(SCREEN_SOURCE).not.toMatch(/renderedCount\s*=\s*mapped\.length/);
    expect(propsOf('ListingLedgerBar')).toMatch(/rendered=\{renderedCount\}/);
  });

  it('Σ3: η ταξινόμηση περνά από το SSoT, ποτέ από `sort()` μέσα στην οθόνη', () => {
    // «Η σειρά είναι δηλωμένη απόφαση σε δικό της αρχείο» — μια `.sort(` εδώ θα ήταν
    // δεύτερη κατάταξη, αόρατη στις άγκυρες του `listing-results-order`.
    expect(SCREEN_SOURCE).toMatch(/orderResultsListings\(/);
    expect(SCREEN_SOURCE).not.toMatch(/\.sort\(/);
  });
});
