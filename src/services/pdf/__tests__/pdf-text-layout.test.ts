/**
 * ADR-923 §5.6.1 — ο αναγνώστης γεωμετρίας κειμένου. Το jest δεν φορτώνει το pdf.js, άρα εδώ κρίνεται η μετάφραση
 * και το καθάρισμα. Το πραγματικό pdf.js το κρίνει το `typst-real.test.ts` μέσα από χωριστή διεργασία.
 */
const destroy = jest.fn(() => Promise.resolve());
const cleanup = jest.fn();

const fakePage = {
  getViewport: () => ({ width: 595, height: 842 }),
  getTextContent: () => Promise.resolve({
    items: [
      { str: 'τιμή', transform: [8, 0, 0, 8, 10, 20], width: 16 },
      { str: '   ', transform: [8, 0, 0, 8, 30, 20], width: 4 },
      { str: 'χωρίς πίνακα' },
      { str: '' },
    ],
  }),
  cleanup,
};

jest.mock('@napi-rs/canvas', () => ({ createCanvas: jest.fn(), DOMMatrix: class {}, Path2D: class {} }), { virtual: true });
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: () => Promise.resolve(fakePage), destroy }) }),
}), { virtual: true });

jest.mock('server-only', () => ({}));

describe('readPdfTextLayout', () => {
  it('κρατά μόνο κείμενο με θέση, σε όλες τις σελίδες, και καθαρίζει', async () => {
    const { readPdfTextLayout } = await import('../pdf-rasterize.service');
    const pages = await readPdfTextLayout(new Uint8Array([1]));
    expect(pages).toEqual(Array.from({ length: 2 }, () => ({
      widthPt: 595, heightPt: 842, runs: [{ text: 'τιμή', transform: [8, 0, 0, 8, 10, 20], width: 16 }],
    })));
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
