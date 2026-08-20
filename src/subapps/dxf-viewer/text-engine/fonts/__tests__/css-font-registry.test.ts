/**
 * 🔴 ADR-786 §4 (γ) — **η γραμματοσειρά του καμβά γίνεται και γραμματοσειρά του DOM.**
 *
 * Ο in-cell επεξεργαστής είναι HTML: δεν μπορεί να ζωγραφίσει περιγράμματα opentype, μπορεί
 * μόνο να ζητήσει μια CSS οικογένεια. Αν εκείνη δεν είναι **ακριβώς** το ίδιο αρχείο που
 * ρασταροποιεί ο καμβάς από κάτω, το κείμενο αλλάζει όψη στο διπλό κλικ — που είναι ό,τι
 * μετρήθηκε στα στιγμιότυπα `190343` vs `190357`.
 *
 * @see text-engine/fonts/css-font-registry.ts
 */

import {
  registerCssFontFace,
  isCssFontFaceRegistered,
  whenCssFontFacesReady,
  __resetCssFontRegistryForTests,
} from '../css-font-registry';

interface FakeFace {
  readonly family: string;
  readonly source: ArrayBuffer;
  load(): Promise<FakeFace>;
}

interface Harness {
  readonly added: FakeFace[];
  readonly constructed: number;
  /** Λύνει τη φόρτωση όταν το harness στήθηκε με `mode: 'deferred'`. */
  finishLoad(): void;
  restore(): void;
}

/** Πότε (και πώς) απαντά το `face.load()`. */
type LoadMode = 'immediate' | 'fail' | 'deferred';

/**
 * Δίνει τον έλεγχο των microtasks πίσω στη μηχανή, ώστε κάθε **ήδη λυμένη** αλυσίδα να
 * προλάβει να τρέξει. Χωρίς αυτό ένα «δεν έχει λυθεί ακόμη» δεν σημαίνει τίποτα.
 */
const flush = (): Promise<void> => new Promise<void>((r) => { setTimeout(r, 0); });

/** Εγκαθιστά ψεύτικο `FontFace` + `document.fonts` με ελεγχόμενη συμπεριφορά φόρτωσης. */
function installFontFaceHarness(mode: LoadMode = 'immediate'): Harness {
  const added: FakeFace[] = [];
  const state = { constructed: 0 };
  let release: (() => void) | null = null;
  const globals = globalThis as { FontFace?: unknown };
  const doc = document as unknown as { fonts?: unknown };
  const hadCtor = 'FontFace' in globals;
  const previousCtor = globals.FontFace;
  const previousFonts = doc.fonts;

  class FakeFontFace implements FakeFace {
    constructor(readonly family: string, readonly source: ArrayBuffer) {
      state.constructed++;
    }
    load(): Promise<FakeFace> {
      if (mode === 'fail') return Promise.reject(new Error('bad font'));
      if (mode === 'immediate') return Promise.resolve(this);
      return new Promise<FakeFace>((resolve) => { release = () => resolve(this); });
    }
  }

  globals.FontFace = FakeFontFace;
  doc.fonts = { add: (face: FakeFace) => added.push(face) };
  __resetCssFontRegistryForTests();

  return {
    added,
    get constructed() { return state.constructed; },
    finishLoad(): void {
      if (!release) throw new Error('το harness δεν στήθηκε σε «deferred»');
      release();
    },
    restore(): void {
      __resetCssFontRegistryForTests();
      if (hadCtor) globals.FontFace = previousCtor;
      else delete globals.FontFace;
      doc.fonts = previousFonts;
    },
  };
}

const BUFFER = new ArrayBuffer(8);

describe('🔴 ADR-786 — μία εγγραφή γραμματοσειράς, δύο καταναλωτές', () => {
  it('Ρ1 — δηλώνεται στο `document.fonts` ΜΕ ΤΑ ΙΔΙΑ bytes, όχι με δεύτερο αίτημα δικτύου', () => {
    // Το «ίδιο buffer» δεν είναι βελτιστοποίηση: είναι ο λόγος που οι δύο μηχανές **δεν
    // μπορούν** να δουν διαφορετική έκδοση του αρχείου, ούτε μετά από deploy.
    const h = installFontFaceHarness();
    try {
      registerCssFontFace('Liberation Sans', BUFFER);
      expect(h.added).toHaveLength(1);
      expect(h.added[0].family).toBe('Liberation Sans');
      expect(h.added[0].source).toBe(BUFFER);
      expect(isCssFontFaceRegistered('Liberation Sans')).toBe(true);
    } finally { h.restore(); }
  });

  it('Ρ2 — ιδεμποτεντ, και ΧΩΡΙΣ διάκριση πεζών/κεφαλαίων (όπως ταιριάζει το CSS)', () => {
    const h = installFontFaceHarness();
    try {
      registerCssFontFace('Liberation Sans', BUFFER);
      registerCssFontFace('Liberation Sans', BUFFER);
      registerCssFontFace('liberation sans', BUFFER);
      expect(h.constructed).toBe(1);
      expect(isCssFontFaceRegistered('LIBERATION SANS')).toBe(true);
    } finally { h.restore(); }
  });

  it('🔴 Ρ3 — το `whenCssFontFacesReady` ΠΕΡΙΜΕΝΕΙ: αλλιώς η πρώτη μέτρηση κλειδώνει εφεδρικά μετρικά', async () => {
    // Ο επεξεργαστής μετρά τη ζώνη ascent/descent **μία φορά ανά οικογένεια** και την κρατά
    // για όλη τη συνεδρία (`table-cell-text-metrics.ts`). Μια μέτρηση πριν φορτώσει η
    // γραμματοσειρά απαντά για την **εφεδρική** — και η λάθος απάντηση δεν ακυρώνεται ποτέ.
    //
    // ⚠️ Η πρώτη γραφή αυτής της άγκυρας **επέζησε** της μετάλλαξης «μη περιμένεις καθόλου»:
    // έλεγχε `settled === false` **αμέσως** μετά το `.then(...)`, που είναι ψευδές και στις δύο
    // εκδοχές (ένα `.then` δεν τρέχει ποτέ συγχρόνως). Δηλαδή δοκίμαζε τη σημασιολογία των
    // Promise, όχι τον κώδικα. Εδώ η φόρτωση κρατιέται **ανοιχτή** από το test.
    const h = installFontFaceHarness('deferred');
    try {
      let settled = false;
      registerCssFontFace('Liberation Sans', BUFFER);
      const ready = whenCssFontFacesReady().then(() => { settled = true; });

      await flush();
      expect(settled).toBe(false);

      h.finishLoad();
      await ready;
      expect(settled).toBe(true);
    } finally { h.restore(); }
  });

  it('Ρ4 — χωρίς `FontFace` (SSR / worker) είναι σιωπηλά ανενεργό, ΠΟΤΕ εξαίρεση', () => {
    // Η φόρτωση της γραμματοσειράς **του καμβά** είναι το κύριο έργο του καλούντος· μια
    // εξαίρεση εδώ θα την κατέβαζε ολόκληρη για μια επιφάνεια που δεν υπάρχει καν.
    const globals = globalThis as { FontFace?: unknown };
    const had = 'FontFace' in globals;
    const previous = globals.FontFace;
    delete globals.FontFace;
    __resetCssFontRegistryForTests();
    try {
      expect(() => registerCssFontFace('Liberation Sans', BUFFER)).not.toThrow();
      expect(isCssFontFaceRegistered('Liberation Sans')).toBe(false);
    } finally {
      if (had) globals.FontFace = previous;
      __resetCssFontRegistryForTests();
    }
  });

  it('🔴 Ρ5 — αποτυχία φόρτωσης ΞΕ-καταχωρεί το όνομα, ώστε μια δεύτερη ευκαιρία να υπάρχει', async () => {
    // Αν το όνομα έμενε «καταχωρημένο», το `cssFamily` θα συνέχιζε να το ζητά για πάντα —
    // δηλαδή ο επεξεργαστής θα ζωγράφιζε με γραμματοσειρά συστήματος **σιωπηλά**.
    const h = installFontFaceHarness('fail');
    try {
      registerCssFontFace('Liberation Sans', BUFFER);
      await whenCssFontFacesReady();
      expect(isCssFontFaceRegistered('Liberation Sans')).toBe(false);
    } finally { h.restore(); }
  });
});
