/**
 * ADR-923 §5.5.1 Ε8 — **η στρώση κειμένου δηλώνεται, δεν συμπεραίνεται από άδεια λίστα.**
 * Η παρτίδα `cibat_1473aa04…` πήρε μηδέν κείμενο σε σελίδα που έχει κείμενο: το pdf.js (προεπιλογή `stopAtErrors: false`)
 * καταπίνει το σφάλμα του `getTextContent` και επιστρέφει ό,τι πρόλαβε. Η σελίδα περνούσε σιωπηλά ως «σαρωμένη».
 */

const SHOW_TEXT = 44;
const MOVE_TO = 13;

interface MockScenario {
  firstItems: readonly { str: string; transform: number[]; width: number; height: number }[];
  operators: readonly number[];
  strict: 'items' | 'empty' | 'throws';
}

const mockScenario: MockScenario = { firstItems: [], operators: [], strict: 'items' };
const mockOpened: { stopAtErrors: boolean | undefined }[] = [];
const ITEM = { str: 'DIMENSIONS', transform: [1, 0, 0, 1, 100, 700], width: 60, height: 10 };

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

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  const textOf = (strict: boolean) => {
    if (!strict) return Promise.resolve({ items: mockScenario.firstItems });
    if (mockScenario.strict === 'throws') return Promise.reject(new Error('FormatError: Bad FCHECK in flate stream'));
    return Promise.resolve({ items: mockScenario.strict === 'items' ? [ITEM] : [] });
  };
  return {
    OPS: { showText: 44, showSpacedText: 45, nextLineShowText: 46, nextLineSetSpacingShowText: 47, moveTo: 13 },
    getDocument: ({ stopAtErrors }: { stopAtErrors?: boolean }) => {
      mockOpened.push({ stopAtErrors });
      return {
        promise: Promise.resolve({
          numPages: 90,
          getPage: () => Promise.resolve({
            getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, convertToViewportPoint: (x: number, y: number) => [x, 800 - y] }),
            getTextContent: () => textOf(stopAtErrors === true),
            getOperatorList: () => Promise.resolve({ fnArray: mockScenario.operators, argsArray: mockScenario.operators.map(() => null) }),
            getStructTree: () => Promise.resolve(null),
            render: () => ({ promise: Promise.resolve() }),
            cleanup: () => undefined,
          }),
          destroy: () => Promise.resolve(),
        }),
      };
    },
  };
}, { virtual: true });

async function readPage() {
  const { readPdfPage } = await import('../pdf-rasterize.service');
  return readPdfPage(Buffer.from('%PDF-1.7'), 85);
}

beforeEach(() => {
  mockOpened.length = 0;
  Object.assign(mockScenario, { firstItems: [], operators: [], strict: 'items' });
});

describe('readPdfPage: η στρώση κειμένου δηλωμένη (Ε8)', () => {
  it('κείμενο στην πρώτη ανάγνωση ⇒ present, χωρίς δεύτερο άνοιγμα του αρχείου', async () => {
    Object.assign(mockScenario, { firstItems: [ITEM], operators: [SHOW_TEXT] });
    const reading = await readPage();
    expect(reading.textLayer).toEqual({ state: 'present', recovered: false });
    expect(reading.items.map((item) => item.text)).toEqual(['DIMENSIONS']);
    expect(mockOpened).toHaveLength(1);
  });

  it('καμία εντολή κειμένου ⇒ absent (σαρωμένη σελίδα), χωρίς δεύτερο άνοιγμα', async () => {
    Object.assign(mockScenario, { operators: [MOVE_TO] });
    const reading = await readPage();
    expect(reading.textLayer).toEqual({ state: 'absent' });
    expect(mockOpened).toHaveLength(1);
  });

  it('εντολές κειμένου + άδειο κείμενο ⇒ ΜΙΑ αυστηρή ανάγνωση· αν βρει κείμενο, present + recovered', async () => {
    Object.assign(mockScenario, { operators: [MOVE_TO, SHOW_TEXT], strict: 'items' });
    const reading = await readPage();
    expect(reading.textLayer).toEqual({ state: 'present', recovered: true });
    expect(reading.items.map((item) => item.text)).toEqual(['DIMENSIONS']);
    expect(mockOpened).toEqual([{ stopAtErrors: undefined }, { stopAtErrors: true }]);
  });

  it('η αυστηρή ανάγνωση πετά ⇒ lost, με το σφάλμα του pdf.js ως αιτία (όχι σιωπηλή «σαρωμένη»)', async () => {
    Object.assign(mockScenario, { operators: [SHOW_TEXT], strict: 'throws' });
    const reading = await readPage();
    expect(reading.textLayer).toEqual({ state: 'lost', reason: 'Error: FormatError: Bad FCHECK in flate stream' });
    expect(reading.items).toEqual([]);
    expect(reading.png).toEqual(Buffer.from([1]));
    expect(mockOpened).toHaveLength(2);
  });

  it('η αυστηρή ανάγνωση ολοκληρώνεται άδεια ⇒ absent: δεν υπάρχει σφάλμα να δηλωθεί, άρα όχι lost', async () => {
    Object.assign(mockScenario, { operators: [SHOW_TEXT], strict: 'empty' });
    const reading = await readPage();
    expect(reading.textLayer).toEqual({ state: 'absent' });
    expect(mockOpened).toHaveLength(2);
  });
});
