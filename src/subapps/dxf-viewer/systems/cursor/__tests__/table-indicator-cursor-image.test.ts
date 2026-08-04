/**
 * 🔴 ADR-739 §31 / **ADR-754 §14** — οι **ζωγραφισμένοι** δείκτες του πίνακα.
 *
 * Τρεις παγίδες κλειδώνουν εδώ, και **καμία τους δεν δίνει σφάλμα όταν σπάσει** — απλώς ο
 * δείκτης δεν αλλάζει ποτέ, που είναι ακριβώς το παράπονο που γέννησε τη φάση:
 *
 *  1. **Φράγμα συσκευής**: Windows/Chrome απορρίπτουν **σιωπηλά** δείκτη πάνω από ~32 device-px.
 *  2. **Σημείο ενέργειας**: δηλώνεται σε **εμφανιζόμενα** CSS px, που διαφέρουν ανά διαδρομή
 *     εκπομπής (`image-set(... Nx)` vs σκέτο `url()`) — σε `dpr < 1` το κέντρο ξεφεύγει.
 *  3. **PNG, όχι SVG**: ο Chrome απορρίπτει SVG data-URL δείκτες.
 *
 * ⚠️ Το `getContext('2d')` της jsdom είναι κενό, οπότε —όπως και το test του σταυρονήματος—
 * μετριέται το **συμβόλαιο ζωγραφικής** (ποιες κλήσεις, με ποια σειρά, σε ποιες συντεταγμένες)
 * και το **σχήμα της τιμής** που επιστρέφεται. Το «φαίνεται;» δεν απαντιέται από κανένα test:
 * τον δείκτη τον ζωγραφίζει ο ΟΣ, **έξω** από τον καμβά (ADR-754 §14.4).
 */

import {
  buildTableArrowCursorValue,
  buildTableFillCursorValue,
} from '../table-indicator-cursor-image';

interface FillRectCall {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly style: string;
}

interface MockCtx {
  beginPath: jest.Mock; moveTo: jest.Mock; lineTo: jest.Mock; closePath: jest.Mock;
  stroke: jest.Mock; fill: jest.Mock; fillRect: jest.Mock; scale: jest.Mock;
  strokeStyle: string; fillStyle: string; lineWidth: number; lineJoin: string; lineCap: string;
}

let ctx: MockCtx;
let fillRects: FillRectCall[];
let canvas: { width: number; height: number; getContext: jest.Mock; toDataURL: jest.Mock };
const origCreate = document.createElement.bind(document);
const origDpr = window.devicePixelRatio;

const setDpr = (v: number) =>
  Object.defineProperty(window, 'devicePixelRatio', { value: v, configurable: true, writable: true });

beforeEach(() => {
  fillRects = [];
  ctx = {
    beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), closePath: jest.fn(),
    stroke: jest.fn(), fill: jest.fn(), scale: jest.fn(),
    // Το χρώμα καταγράφεται **τη στιγμή** της κλήσης: η σειρά «φωτοστέφανο πρώτο» είναι η
    // προδιαγραφή, και ένα σκέτο `toHaveBeenCalledWith` δεν τη βλέπει.
    fillRect: jest.fn((x: number, y: number, w: number, h: number) =>
      fillRects.push({ x, y, w, h, style: ctx.fillStyle })),
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineJoin: '', lineCap: '',
  };
  canvas = {
    width: 0, height: 0,
    getContext: jest.fn(() => ctx),
    toDataURL: jest.fn(() => 'data:image/png;base64,ABC'),
  };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : origCreate(tag),
  );
  setDpr(1);
});

afterEach(() => {
  jest.restoreAllMocks();
  setDpr(origDpr);
});

// ──────────────────────────────────────────────────────────────────────────────
// Τα δύο βέλη — καρφί ότι η εξαγωγή του ρασταροποιητή δεν άλλαξε τίποτα
// ──────────────────────────────────────────────────────────────────────────────

describe('buildTableArrowCursorValue — αμετάβλητο μετά την εξαγωγή του κοινού ρασταροποιητή', () => {
  it('dpr 1 ⇒ σκέτο url με κέντρο 10 και εφεδρεία `pointer`', () => {
    expect(buildTableArrowCursorValue('down')).toBe('url("data:image/png;base64,ABC") 10 10, pointer');
    expect(canvas.width).toBe(20);
  });

  it('dpr 2 ⇒ `image-set` στο φυσικό μέγεθος, σημείο ενέργειας σε CSS px', () => {
    setDpr(2);
    // cssSize 16 (16×2 = 32 device px = το φράγμα), σημείο ενέργειας 8.
    expect(buildTableArrowCursorValue('right'))
      .toBe('image-set(url("data:image/png;base64,ABC") 2x) 8 8, pointer');
    expect(canvas.width).toBe(32);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it('χαράζει το περίγραμμα και το βάφει: φωτοστέφανο πρώτο, γέμισμα μετά', () => {
    buildTableArrowCursorValue('down');
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(6);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('«δεξιά» = το ΙΔΙΟ σχήμα με εναλλαγμένους άξονες, όχι δεύτερος πίνακας σημείων', () => {
    buildTableArrowCursorValue('down');
    const down = ctx.lineTo.mock.calls.map(([x, y]) => [x, y]);
    ctx.lineTo.mockClear();
    buildTableArrowCursorValue('right');
    const right = ctx.lineTo.mock.calls.map(([x, y]) => [y, x]);
    expect(right).toEqual(down);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-754 §14 — ο λεπτός μαύρος σταυρός της λαβής συμπλήρωσης
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §14 buildTableFillCursorValue — ο λεπτός μαύρος σταυρός (Excel parity)', () => {
  it('dpr 1 ⇒ κουτί 14 px, σημείο ενέργειας στο κέντρο, εφεδρεία `crosshair`', () => {
    expect(buildTableFillCursorValue()).toBe('url("data:image/png;base64,ABC") 7 7, crosshair');
    expect(canvas.width).toBe(14);
    expect(canvas.height).toBe(14);
  });

  /**
   * 🔑 **ΚΑΜΙΑ ΚΛΙΜΑΚΩΣΗ, ΚΑΜΙΑ ΓΡΑΜΜΗ.** Ο σταυρός είναι μία ράβδος πάχους ενός pixel: ένα
   * `scale()` + `stroke()` σε CSS px θα την άπλωνε σε δύο pixel μισής έντασης — γκρίζος, θολός
   * σταυρός, δηλαδή το αντίθετο του «λεπτός και μαύρος». Το test καρφώνει την **απόφαση**, όχι
   * το αποτέλεσμα: το αποτέλεσμα δεν φαίνεται σε jsdom.
   */
  it('🔑 ζωγραφίζει με γεμισμένα ορθογώνια σε pixel συσκευής — ΟΧΙ scale/stroke', () => {
    buildTableFillCursorValue();
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(fillRects).toHaveLength(4);
  });

  it('φωτοστέφανο πρώτο (λευκό), μαύρες ράβδοι μετά — αλλιώς χάνεται πάνω στη μπλε λαβή', () => {
    buildTableFillCursorValue();
    expect(fillRects.map((r) => r.style)).toEqual(['#ffffff', '#ffffff', '#000000', '#000000']);
  });

  it('ο σταυρός είναι ΚΕΝΤΡΑΡΙΣΜΕΝΟΣ — το ίδιο σημείο με το σημείο ενέργειας', () => {
    buildTableFillCursorValue();
    const [, , horizontal, vertical] = fillRects;
    // dpr 1: κουτί 14, ράβδος 1 ⇒ αρχή στο round((14−1)/2) = 7, κέντρο 7,5 ≈ hotspot 7.
    expect(horizontal).toEqual({ x: 1, y: 7, w: 12, h: 1, style: '#000000' });
    expect(vertical).toEqual({ x: 7, y: 1, w: 1, h: 12, style: '#000000' });
  });

  it('το φωτοστέφανο φτάνει από άκρη σε άκρη — κλείνει και τις τέσσερις αιχμές', () => {
    buildTableFillCursorValue();
    const [haloH, haloV] = fillRects;
    expect(haloH).toEqual({ x: 0, y: 6, w: 14, h: 3, style: '#ffffff' });
    expect(haloV).toEqual({ x: 6, y: 0, w: 3, h: 14, style: '#ffffff' });
  });

  /**
   * 🔑 **ΕΝΑ ΟΛΟΚΛΗΡΟ PIXEL ΑΝΑ ΒΗΜΑ dpr** — ο κανόνας που ακολουθούν και οι δείκτες του ΟΣ.
   * Κλάσμα εδώ σημαίνει εξομάλυνση, και εξομάλυνση σε ράβδο ενός pixel σημαίνει γκρι.
   */
  it.each([
    [1, 14, 1],
    [2, 28, 2],
    [3, 32, 3],
  ])('🔑 dpr %s ⇒ κουτί %s device-px, ράβδος %s device-px (ακέραια, πάντα)', (dpr, box, bar) => {
    setDpr(dpr);
    buildTableFillCursorValue();
    expect(canvas.width).toBe(box);
    expect(fillRects[2].h).toBe(bar);
    expect(fillRects[3].w).toBe(bar);
  });

  it('🔴 το φυσικό μέγεθος μένει ≤ 32 device-px σε ΚΑΘΕ dpr — αλλιώς σιωπηλή απόρριψη', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.5, 3, 4]) {
      setDpr(dpr);
      buildTableFillCursorValue();
      expect(canvas.width).toBeLessThanOrEqual(32);
    }
  });

  it('dpr 2 ⇒ `image-set` με το σημείο ενέργειας σε ΕΜΦΑΝΙΖΟΜΕΝΑ CSS px', () => {
    setDpr(2);
    // cssSize 14 (14×2 = 28 ≤ 32), εμφανίζεται στα 14 CSS px ⇒ κέντρο 7.
    expect(buildTableFillCursorValue())
      .toBe('image-set(url("data:image/png;base64,ABC") 2x) 7 7, crosshair');
  });

  /**
   * 🔴 Η διόρθωση του 2026-07-04, εφαρμοσμένη και εδώ από τον κοινό ρασταροποιητή: σε `dpr < 1`
   * (σελίδα στο 80%) το PNG εκπέμπεται ως σκέτο `url()` και δείχνεται **1:1 στο φυσικό** του
   * μέγεθος — άρα το σημείο ενέργειας είναι το μισό **εκείνου**, όχι του CSS.
   */
  it('🔴 dpr < 1 ⇒ σημείο ενέργειας στο κέντρο της ΕΜΦΑΝΙΖΟΜΕΝΗΣ εικόνας', () => {
    setDpr(0.8);
    // cssSize 14 → φυσικό round(14×0,8) = 11 ⇒ κέντρο 6 (όχι 7).
    expect(buildTableFillCursorValue()).toBe('url("data:image/png;base64,ABC") 6 6, crosshair');
    expect(canvas.width).toBe(11);
  });

  it('χωρίς context 2D ⇒ η λέξη-κλειδί εφεδρείας, ποτέ εξαίρεση', () => {
    canvas.getContext = jest.fn(() => null);
    expect(buildTableFillCursorValue()).toBe('crosshair');
  });
});
