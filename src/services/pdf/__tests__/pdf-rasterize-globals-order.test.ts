/**
 * ΑΓΚΥΡΑ ΣΕΙΡΑΣ ΦΟΡΤΩΣΗΣ — ADR-598 G2.
 *
 * ΤΙ ΦΥΛΑΕΙ: το `pdf.mjs` (legacy) αποφασίζει **κατά τη φόρτωσή του** αν θα γεμίσει
 * μόνο του τα `DOMMatrix`/`Path2D` από το προαιρετικό πακέτο `canvas`. Αφού το
 * `node-canvas` αφαιρέθηκε από το δέντρο (`pnpm.overrides["pdfjs-dist>canvas"]="-"`,
 * −62 πακέτα, −9 advisories), τα globals πρέπει να είναι **ήδη εκεί** τη στιγμή της
 * εισαγωγής, αλλιώς κάθε PDF με tiling pattern πέφτει σε χρόνο εκτέλεσης με
 * `ReferenceError: DOMMatrix is not defined` (μετρημένο ζωντανά).
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ: η βλάβη είναι **αόρατη στον μεταγλωττιστή** και δεν την πιάνει
 * κανένα άλλο test — ένα αθώο `Promise.all([loadPdfjs(), loadCanvas()])` την
 * επαναφέρει σιωπηλά. Χωρίς άγκυρα, η εγγύηση είναι σχόλιο.
 */

const NAPI = '@napi-rs/canvas';
const PDFJS = 'pdfjs-dist/legacy/build/pdf.mjs';

/** Τι έβλεπε το `globalThis` τη στιγμή που φορτώθηκε το pdf.js. */
let globalsAtPdfjsImport: { DOMMatrix: string; Path2D: string } | null = null;

class FakeDOMMatrix {}
class FakePath2D {}

jest.mock('@napi-rs/canvas', () => ({
  createCanvas: () => ({
    width: 1,
    height: 1,
    getContext: () => ({ fillStyle: '', fillRect: () => undefined }),
    toBuffer: () => Buffer.from([1, 2, 3]),
  }),
  DOMMatrix: FakeDOMMatrix,
  Path2D: FakePath2D,
}), { virtual: true });

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  // Η εργοστασιακή συνάρτηση τρέχει ΤΗ ΣΤΙΓΜΗ του δυναμικού import — εδώ ακριβώς
  // μετριέται η σειρά.
  globalsAtPdfjsImport = {
    DOMMatrix: typeof (globalThis as Record<string, unknown>).DOMMatrix,
    Path2D: typeof (globalThis as Record<string, unknown>).Path2D,
  };
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 0,
        getPage: () => Promise.reject(new Error('δεν καλείται')),
        destroy: () => Promise.resolve(),
      }),
    }),
  };
}, { virtual: true });

/**
 * Ο κώδικας ΟΝΟΜΑΖΕΙ τη βλάβη μέσα στα σχόλιά του (`Promise.all`, `canvas`) ως
 * τεκμηρίωση του γιατί δεν γράφεται έτσι. Χωρίς αφαίρεση σχολίων, οι άγκυρες Δ/Ε
 * θα κοκκίνιζαν πάνω στη ΘΕΡΑΠΕΙΑ — το μάθημα των CHECK 3.50 (Κ7β) / 3.56.
 */
function readServiceCode(): string {
  const raw = jest.requireActual<typeof import('fs')>('fs')
    .readFileSync(require.resolve('../pdf-rasterize.service.ts'), 'utf8');
  return raw.replace(//*[sS]*?*//g, '').replace(///.*$/gm, '');
}

describe('pdf-rasterize: σειρά εγκατάστασης browser globals (ADR-598 G2)', () => {
  beforeEach(() => {
    jest.resetModules();
    globalsAtPdfjsImport = null;
    delete (globalThis as Record<string, unknown>).DOMMatrix;
    delete (globalThis as Record<string, unknown>).Path2D;
  });

  it('Α) το pdf.js φορτώνεται ΑΦΟΥ τα DOMMatrix/Path2D υπάρχουν ήδη στο globalThis', async () => {
    const { rasterizePdfPages } = await import('../pdf-rasterize.service');
    await rasterizePdfPages(Buffer.from('%PDF-1.4'), {});

    // ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το pdf.js δεν φορτώθηκε καθόλου, το test δεν απέδειξε τίποτα.
    expect(globalsAtPdfjsImport).not.toBeNull();
    expect(globalsAtPdfjsImport).toEqual({ DOMMatrix: 'function', Path2D: 'function' });
  });

  it('Β) τα globals προέρχονται από την ΙΔΙΑ υλοποίηση καμβά που ζωγραφίζει', async () => {
    const { rasterizePdfPages } = await import('../pdf-rasterize.service');
    await rasterizePdfPages(Buffer.from('%PDF-1.4'), {});

    const napi = await import(NAPI);
    expect((globalThis as Record<string, unknown>).DOMMatrix).toBe(napi.DOMMatrix);
    expect((globalThis as Record<string, unknown>).Path2D).toBe(napi.Path2D);
  });

  it('Γ) ιδεμποτητή — προϋπάρχον global ΔΕΝ πατιέται', async () => {
    class ForeignDOMMatrix {}
    (globalThis as Record<string, unknown>).DOMMatrix = ForeignDOMMatrix;

    const { rasterizePdfPages } = await import('../pdf-rasterize.service');
    await rasterizePdfPages(Buffer.from('%PDF-1.4'), {});

    expect((globalThis as Record<string, unknown>).DOMMatrix).toBe(ForeignDOMMatrix);
    // ...ενώ το Path2D, που έλειπε, γεμίζει κανονικά.
    expect(typeof (globalThis as Record<string, unknown>).Path2D).toBe('function');
  });

  it('Δ) το συμβόλαιο ζει ΜΕΣΑ στο loadPdfjs, όχι στον καλούντα', () => {
    // Ένα `Promise.all([loadPdfjs(), loadCanvas()])` είναι αγώνας δρόμου: η σειρά
    // δεν επιτρέπεται να εξαρτάται από τον καλούντα.
    const src = jest.requireActual<typeof import('fs')>('fs')
      .readFileSync(require.resolve('../pdf-rasterize.service.ts'), 'utf8');
    expect(src).not.toMatch(/Promise\.all\(\s*\[\s*loadPdfjs\(\)/);
    expect(src).toMatch(/installPdfjsBrowserGlobals\(await loadCanvas\(\)\)/);
  });

  it('Ε) ΜΗΔΕΝ αναφορά στο αφαιρεμένο πακέτο node-canvas', () => {
    const src = jest.requireActual<typeof import('fs')>('fs')
      .readFileSync(require.resolve('../pdf-rasterize.service.ts'), 'utf8');
    // μόνο ο σχολιασμός επιτρέπεται να το ονομάζει· ποτέ import.
    expect(src).not.toMatch(/from\s+'canvas'|import\('canvas'\)|require\('canvas'\)/);
  });
});
