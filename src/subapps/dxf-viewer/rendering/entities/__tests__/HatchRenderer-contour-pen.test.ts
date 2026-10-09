// Stub Firebase auth chain before any imports — BaseEntityRenderer → PhaseManager
// transitively touches firestore in test env (mirror HatchRenderer-transparency.test).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-507 — **CONTOUR PEN** (μοντέλο ArchiCAD «fill contour pen»).
 *
 * Το περιστατικό (Giorgio, `47_ergasia.dxf`): κάθε εισαγόμενη γραμμοσκίαση εμφανιζόταν με
 * **διπλή γραμμή** στο όριό της. Αιτία: στο AutoCAD το HATCH **δεν** έχει δικό του περίγραμμα —
 * το όριο είναι **ξεχωριστή οντότητα** (POLYLINE/LINE) που έρχεται με το ίδιο DXF και
 * ζωγραφίζεται μόνη της. Ο `HatchRenderer` ζωγράφιζε **πάντα** κι ένα δικό του, χωρίς καμία
 * συνθήκη ⇒ δύο γραμμές πάνω στην ίδια διαδρομή.
 *
 * Η λύση **δεν** είναι «μην ζωγραφίζεις ποτέ»: μια γραμμοσκίαση που φτιάχνει ο χρήστης **μέσα**
 * στον Νέστορα θα έμενε χωρίς ορατό όριο. Το περίγραμμα γίνεται **ρητή ιδιότητα**:
 *   - **imported** → `{ visible: false }` (AutoCAD parity, γράφεται στη γέννηση)
 *   - **user-created** → πεδίο **απόν** ⇒ ορατό
 */

import { HatchRenderer } from '../HatchRenderer';
import type { EntityModel, RenderOptions } from '../../types/Types';
import type { HatchContourPen } from '../../../types/entities';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { hatchFillImageCache } from '../shared/shared-image-caches';

interface MockCtxCall { fn: string; args: readonly unknown[] }

/** Mock 2D ctx που καταγράφει ΚΑΙ τα stroke ops ΚΑΙ το στυλ που ίσχυε τη στιγμή τους. */
function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  let strokeStyle = '';
  let lineWidth = 0;
  // ADR-510 Φ2 — «ενεργό» dash pattern (ΤΕΛΕΥΤΑΙΟ setLineDash πριν το stroke), ίδιο ιδίωμα
  // με strokeStyle/lineWidth παρακάτω: το stroke() καταγράφει το state που ίσχυε ΤΗ ΣΤΙΓΜΗ του.
  let dash: readonly number[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const canvas = {
    width, height, clientWidth: width, clientHeight: height,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }),
  };
  const ctx = {
    canvas,
    save: record('save'), restore: record('restore'),
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'),
    closePath: record('closePath'), clip: record('clip'), fill: record('fill'),
    // Το stroke καταγράφει το ΕΝΕΡΓΟ στυλ — έτσι ελέγχουμε χρώμα/πάχος/dash περιγράμματος.
    stroke: (...args: unknown[]): unknown => { calls.push({ fn: 'stroke', args: [strokeStyle, lineWidth, dash, ...args] }); return undefined; },
    setLineDash: (...args: unknown[]): unknown => {
      calls.push({ fn: 'setLineDash', args });
      dash = args[0] as readonly number[];
      return undefined;
    },
    createPattern: () => null,
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(_v: string) {},
    set fillStyle(_v: string) {},
    set strokeStyle(v: string) { strokeStyle = v; },
    set lineWidth(v: number) { lineWidth = v; },
    set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set shadowBlur(_v: number) {}, set shadowColor(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

/** Solid γραμμοσκίαση: το ΜΟΝΟ `stroke()` που μπορεί να συμβεί είναι το περίγραμμα. */
function solidHatch(contourPen?: HatchContourPen): EntityModel {
  return {
    id: 'h', type: 'hatch', visible: true, fillType: 'solid',
    fillColor: '#112233', boundaryPaths: [SQUARE],
    ...(contourPen && { contourPen }),
  } as unknown as EntityModel;
}

function renderWith(contourPen?: HatchContourPen) {
  const mock = createMockCtx();
  const renderer = new HatchRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  renderer.render(solidHatch(contourPen), {} as RenderOptions);
  return mock.calls.filter((c) => c.fn === 'stroke');
}

describe('HatchRenderer — contour pen (ADR-507)', () => {
  it('🔴 imported (`visible:false`) ⇒ ΚΑΝΕΝΑ περίγραμμα — τέλος η διπλή γραμμή', () => {
    expect(renderWith({ visible: false })).toHaveLength(0);
  });

  it('user-created (πεδίο ΑΠΟΝ) ⇒ περίγραμμα ορατό — ο χρήστης δεν μένει χωρίς όριο', () => {
    expect(renderWith(undefined)).toHaveLength(1);
  });

  it('ρητό `visible:true` ⇒ περίγραμμα ορατό', () => {
    expect(renderWith({ visible: true })).toHaveLength(1);
  });

  it('απόν `color` ⇒ κληρονομεί το χρώμα της γραμμοσκίασης', () => {
    const [outline] = renderWith({ visible: true });
    expect(outline.args[0]).toBe('#112233');
  });

  it('ρητό `color` ⇒ υπερισχύει του χρώματος γεμίσματος', () => {
    const [outline] = renderWith({ visible: true, color: '#ff00ff' });
    expect(outline.args[0]).toBe('#ff00ff');
  });

  it('απόν `lineweightMm` ⇒ hairline 1px (η συμπεριφορά πριν το contour pen)', () => {
    const [outline] = renderWith({ visible: true });
    expect(outline.args[1]).toBe(1);
  });

  it('ρητό `lineweightMm` ⇒ πάχος AutoCAD LWT, όχι hairline', () => {
    const [outline] = renderWith({ visible: true, lineweightMm: 0.5 });
    expect(outline.args[1]).not.toBe(1);
    expect(outline.args[1] as number).toBeGreaterThan(0);
  });

  it('🔴 απόν `linetypeName` ⇒ ΣΥΜΠΑΓΗΣ γραμμή (zero regression για ήδη αποθηκευμένα)', () => {
    const [outline] = renderWith({ visible: true });
    expect(outline.args[2]).toEqual([]);
  });

  it('απόν `color`/`lineweightMm` ΜΑΖΙ με απόν `linetypeName` ⇒ κι αυτό συμπαγές', () => {
    const [outline] = renderWith({ visible: true, color: '#ff00ff', lineweightMm: 0.5 });
    expect(outline.args[2]).toEqual([]);
  });

  it("`linetypeName: 'Continuous'` (ρητό) ⇒ συμπαγής γραμμή, ίδιο με απόν", () => {
    const [outline] = renderWith({ visible: true, linetypeName: 'Continuous' });
    expect(outline.args[2]).toEqual([]);
  });

  it("άγνωστο `linetypeName` ⇒ συμπαγής γραμμή (καμία εξαφάνιση/σφάλμα)", () => {
    const [outline] = renderWith({ visible: true, linetypeName: 'ΑΝΥΠΑΡΚΤΟ_LTYPE' });
    expect(outline.args[2]).toEqual([]);
  });

  it("ρητό `linetypeName: 'Dashed'` ⇒ μη-κενό dash array (ζωγραφίζεται διακεκομμένο)", () => {
    const [outline] = renderWith({ visible: true, linetypeName: 'Dashed' });
    expect((outline.args[2] as number[]).length).toBeGreaterThan(0);
  });

  it('το `visible:false` ΔΕΝ σβήνει το γέμισμα — μόνο το περίγραμμα', () => {
    const mock = createMockCtx();
    const renderer = new HatchRenderer(mock.ctx);
    renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    renderer.render(solidHatch({ visible: false }), {} as RenderOptions);

    expect(mock.calls.filter((c) => c.fn === 'stroke')).toHaveLength(0);
    expect(mock.calls.filter((c) => c.fn === 'fill').length).toBeGreaterThan(0);
  });
});

describe('contour pen — η ΓΕΝΝΗΣΗ γράφει ρητή τιμή (δεν εξάγεται στον renderer)', () => {
  it('ΚΑΘΕ imported γραμμοσκίαση γεννιέται με `{ visible:false }`', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildHatchSceneEntity } = require('../../../utils/dxf-hatch-converter');

    const imported = buildHatchSceneEntity({
      id: 'h_imported', layer: 'L', boundaryPaths: [SQUARE],
      patternName: 'ANSI31', solid: false, patternTypeCode: 1, islandCode: 0,
    }) as { contourPen?: HatchContourPen };

    // `buildHatchSceneEntity` είναι SSoT ΚΑΙ για τους δύο importers (native + R12/R14 xdata),
    // οπότε αυτό το ένα test καλύπτει και τα δύο μονοπάτια εισαγωγής.
    expect(imported.contourPen).toEqual({ visible: false });
  });
});

/**
 * ADR-909 Β2.6 — **η γραμμοσκίαση στο χαρτί.** Μετρημένο ζωντανά (2026-10-09, δημόσια κάτοψη 3732×4096,
 * `monochrome`): περίγραμμα **1 px** σε γκρι `#808080`, δίπλα σε τοίχους 4,92 px μαύρους — το `fillColor`
 * και η πένα έφταναν **ωμά** στον καμβά, γιατί ο `HatchRenderer` δεν περνά από το `setupStyle`.
 */
describe('HatchRenderer — print pass (ADR-909 Β2.6)', () => {
  const PUBLIC_IMAGE = { style: 'monochrome' as const, dpi: 694, minLineWidthPx: 4 };

  afterEach(clearPrintColorPolicy);

  it('🔴 `monochrome` ⇒ περίγραμμα ΜΑΥΡΟ, στο dpi της απόδοσης (0,18 mm @ 694 dpi ≈ 4,92 px)', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    const [outline] = renderWith({ visible: true });
    expect(outline.args[0]).toBe('#000000');
    expect(outline.args[1]).toBeCloseTo((0.18 * 694) / 25.4, 5);
  });

  it('🔴 ρητό χρώμα πένας ⇒ περνά ΚΙ ΑΥΤΟ από την πολιτική (ήταν η διαρροή χρώματος)', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    const [outline] = renderWith({ visible: true, color: '#ff00ff' });
    expect(outline.args[0]).toBe('#000000');
  });

  it('`colour` ⇒ το χρώμα της πένας επιβιώνει', () => {
    setPrintColorPolicy({ style: 'colour', dpi: 300 });
    const [outline] = renderWith({ visible: true, color: '#ff00ff' });
    expect(outline.args[0]).toBe('#ff00ff');
  });

  it('🔑 μετά το print pass η οθόνη είναι ΟΠΩΣ ΠΡΙΝ: χρώμα γεμίσματος, hairline 1 px', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    renderWith({ visible: true });
    clearPrintColorPolicy();
    const [outline] = renderWith({ visible: true });
    expect(outline.args).toEqual(expect.arrayContaining(['#112233', 1]));
  });

  describe('γέμισμα εικόνας', () => {
    const imageHatch = {
      id: 'hi', type: 'hatch', visible: true, fillType: 'image', fillColor: '#112233',
      imageFill: { assetId: 'stone', tileWidth: 300, tileHeight: 300 },
      boundaryPaths: [SQUARE], contourPen: { visible: false },
    } as unknown as EntityModel;

    function requestedKeys(): string[] {
      const spy = jest.spyOn(hatchFillImageCache, 'resolve').mockReturnValue(null);
      const renderer = new HatchRenderer(createMockCtx().ctx);
      renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      renderer.render(imageHatch, {} as RenderOptions);
      const keys = spy.mock.calls.map(([spec]) => (typeof spec === 'string' ? spec : spec.key));
      spy.mockRestore();
      return keys;
    }

    it('οθόνη ⇒ ζητά ΑΚΡΙΒΩΣ το ιστορικό κλειδί (καμία ακύρωση αποθήκης)', () => {
      expect(requestedKeys()).toStrictEqual(['stone']);
    });

    it('🔴 `monochrome` ⇒ ζητά τη ΓΚΡΙ εκδοχή — άλλη εγγραφή από την έγχρωμη', () => {
      setPrintColorPolicy(PUBLIC_IMAGE);
      const [key] = requestedKeys();
      expect(key).not.toBe('stone');
      expect(key.startsWith('stone')).toBe(true);
    });

    it('`colour` ⇒ η έγχρωμη, ίδια εγγραφή με την οθόνη (ό,τι είδε ο καμβάς δεν ξαναφορτώνεται)', () => {
      setPrintColorPolicy({ style: 'colour', dpi: 300 });
      expect(requestedKeys()).toStrictEqual(['stone']);
    });
  });
});
