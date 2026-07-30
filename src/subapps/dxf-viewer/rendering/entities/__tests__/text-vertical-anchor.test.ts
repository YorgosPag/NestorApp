/**
 * ADR-635 Φ C.26 — DXF TEXT vertical anchor: the BASELINE (group 73 = 0) is not the BOTTOM row.
 *
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΠΙΝΕΤΑΙ ΕΔΩ (μετρημένο, όχι εικαζόμενο)
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * Ο εισαγωγέας συμπτύσσει 73 = 0 (baseline) και 73 = 1 (bottom) στη σειρά `B` του 9-σημείου
 * πλέγματος, γιατί το πλέγμα έχει ΤΡΕΙΣ σειρές ενώ το DXF έχει ΤΕΣΣΕΡΙΣ κάθετες καταστάσεις.
 * Μετά, `B` → canvas `'bottom'` → ο ζωγράφος ανεβάζει τα glyphs κατά μία ΠΛΗΡΗ κάτω προεξοχή
 * (descent) της γραμματοσειράς.
 *
 * Μέτρηση στο `47_ergasia.dxf` (1.127/1.127 TEXT έχουν 73 = 0, ύψος 0,5· Roboto):
 *   descent = |−555| ÷ 2048 × em(0,7033) = **0,1906 μονάδες** = 38,1% του ύψους κειμένου.
 *   Κελί πίνακα 0,9000: το cap-top περνούσε **0,1286 ΜΕΣΑ** από την πάνω γραμμή του κελιού.
 * Το ίδιο το αρχείο αποδεικνύει ότι η άγκυρα είναι το baseline:
 *   baseline − κάτω γραμμή = 0,2000 · πάνω γραμμή − (baseline + 0,5) = 0,2000 — συμμετρία που
 *   ισχύει ΜΟΝΟ με μηδενική μετατόπιση.
 *
 * Η σουίτα ελέγχει και τα ΤΕΣΣΕΡΑ σημεία της αλυσίδας (group codes → κόμβος → στυλ → βαφή →
 * κουτί), γιατί το σφάλμα επιβίωνε ακριβώς επειδή κάθε κρίκος ήταν «λογικός» μόνος του.
 *
 * ⚠️ Το stub έχει descent 0,2 em ΣΚΟΠΙΜΑ ≠ 0 και cap ratio 0,8 ΣΚΟΠΙΜΑ ≠ 1: με μηδενικό descent
 * η λάθος και η σωστή συμπεριφορά θα ήταν ταυτόσημες και κανένα test δεν θα έπιανε τίποτα.
 */

// Firebase auth chain reaches BaseEntityRenderer via PhaseManager → GripProvider → user-settings.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import { resolveEntityFont } from '../../../text-engine/fonts/font-resolver';
import { getGlyphRun } from '../../../text-engine/fonts/glyph-path-cache';
import { drawGlyphRunToCanvas } from '../../../text-engine/fonts/glyph-run-draw';
import {
  anchorBandFraction, baselineOffsetFromAnchor,
} from '../../../text-engine/fonts/text-vertical-metrics';
import { isBaselineAnchored, mapTextAttachment } from '../../../utils/dxf-text-anchor';
import { convertText } from '../../../utils/dxf-text-converters';
import { extractFirstRunStyle, resolveVerticalAnchor } from '../../../hooks/canvas/dxf-text-style-extractor';
import { projectSceneTextToDxf, type TextSceneShape } from '../../../bim/text/project-scene-text';
import { verticalAnchorToRow } from '../../../bim/text/text-lines';
import { resolveTextBox } from '../../../bim/text/text-box';
import type { AnySceneEntity } from '../../../types/scene';

// ── Το ΠΡΑΓΜΑΤΙΚΟ κελί του δείγματος (γραμμή «407731.13», στήλη X) ────────────────────────
const CELL_BOTTOM = 4502436.1572;
const CELL_TOP = 4502437.0572;
const ANCHOR_Y = 4502436.3572; // group 21
const TEXT_H = 0.5;            // group 40
/** Η συμμετρία που γράφει το AutoCAD στο ίδιο το αρχείο. */
const ACAD_GAP = 0.2;

/** Ένα TEXT όπως το γράφει το AutoCAD: δεξιά στοίχιση (72 = 2), baseline (73 = 0). */
function acadTextRecord(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    '1': '407731.13',
    '10': '407568.741', '20': String(ANCHOR_Y),   // insertion (αριστερό άκρο γραμμάτων)
    '11': '407574.241', '21': String(ANCHOR_Y),   // alignment point = Η ΑΓΚΥΡΑ
    '40': String(TEXT_H),
    '72': '2', '73': '0',
    ...overrides,
  };
}

let cleanups: Array<() => void> = [];
beforeAll(() => {
  // Το group 7 του δείγματος δίνει 'arial.ttf' → υποκατάσταση 'Liberation Sans'· καταχωρούμε
  // και τα δύο ονόματα ώστε η διαδρομή glyph-path (tier 1) να είναι η ενεργή, όπως στο app.
  cleanups = [installStubFont(0.6, 'arial'), installStubFont(0.6, 'Liberation Sans')];
});
afterAll(() => { for (const c of cleanups) c(); });

// Stub metrics στο GLYPH_REFERENCE_SIZE 100: ascent 80, descent 20, cap 0.8 ⇒ em = 1,25 × ύψος.
const STUB_ASCENT_EM = 0.8;
const STUB_DESCENT_EM = 0.2;

describe('Κρίκος 1 — group codes: το 73 = 0 δεν χωράει στο 9-σημείο πλέγμα', () => {
  it('72 = 2 / 73 = 0 → σειρά «B» ΚΑΙ σημαία baseline (η σειρά μόνη της είναι απώλεια)', () => {
    expect(mapTextAttachment(2, 0)).toBe('BR');
    expect(isBaselineAnchored(2, 0)).toBe(true);
  });

  it('73 = 1 (bottom) → ΙΔΙΑ σειρά «B», ΧΩΡΙΣ σημαία — εδώ ακριβώς χανόταν η πληροφορία', () => {
    expect(mapTextAttachment(2, 1)).toBe('BR');
    expect(isBaselineAnchored(2, 1)).toBe(false);
  });

  it('72 = 4 (Middle) υπερισχύει του 73 και στους ΔΥΟ χάρτες — δεν μπορούν να διαφωνήσουν', () => {
    expect(mapTextAttachment(4, 0)).toBe('MC');
    expect(isBaselineAnchored(4, 0)).toBe(false);
  });

  it('72 = 3 (Aligned) / 5 (Fit) ΚΑΘΟΝΤΑΙ στο baseline (τεντώνονται οριζόντια, όχι κάθετα)', () => {
    expect(isBaselineAnchored(3, 0)).toBe(true);
    expect(isBaselineAnchored(5, 0)).toBe(true);
  });
});

describe('Κρίκος 2 — εισαγωγή: η σημαία επιβιώνει ως τον κόμβο και το στυλ', () => {
  const sceneOf = (rec: Record<string, string>): AnySceneEntity =>
    convertText(rec, 'L', 0) as AnySceneEntity;

  it('73 = 0 → textNode.baselineAnchored, και το παράγωγο στυλ λέει «alphabetic»', () => {
    const e = sceneOf(acadTextRecord()) as unknown as TextSceneShape;
    expect(e.textNode?.baselineAnchored).toBe(true);
    expect(resolveVerticalAnchor(e.textNode)).toBe('alphabetic');
    expect(extractFirstRunStyle(e)?.textBaseline).toBe('alphabetic');
    // Η ΟΡΙΖΟΝΤΙΑ στοίχιση (Φ C.25) μένει ανέπαφη — δεν ξαναγράφεται από αυτή τη φάση.
    expect(extractFirstRunStyle(e)?.textAlign).toBe('right');
  });

  it('73 = 1 → ΚΑΜΙΑ σημαία, στυλ «bottom» (η μόνη περίπτωση που όντως είναι bottom)', () => {
    const e = sceneOf(acadTextRecord({ '73': '1' })) as unknown as TextSceneShape;
    expect(e.textNode?.baselineAnchored).toBeUndefined();
    expect(extractFirstRunStyle(e)?.textBaseline).toBe('bottom');
  });

  it('η σημαία φτάνει ΚΑΙ στο flat DxfText που βλέπουν renderer / λαβές / 3D', () => {
    const e = sceneOf(acadTextRecord()) as unknown as TextSceneShape;
    expect(projectSceneTextToDxf(e, 'id').textStyle?.textBaseline).toBe('alphabetic');
  });
});

describe('Κρίκος 3 — βαφή: το «alphabetic» είναι μετατόπιση ΜΗΔΕΝ', () => {
  const arial = () => resolveEntityFont('arial')!;
  const runOf = (t: string) => getGlyphRun(arial().font, arial().cacheName, t, 1);

  /** Καταγραφικό ctx — μας ενδιαφέρει μόνο το `translate`. */
  function makeCtx() {
    const translates: number[][] = [];
    const ctx = {
      save: () => {}, restore: () => {}, fill: () => {}, scale: () => {},
      translate: (x: number, y: number) => { translates.push([x, y]); },
    } as unknown as CanvasRenderingContext2D;
    return { ctx, translates };
  }

  const EM = 50; // ⇒ ascentPx 40, descentPx 10

  it.each([
    ['alphabetic', 0],
    ['bottom', -EM * STUB_DESCENT_EM],
    ['top', EM * STUB_ASCENT_EM],
    ['middle', (EM * STUB_ASCENT_EM - EM * STUB_DESCENT_EM) / 2],
  ] as Array<[CanvasTextBaseline, number]>)(
    '%s → το baseline μπαίνει στο originY %+f px', (anchor, expected) => {
      const { ctx, translates } = makeCtx();
      drawGlyphRunToCanvas(ctx, runOf('AB'), 0, 100, EM, 'left', anchor);
      expect(translates[0][1]).toBeCloseTo(100 + expected, 9);
    },
  );

  it('«alphabetic» ≠ «bottom»: διαφέρουν ΑΚΡΙΒΩΣ κατά μία κάτω προεξοχή', () => {
    const a = makeCtx(); const b = makeCtx();
    drawGlyphRunToCanvas(a.ctx, runOf('AB'), 0, 0, EM, 'left', 'alphabetic');
    drawGlyphRunToCanvas(b.ctx, runOf('AB'), 0, 0, EM, 'left', 'bottom');
    expect(a.translates[0][1] - b.translates[0][1]).toBeCloseTo(EM * STUB_DESCENT_EM, 9);
  });

  it('ο κανόνας άγκυρας→baseline είναι ΕΝΑΣ, χωρίς μονάδα — px, em ή ÷ ύψος δίνουν το ίδιο', () => {
    const m = { ascent: 4, descent: 1 };
    expect(baselineOffsetFromAnchor('alphabetic', m)).toBe(0);
    expect(baselineOffsetFromAnchor('bottom', m)).toBe(1);
    expect(baselineOffsetFromAnchor('top', m)).toBe(-4);
    expect(baselineOffsetFromAnchor('middle', m)).toBe(-1.5);
    // Άγνωστες canvas τιμές κρατούν την ιστορική συμπεριφορά του 'top' (καμία DXF σημασία).
    expect(baselineOffsetFromAnchor('hanging', m)).toBe(-4);
  });

  it('οι διακοσμήσεις ξαναβασίζονται από ΤΟΝ ΙΔΙΟ κανόνα (0 / 0,5 / 1 / ascent÷ζώνη)', () => {
    const m = { ascent: 4, descent: 1 };
    expect(anchorBandFraction('top', m)).toBeCloseTo(0, 9);
    expect(anchorBandFraction('middle', m)).toBeCloseTo(0.5, 9);
    expect(anchorBandFraction('bottom', m)).toBeCloseTo(1, 9);
    expect(anchorBandFraction('alphabetic', m)).toBeCloseTo(0.8, 9);
    expect(anchorBandFraction('alphabetic', { ascent: 0, descent: 0 })).toBe(0); // εκφυλισμένο
  });
});

describe('Κρίκος 4 — κουτί: το ορθογώνιο ακολουθεί τα γράμματα (μέτρηση ≡ βαφή)', () => {
  const boxOf = (rec: Record<string, string>) => {
    const scene = convertText(rec, 'L', 0) as unknown as TextSceneShape;
    return resolveTextBox(projectSceneTextToDxf(scene, 'id'));
  };
  const edges = (rec: Record<string, string>) => {
    const b = boxOf(rec);
    return { top: b.center.y + b.halfLength, bottom: b.center.y - b.halfLength };
  };

  it('baseline-αγκυρωμένο: το μελάνι απλώνεται γύρω από το ΙΔΙΟ το `position`', () => {
    const { top, bottom } = edges(acadTextRecord());
    // stub: inkAscent = inkDescent = οι μετρικές της γραμματοσειράς, ÷ ύψος κειμένου × 1,25.
    expect(top - ANCHOR_Y).toBeCloseTo(TEXT_H * STUB_ASCENT_EM * 1.25, 9);
    expect(ANCHOR_Y - bottom).toBeCloseTo(TEXT_H * STUB_DESCENT_EM * 1.25, 9);
  });

  it('bottom-αγκυρωμένο: ΟΛΟ το κουτί ανεβαίνει κατά μία κάτω προεξοχή — δύο ΔΙΑΦΟΡΕΤΙΚΕΣ γεωμετρίες', () => {
    const base = edges(acadTextRecord());
    const bot = edges(acadTextRecord({ '73': '1' }));
    const descentWorld = TEXT_H * STUB_DESCENT_EM * 1.25;
    expect(bot.bottom - base.bottom).toBeCloseTo(descentWorld, 9);
    expect(bot.top - base.top).toBeCloseTo(descentWorld, 9);
  });

  it('η σειρά ανάπτυξης πολύγραμμου μπλοκ: «alphabetic» πάει με το «B», όχι με το «T»', () => {
    expect(verticalAnchorToRow('alphabetic')).toBe('B');
    expect(verticalAnchorToRow('bottom')).toBe('B');
    expect(verticalAnchorToRow('middle')).toBe('M');
    expect(verticalAnchorToRow('top')).toBe('T');
    expect(verticalAnchorToRow(undefined)).toBe('T');
  });
});

describe('Αποδοχή — η συμμετρία που γράφει το AutoCAD μέσα στο αρχείο', () => {
  it('με μετατόπιση 0 τα δύο κενά του κελιού βγαίνουν 0,2000 / 0,2000, όπως στο AutoCAD', () => {
    // Το ύψος κεφαλαίου ΕΙΝΑΙ το group 40 εξ ορισμού του κανόνα em (Φ C.22): em × capRatio = h.
    const baseline = ANCHOR_Y + baselineOffsetFromAnchor('alphabetic', { ascent: 1, descent: 1 });
    expect(baseline - CELL_BOTTOM).toBeCloseTo(ACAD_GAP, 4);
    expect(CELL_TOP - (baseline + TEXT_H)).toBeCloseTo(ACAD_GAP, 4);
  });

  it('η ΠΑΛΙΑ συμπεριφορά («bottom») έτρωγε 95% του πάνω κενού — και σε ψηλά glyphs το ξεπερνούσε', () => {
    // Πραγματικές μετρικές Roboto: descent = 555/2048 × em, em = 0,5 ÷ (1456/2048).
    const em = TEXT_H / (1456 / 2048);
    const descent = (555 / 2048) * em;
    const wrongBaseline = ANCHOR_Y + descent;
    expect(descent).toBeCloseTo(0.1906, 4);
    // Κάτω κενό: 0,2000 → 0,3906 (σχεδόν διπλάσιο).
    expect(wrongBaseline - CELL_BOTTOM).toBeCloseTo(0.3906, 4);
    // Πάνω κενό για συμβολοσειρά ΜΟΝΟ με κεφαλαία/ψηφία («407731.13», μελάνι = ύψος cap):
    // 0,2000 → 0,0094, δηλαδή έμενε το 4,7% του αρχικού περιθωρίου.
    expect(CELL_TOP - (wrongBaseline + TEXT_H)).toBeCloseTo(0.0094, 4);
    // Κάθε glyph που ανεβαίνει πάνω από το ύψος cap έκοβε τη γραμμή του πίνακα. Μετρημένο στην
    // κεφαλίδα «α/α» (μελάνι 0,6380 λόγω της καθέτου «/»): υπέρβαση 0,1286 πάνω από τη γραμμή.
    const inkTopAlphaSlash = 0.638;
    expect(inkTopAlphaSlash - (TEXT_H + 0.0094)).toBeGreaterThan(0.12);
  });
});
