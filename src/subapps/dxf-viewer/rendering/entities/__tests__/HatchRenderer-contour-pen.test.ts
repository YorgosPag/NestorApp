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

interface MockCtxCall { fn: string; args: readonly unknown[] }

/** Mock 2D ctx που καταγράφει ΚΑΙ τα stroke ops ΚΑΙ το στυλ που ίσχυε τη στιγμή τους. */
function createMockCtx(width = 800, height = 600) {
  const calls: MockCtxCall[] = [];
  let strokeStyle = '';
  let lineWidth = 0;
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
    // Το stroke καταγράφει το ΕΝΕΡΓΟ στυλ — έτσι ελέγχουμε χρώμα/πάχος περιγράμματος.
    stroke: (...args: unknown[]): unknown => { calls.push({ fn: 'stroke', args: [strokeStyle, lineWidth, ...args] }); return undefined; },
    setLineDash: record('setLineDash'), createPattern: () => null,
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
