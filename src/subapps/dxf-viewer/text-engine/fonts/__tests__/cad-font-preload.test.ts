/**
 * Άγκυρες για τον `cad-font-preload` — ADR-803 (CHECK 3.67) + ADR-040 + ADR-786 §4.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ**: μέχρι τις 2026-08-25 ο `cad-font-preload.ts` — δηλαδή
 * **η αυθεντία «ποιο λογικό όνομα, ποιο φυσικό αρχείο»** για ολόκληρο τον καμβά DXF — δεν
 * είχε **καμία** άγκυρα. Ούτε μία. Το `grep` για `CAD_SUBSTITUTE_FONTS` σε αρχεία test
 * επέστρεφε ένα **σχόλιο** σε άσχετη σουίτα. Δηλαδή αν ο preloader σταματούσε να φορτώνει
 * οτιδήποτε, **καμία σουίτα δεν θα κοκκίνιζε** — και ο μόνος τρόπος να το μάθει κανείς θα ήταν
 * να κοιτάξει ένα σχέδιο. Ακριβώς έτσι επέζησε το ελάττωμα του ADR-803 επί μήνες.
 *
 * ⚠️ **ΚΑΘΕ ΟΜΑΔΑ ΕΧΕΙ ΠΑΡΟΝΟΜΑΣΤΗ.** Δεν αρκεί «η νέα υλοποίηση περνά»: κάθε άγκυρα
 * αποδεικνύει ότι το κατηγόρημα **ξεχωρίζει** τη σπασμένη μορφή, αλλιώς το πράσινο μπορεί να
 * σημαίνει «δεν κοίταξα» (μάθημα ADR-790 §9.1).
 *
 * ⚠️ **ΔΕΝ επαναλαμβάνεται ο έλεγχος «υπάρχει το αρχείο;»** — τον κάνει η ίδια η CHECK 3.67
 * (`unloadable-preload`) πάνω στον πραγματικό δίσκο. Δεύτερη μηχανή για το ίδιο ερώτημα θα
 * ήταν ADR-749.
 */

import { fontCache } from '../font-cache';
import { resolveEntityFont } from '../font-resolver';
import { stubProportionalFont } from './_stub-font';

// ─── Το διπλό του φορτωτή ─────────────────────────────────────────────────────

/** Μια φόρτωση που κρατιέται ανοιχτή ώσπου να την απελευθερώσει το test. */
interface Deferred {
  url: string;
  release: () => void;
  fail: (why: string) => void;
}

const deferrals: Deferred[] = [];
const callLog: string[] = [];

jest.mock('../font-loader', () => ({
  loadFont: jest.fn((url: string, cacheName?: string) => {
    callLog.push(`load:${url}`);
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fontCache: cache } = require('../font-cache');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { stubProportionalFont: stub } = require('./_stub-font');
      deferrals.push({
        url,
        release: () => {
          const font = stub(0.6);
          if (cacheName) cache.set(cacheName, font);
          resolve(font);
        },
        fail: (why: string) => reject(new Error(why)),
      });
    });
  }),
}));

jest.mock('../css-font-registry', () => ({
  whenCssFontFacesReady: jest.fn(async () => {
    callLog.push('cssReady');
  }),
}));

jest.mock('../font-ready-store', () => ({
  bumpFontReady: jest.fn(() => {
    callLog.push('bump');
  }),
}));

/** Φρέσκο στιγμιότυπο του module — το `started` είναι κατάσταση επιπέδου module. */
async function freshPreload() {
  jest.resetModules();
  return import('../cad-font-preload');
}

/** Άσε τον βρόχο συμβάντων να τρέξει, ώστε να ξεκινήσουν όσες φορτώσεις πρόκειται. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  deferrals.length = 0;
  callLog.length = 0;
  fontCache.clear();
  jest.clearAllMocks();
});

// ─── Κ1 — ΠΑΡΑΛΛΗΛΗ φόρτωση (ο παρονομαστής είναι η σειριακή μορφή) ───────────

describe('Κ1 — οι όψεις φορτώνονται ΠΑΡΑΛΛΗΛΑ', () => {
  it('ξεκινά ΚΑΘΕ φόρτωση πριν ολοκληρωθεί οποιαδήποτε', async () => {
    const mod = await freshPreload();
    const total = mod.CAD_SUBSTITUTE_FONTS.length;
    expect(total).toBeGreaterThan(1); // αλλιώς η ομάδα δεν μετρά τίποτα

    const done = mod.preloadCadSubstituteFonts();
    await settle();

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: σειριακό `for … await` θα είχε ξεκινήσει ΑΚΡΙΒΩΣ ΜΙΑ φόρτωση εδώ,
    // γιατί καμία δεν έχει ακόμη απελευθερωθεί. Το `1` είναι η σπασμένη μορφή.
    expect(deferrals).toHaveLength(total);
    expect(deferrals).not.toHaveLength(1);

    deferrals.forEach((d) => d.release());
    await done;
  });
});

// ─── Κ2 — ΑΠΟΜΟΝΩΣΗ ΑΠΟΤΥΧΙΑΣ ────────────────────────────────────────────────

describe('Κ2 — μία αποτυχία δεν κατεβάζει τη δέσμη', () => {
  it('φορτώνει τις υπόλοιπες και σηματοδοτεί, όταν μία όψη αποτύχει', async () => {
    const mod = await freshPreload();
    const done = mod.preloadCadSubstituteFonts();
    await settle();

    deferrals[0].fail('network down');
    deferrals.slice(1).forEach((d) => d.release());

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: με `Promise.all` πάνω σε ωμά promises αυτό θα ΠΕΤΟΥΣΕ, δηλαδή ο
    // καμβάς θα έμενε χωρίς ΚΑΜΙΑ γραμματοσειρά — χειρότερα από το πρόβλημα που λύνουμε.
    await expect(done).resolves.toBeUndefined();
    expect(callLog).toContain('bump');
  });

  it('ΔΕΝ σηματοδοτεί όταν ΚΑΜΙΑ όψη δεν φορτώθηκε', async () => {
    const mod = await freshPreload();
    const done = mod.preloadCadSubstituteFonts();
    await settle();

    deferrals.forEach((d) => d.fail('all down'));
    await done;

    // Χωρίς αυτό, το `loadedAny` θα ήταν διακοσμητικό: θα ξαναχτίζαμε τη bitmap cache για
    // να ζωγραφίσουμε ό,τι ζωγραφίζαμε ήδη.
    expect(callLog).not.toContain('bump');
  });
});

// ─── Κ3 — ΕΝΑ bump ανά δέσμη (συμβόλαιο ADR-040) ─────────────────────────────

describe('Κ3 — ΕΝΑ σήμα ανά δέσμη, ανεξαρτήτως πλήθους όψεων', () => {
  it('σηματοδοτεί ακριβώς μία φορά', async () => {
    const mod = await freshPreload();
    const total = mod.CAD_SUBSTITUTE_FONTS.length;
    const done = mod.preloadCadSubstituteFonts();
    await settle();
    deferrals.forEach((d) => d.release());
    await done;

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: σήμα ανά όψη θα έδινε `total` — δηλαδή `total` πλήρεις
    // επανακατασκευές της bitmap cache. Το ADR-040 δηλώνει «μία invalidate ανά bumpFontReady».
    expect(callLog.filter((e) => e === 'bump')).toHaveLength(1);
    expect(total).toBeGreaterThan(1);
  });
});

// ─── Κ4 — Η ΣΕΙΡΑ: CSS όψη έτοιμη ΠΡΙΝ το σήμα (ADR-786 §4) ──────────────────

describe('Κ4 — το `whenCssFontFacesReady` προηγείται του σήματος', () => {
  it('περιμένει τις CSS εγγραφές πριν το bump', async () => {
    const mod = await freshPreload();
    const done = mod.preloadCadSubstituteFonts();
    await settle();
    deferrals.forEach((d) => d.release());
    await done;

    // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το bump προηγηθεί, ένας καταναλωτής μετρά τη ζώνη ascent/descent
    // με το ΟΝΟΜΑ πριν η όψη υπάρξει στο `document.fonts`, ο browser απαντά για την εφεδρική,
    // και η λάθος απάντηση ΚΛΕΙΔΩΝΕΤΑΙ για όλη τη συνεδρία (`BAND_CACHE`).
    expect(callLog.indexOf('cssReady')).toBeGreaterThan(-1);
    expect(callLog.indexOf('cssReady')).toBeLessThan(callLog.indexOf('bump'));
  });
});

// ─── Κ5 — ιδεμποτεντ + παράλειψη ήδη φορτωμένων ──────────────────────────────

describe('Κ5 — ασφαλές σε κάθε mount', () => {
  it('η δεύτερη κλήση δεν ξαναφορτώνει τίποτα', async () => {
    const mod = await freshPreload();
    const first = mod.preloadCadSubstituteFonts();
    await settle();
    deferrals.forEach((d) => d.release());
    await first;

    const started = deferrals.length;
    await mod.preloadCadSubstituteFonts();
    expect(deferrals).toHaveLength(started);
  });

  it('παραλείπει όψη που είναι ήδη στην κρυφή μνήμη', async () => {
    const mod = await freshPreload();
    // 🔴 ΠΑΓΙΔΑ ΠΛΗΡΩΜΕΝΗ ΕΔΩ: το `jest.resetModules()` του `freshPreload` δίνει στο φρέσκο
    // `cad-font-preload` ΔΙΚΟ ΤΟΥ στιγμιότυπο του `font-cache`. Γράφοντας στο `fontCache` της
    // κορυφής του αρχείου (άλλο registry) το test έλεγε «δεν παρέλειψε» ενώ ο preloader απλώς
    // κοίταζε ΑΛΛΟ ευρετήριο — το όργανο μετρούσε άλλο πράγμα από αυτό που ισχυριζόταν.
    const { fontCache: liveCache } = await import('../font-cache');
    liveCache.set(mod.CAD_SUBSTITUTE_FONTS[0].cacheName, stubProportionalFont(0.6));

    const done = mod.preloadCadSubstituteFonts();
    await settle();
    deferrals.forEach((d) => d.release());
    await done;

    expect(callLog).not.toContain(`load:${mod.CAD_SUBSTITUTE_FONTS[0].url}`);
    expect(deferrals).toHaveLength(mod.CAD_SUBSTITUTE_FONTS.length - 1);
  });
});

// ─── Π — ΤΟ ΠΡΟΪΟΝ: ζητά ο resolver έντονο, και το βρίσκει; ──────────────────

describe('Π — η ζεύξη preload ↔ resolver, στα ΠΡΑΓΜΑΤΙΚΑ ονόματα', () => {
  /** Γέμισε την κρυφή μνήμη ακριβώς με ό,τι δηλώνει το `CAD_SUBSTITUTE_FONTS`. */
  async function primeFromDeclaration(): Promise<readonly string[]> {
    const mod = await freshPreload();
    const names = mod.CAD_SUBSTITUTE_FONTS.map((e) => e.cacheName);
    names.forEach((n) => fontCache.set(n, stubProportionalFont(0.6)));
    return names;
  }

  it('`romand.shx` (duplex) λύνεται σε ΕΝΤΟΝΗ όψη', async () => {
    await primeFromDeclaration();
    const hit = resolveEntityFont('romand.shx');
    expect(hit).not.toBeNull();
    expect(hit?.cacheName).toBe('Liberation Sans Bold');
  });

  it('`romans.shx` + bold λύνεται στην ΙΔΙΑ έντονη όψη', async () => {
    await primeFromDeclaration();
    expect(resolveEntityFont('romans.shx', { bold: true })?.cacheName).toBe('Liberation Sans Bold');
  });

  it('`txt.shx` λύνεται σε μονοδιάστημη όψη', async () => {
    await primeFromDeclaration();
    expect(resolveEntityFont('txt.shx')?.cacheName).toBe('Liberation Mono');
  });

  it('το πλάγιο και το έντονο-πλάγιο λύνονται (άξονας στυλ)', async () => {
    await primeFromDeclaration();
    expect(resolveEntityFont('romans.shx', { italic: true })?.cacheName)
      .toBe('Liberation Sans Italic');
    expect(resolveEntityFont('romans.shx', { bold: true, italic: true })?.cacheName)
      .toBe('Liberation Sans Bold Italic');
  });

  it('🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — με ΜΟΝΟ την κανονική όψη (η κατάσταση πριν το ADR-803) ΟΛΑ αστοχούν',
    async () => {
      // Ακριβώς ό,τι δήλωνε το `CAD_SUBSTITUTE_FONTS` πριν: μία εγγραφή, «Liberation Sans».
      fontCache.set('Liberation Sans', stubProportionalFont(0.6));

      expect(resolveEntityFont('romand.shx')).toBeNull();
      expect(resolveEntityFont('romans.shx', { bold: true })).toBeNull();
      expect(resolveEntityFont('txt.shx')).toBeNull();
      expect(resolveEntityFont('romans.shx', { italic: true })).toBeNull();

      // …ενώ η κανονική διαδρομή δούλευε — γι' αυτό το ελάττωμα ήταν αόρατο.
      expect(resolveEntityFont('romans.shx')?.cacheName).toBe('Liberation Sans');
    });
});
