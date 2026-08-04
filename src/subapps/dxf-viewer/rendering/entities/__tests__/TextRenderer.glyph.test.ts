/**
 * ADR-530 / ADR-557 Φάση C — TextRenderer.paintText delegation unit tests.
 *
 * The glyph-vs-CSS paint DECISION now lives in the shared SSoT `paintTextRun`
 * (`text-engine/fonts/glyph-run-draw.ts`, covered by glyph-run-draw.test.ts) — the SAME
 * routine the 3D textured-plane converter uses. Here we verify only that `paintText`
 * FORWARDS to that SSoT with the correct run params (origin / height / align / baseline /
 * resolved / tracking). The font modules are mocked so no real TTF is loaded in the suite.
 *
 * ADR-635 Φ C.22 — ο `paintText` δουλεύει σε **ύψος κειμένου**, ο `paintTextRun` σε **em**. Η
 * μετατροπή (`emSizeForTextHeight`) είναι πλέον μέρος της σύμβασης που ελέγχει αυτό το αρχείο,
 * όχι λεπτομέρεια: το mock της είναι **σκόπιμα ≠ ταυτοτικό** (×1,25), ώστε αν κάποιος αφαιρέσει
 * την κλήση να πέσει το test. Με ταυτοτικό mock η παράλειψη θα ήταν **αόρατη**.
 */

import type { ResolvedFont } from '../../../text-engine/fonts';
import { paintTextRun, emSizeForTextHeight } from '../../../text-engine/fonts';

/** Ο λόγος em/ύψος του mock — ≠ 1 by design (βλ. επικεφαλίδα). */
const MOCK_EM_PER_HEIGHT = 1.25;

// Firebase auth chain reaches BaseEntityRenderer via PhaseManager → GripProvider
// → user-settings → firestore. Stub it before any imports execute so the test
// env doesn't need fetch / real firebase init. (Mirror DimensionRenderer.test.ts.)
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

jest.mock('../../../text-engine/fonts', () => ({
  resolveEntityFont: jest.fn(() => null),
  paintTextRun: jest.fn(() => 60),
  // ADR-635 Φ C.22 — ύψος κειμένου → em. ×1.25, ΠΟΤΕ ταυτοτικό (βλ. επικεφαλίδα).
  emSizeForTextHeight: jest.fn((height: number) => height * 1.25),
}));

import { TextRenderer } from '../TextRenderer';

function makeCtx() {
  return {
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 42 })),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    canvas: {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
      width: 800,
      height: 600,
    },
  } as unknown as CanvasRenderingContext2D;
}

const resolved: ResolvedFont = { font: {} as never, cacheName: 'Liberation Sans' };

describe('TextRenderer.paintText → shared paintTextRun SSoT (ADR-557 Φάση C)', () => {
  beforeEach(() => {
    (paintTextRun as jest.Mock).mockClear();
    (emSizeForTextHeight as jest.Mock).mockClear();
  });

  it('forwards the run params (resolved font + tracking) to paintTextRun', () => {
    const ctx = makeCtx();
    const width = (new TextRenderer(ctx) as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(5, 7, 'AB', 100, 'center', 'middle', resolved, 2);

    // Το ΥΨΟΣ ΚΕΙΜΕΝΟΥ 100 περνά από τον κανόνα ύψους→em πριν φτάσει στον ζωγράφο.
    expect(emSizeForTextHeight).toHaveBeenCalledWith(100, resolved);
    expect(paintTextRun).toHaveBeenCalledWith(ctx, 'AB', {
      originX: 5, originY: 7, emSize: 100 * MOCK_EM_PER_HEIGHT,
      align: 'center', baseline: 'middle', resolved, tracking: 2,
    });
    expect(width).toBe(60); // returns the SSoT's advance width
  });

  it('forwards a null font (CSS fallback tier) unchanged, tracking defaults to 1', () => {
    const ctx = makeCtx();
    (new TextRenderer(ctx) as unknown as {
      paintText: (...a: unknown[]) => number;
    }).paintText(0, 0, 'A', 50, 'left', 'top', null);

    expect(emSizeForTextHeight).toHaveBeenCalledWith(50, null);
    expect(paintTextRun).toHaveBeenCalledWith(ctx, 'A', {
      originX: 0, originY: 0, emSize: 50 * MOCK_EM_PER_HEIGHT,
      align: 'left', baseline: 'top', resolved: null, tracking: 1,
    });
  });
});

/**
 * ADR-753 §21 — **πού ξεκινά η γραμμή στην οθόνη**: ο `paintLayoutLines` περνά από τον ΕΝΑ
 * κανόνα αγκύρωσης (`anchorOffset`) που μοιράζεται με explode / clip / πίνακα.
 *
 * 🔴 Γιατί γράφτηκε: μεταλλάσσοντας το πρόσημο του `anchorOffset`, οι σουίτες του
 * `glyph-run-draw` και του `bim/table` κοκκίνισαν — και οι **44 σουίτες / 542 tests** του
 * `rendering/entities` έμειναν πράσινες. Ο ζωγράφος της οθόνης, δηλαδή το πιο ορατό από τα
 * πέντε σημεία, ήταν ΑΚΑΛΥΠΤΟΣ: κάθε κεντραρισμένο MTEXT θα ζωγραφιζόταν μια ολόκληρη λέξη
 * μακριά χωρίς κανένα test να το δει. Ακριβώς το σχήμα του ADR-739 Φ.Δ βήμα 8.
 *
 * Το `text-horizontal-anchor` ΔΕΝ mock-άρεται (άλλη διαδρομή από το mock του barrel), οπότε
 * εδώ τρέχει ο πραγματικός κανόνας.
 */
describe('ADR-753 §21 — paintLayoutLines: η αγκύρωση τοποθετεί ολόκληρο το μπλοκ', () => {
  const WORLD_TO_PX = 2;
  const LINE_W = 20;                       // κόσμος ⇒ 40 px
  const ORIGIN_X = 100;

  const mkSpan = () => ({
    text: 'AB', xWorld: 0, widthWorld: LINE_W, heightWorld: 10,
    style: {}, decoration: {}, yOffsetWorld: 0,
  });

  const mkLine = (xOffsetWorld = 0) => ({
    spans: [mkSpan()], widthWorld: LINE_W, xOffsetWorld, spacingRatio: 1,
  });

  /** Το `originX` που έφτασε στον ζωγράφο για τη δοσμένη αγκύρωση. */
  function paintedX(align: 'left' | 'center' | 'right', xOffsetWorld = 0): number {
    (paintTextRun as jest.Mock).mockClear();
    const ctx = makeCtx();
    (new TextRenderer(ctx) as unknown as {
      paintLayoutLines: (...a: unknown[]) => void;
    }).paintLayoutLines(ORIGIN_X, 50, [mkLine(xOffsetWorld)], {
      firstOffsetPx: 0, screenHeight: 10, worldToPx: WORLD_TO_PX, align,
      baseline: 'top', fontMemo: new Map(), fallbackFill: '#ffffff',
    });
    return ((paintTextRun as jest.Mock).mock.calls[0][2] as { originX: number }).originX;
  }

  it("'left': η γραμμή ξεκινά ΠΑΝΩ στο σημείο εισαγωγής", () => {
    expect(paintedX('left')).toBeCloseTo(ORIGIN_X, 9);
  });

  it("'right': η γραμμή ΤΕΛΕΙΩΝΕΙ στο σημείο εισαγωγής (μετατόπιση = όλο το πλάτος σε px)", () => {
    expect(paintedX('right')).toBeCloseTo(ORIGIN_X - LINE_W * WORLD_TO_PX, 9);
  });

  it("'center': μετατόπιση ΑΚΡΙΒΩΣ το μισό πλάτος", () => {
    expect(paintedX('center')).toBeCloseTo(ORIGIN_X - (LINE_W * WORLD_TO_PX) / 2, 9);
  });

  it('διάταξη LTR: δεξιά < κέντρο < αριστερά — αντιστροφή προσήμου το σπάει', () => {
    expect(paintedX('right')).toBeLessThan(paintedX('center'));
    expect(paintedX('center')).toBeLessThan(paintedX('left'));
  });

  it('🔴 δύο ΑΝΕΞΑΡΤΗΤΕΣ στοιχίσεις: η στοίχιση παραγράφου (\\pxq) προστίθεται, δεν αντικαθιστά', () => {
    // Παγίδα ADR-753 §21: το `xOffsetWorld` ΔΕΝ είναι μέρος της αγκύρωσης. Κεντρικοποιείται
    // μόνο η πρώτη· αν κάποιος τη «μαζέψει» κι αυτή μέσα στον κανόνα, η διαφορά ανάμεσα στις
    // αγκυρώσεις θα άλλαζε με το `\pxq` — εδώ οφείλει να μείνει ίδια.
    const PARA = 5; // κόσμος ⇒ +10 px σε ΚΑΘΕ αγκύρωση
    for (const a of ['left', 'center', 'right'] as const) {
      expect(paintedX(a, PARA)).toBeCloseTo(paintedX(a) + PARA * WORLD_TO_PX, 9);
    }
    expect(paintedX('left', PARA) - paintedX('right', PARA))
      .toBeCloseTo(paintedX('left') - paintedX('right'), 9);
  });
});
