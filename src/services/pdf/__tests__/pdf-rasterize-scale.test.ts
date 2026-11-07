/**
 * ADR-929 §6.9 #7 — το DPI που επιστρέφει ο rasterizer είναι αυτό που ΠΡΑΓΜΑΤΙ χρησιμοποιήθηκε.
 * Δύο σιωπηλές αλλαγές κλίμακας: το ταβάνι πλάτους (`maxWidthPx`) και το PDF `UserUnit`, που το `getViewport` του
 * pdfjs 4.5 αγνοεί. Ένα DPI από regex στο `/MediaBox` βγήκε 10/60/86 και έριξε τη μέτρηση καταγραφής (§6.9 #6).
 */

/** Σελίδα 600 × 800 μονάδων χρήστη, UserUnit = 2 ⇒ 16,67 × 22,22 ίντσες. */
const PAGE_UNITS = { width: 600, height: 800 };
const USER_UNIT = 2;

jest.mock('@napi-rs/canvas', () => ({
  createCanvas: (width: number, height: number) => ({
    width,
    height,
    getContext: () => ({ fillStyle: '', fillRect: () => undefined }),
    toBuffer: () => Buffer.from([1]),
  }),
  DOMMatrix: class {},
  Path2D: class {},
}), { virtual: true });

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () => Promise.resolve({
        userUnit: USER_UNIT,
        getViewport: ({ scale }: { scale: number }) => ({
          width: PAGE_UNITS.width * scale,
          height: PAGE_UNITS.height * scale,
          convertToViewportPoint: (x: number, y: number) => [x, y],
        }),
        render: () => ({ promise: Promise.resolve() }),
        cleanup: () => undefined,
      }),
      destroy: () => Promise.resolve(),
    }),
  }),
}), { virtual: true });

describe('rasterizePdfPageImages: η κλίμακα που πράγματι χρησιμοποιήθηκε', () => {
  it('UserUnit = 2 ⇒ το ζητούμενο 200 dpi είναι στην πράξη 100 pixel ανά φυσική ίντσα', async () => {
    const { rasterizePdfPageImages } = await import('../pdf-rasterize.service');
    const [page] = await rasterizePdfPageImages(Buffer.from('%PDF-1.6'), { dpi: 200, maxWidthPx: 5000 });
    expect(page.dpi).toBeCloseTo(100, 9);
    expect(page.widthPx).toBe(Math.ceil((PAGE_UNITS.width * 200) / 72));
    expect(page.pageWidthMm).toBeCloseTo((PAGE_UNITS.width * USER_UNIT * 25.4) / 72, 9);
    expect(page.pageHeightMm).toBeCloseTo((PAGE_UNITS.height * USER_UNIT * 25.4) / 72, 9);
  });

  it('ταβάνι πλάτους 1000 px ⇒ το DPI μικραίνει μαζί του, και το λέει', async () => {
    const { rasterizePdfPageImages } = await import('../pdf-rasterize.service');
    const [page] = await rasterizePdfPageImages(Buffer.from('%PDF-1.6'), { dpi: 200, maxWidthPx: 1000 });
    expect(page.widthPx).toBe(1000);
    expect(page.dpi).toBeCloseTo((1000 / PAGE_UNITS.width) * (72 / USER_UNIT), 9);
    expect(page.dpi * (page.pageWidthMm / 25.4)).toBeCloseTo(page.widthPx, 6);
  });

  it('το rasterizePdfPages δίνει τα ίδια PNG (οι καταναλωτές του δεν αλλάζουν)', async () => {
    const { rasterizePdfPages } = await import('../pdf-rasterize.service');
    const pngs = await rasterizePdfPages(Buffer.from('%PDF-1.6'), {});
    expect(pngs).toEqual([Buffer.from([1])]);
  });
});
