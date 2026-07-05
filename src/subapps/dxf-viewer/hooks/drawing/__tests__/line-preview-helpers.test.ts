/**
 * ADR-508 §line-cyan — line flush/κάθετο κούμπωμα + κυανές listening dimensions (preview ≡ commit).
 *
 * Επαληθεύει ότι το LINE tool κουμπώνει flush/κάθετα πάνω σε υφιστάμενη γραμμή/μέλος μέσω του ΙΔΙΟΥ
 * «Εγκεφάλου Έλξης» (ADR-514) που χρησιμοποιεί ο τοίχος (`resolveBimCursorSnap`, zero-width), παράγει τις
 * ΙΔΙΕΣ κυανές διαστάσεις (`faceDimensions`), και ότι το commit σημείο ταυτίζεται με το άκρο του preview.
 * Pure — πραγματικά module stores (settable), μηδέν canvas/async scheduler.
 */

import { generateLinePreview, resolveLineCommitPoint, resolveLineListeningDims } from '../line-preview-helpers';
import { sceneSnapTargetsStore, type SceneSnapTargets } from '../../../bim/framing/scene-snap-targets';
import type { LinearMemberSnapTarget } from '../../../bim/framing/linear-member-face-snap';
import { clearImmediateSnap, setImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import type { ExtendedLineEntity } from '../drawing-types';

/** Οριζόντια υφιστάμενη ΓΡΑΜΜΗ: άξονας y=0 (x −1000..1000), zero-width thin outline (y ±2). */
const horizontalLine: LinearMemberSnapTarget = {
  id: 'line-h',
  axis: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }],
  outline: [{ x: -1000, y: 2 }, { x: 1000, y: 2 }, { x: 1000, y: -2 }, { x: -1000, y: -2 }],
};

function setTargets(t: Partial<SceneSnapTargets>): void {
  sceneSnapTargetsStore.set({
    footprints: t.footprints ?? [],
    beamTargets: t.beamTargets ?? [],
    wallTargets: t.wallTargets ?? [],
    slabTargets: t.slabTargets ?? [],
    lineTargets: t.lineTargets ?? [],
    diskTargets: t.diskTargets ?? [],
    rectTargets: t.rectTargets ?? [],
  });
}

describe('line-preview-helpers (ADR-508 §line-cyan)', () => {
  beforeEach(() => {
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 }); // wpp = 1 → dim offsets σε px
    clearImmediateSnap();
  });
  afterEach(() => {
    sceneSnapTargetsStore.reset();
    clearImmediateSnap();
  });

  // ── PREVIEW: πριν το 1ο κλικ (κάθετο stub) ───────────────────────────────────
  it('χωρίς στόχους → null (ο caller δείχνει την κανονική τελεία/γραμμή)', () => {
    sceneSnapTargetsStore.reset();
    expect(generateLinePreview([], { x: 0, y: 50 }, 'mm')).toBeNull();
    expect(generateLinePreview([{ x: -500, y: -500 }], { x: 0, y: 50 }, 'mm')).toBeNull();
  });

  it('πριν το κλικ, κοντά σε γραμμή → κάθετο stub-φάντασμα flush + κυανές διαστάσεις', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const ghost = generateLinePreview([], { x: 0, y: 50 }, 'mm') as ExtendedLineEntity;
    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('line');
    expect(ghost.preview).toBe(true);
    // start = flush στην παρειά προς την πλευρά του cursor (y≈2)· end = κάθετα προς τα έξω (y >> 2).
    expect(ghost.start.x).toBeCloseTo(0);
    expect(ghost.start.y).toBeCloseTo(2);
    expect(ghost.end.x).toBeCloseTo(0);          // κάθετο: ίδιο x
    expect(ghost.end.y).toBeGreaterThan(ghost.start.y + 100);
    // κυανές listening dims (gap-left / gap-right) παρόντες.
    expect(ghost.faceDimensions).toBeDefined();
    expect((ghost.faceDimensions?.dims.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('το κάθετο stub έχει κοντό μήκος (~300mm), ΟΧΙ το 1200mm του resolver', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const ghost = generateLinePreview([], { x: 0, y: 50 }, 'mm') as ExtendedLineEntity;
    const stubLen = Math.hypot(ghost.end.x - ghost.start.x, ghost.end.y - ghost.start.y);
    expect(stubLen).toBeCloseTo(300, 0);
  });

  it('μακριά από γραμμή (εκτός capture) → null', () => {
    setTargets({ lineTargets: [horizontalLine] });
    expect(generateLinePreview([], { x: 0, y: 5000 }, 'mm')).toBeNull();
  });

  // ── ΜΕΤΑ το 1ο κλικ: ΕΛΕΥΘΕΡΗ περιστροφή (ΟΧΙ flush κατά μήκος σώματος) ─────────
  it('awaiting-end (μετά το 1ο κλικ) → null: η γραμμή περιστρέφεται ελεύθερα, ΟΧΙ flush', () => {
    setTargets({ lineTargets: [horizontalLine] });
    // ακόμη και με τον cursor ΠΑΝΩ στη γραμμή, awaiting-end → null (ο caller δείχνει ελεύθερη γραμμή).
    expect(generateLinePreview([{ x: -5000, y: -5000 }], { x: 300, y: 50 }, 'mm')).toBeNull();
    expect(generateLinePreview([{ x: 0, y: 0 }, { x: 10, y: 10 }], { x: 300, y: 50 }, 'mm')).toBeNull();
  });

  // ── COMMIT ≡ PREVIEW (1ο κλικ: η ΑΡΧΗ κάθεται flush) ──────────────────────────
  it('commit 1ου κλικ κοντά σε γραμμή → flush σημείο ΙΔΙΟ με την ΑΡΧΗ του stub (preview ≡ commit)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const cursor = { x: 300, y: 50 };
    const stubStart = (generateLinePreview([], cursor, 'mm') as ExtendedLineEntity).start;
    const commitPt = resolveLineCommitPoint(cursor, 'mm');
    expect(commitPt.x).toBeCloseTo(stubStart.x);
    expect(commitPt.y).toBeCloseTo(stubStart.y);
    expect(commitPt.y).toBeCloseTo(2); // η αρχή πάνω στην παρειά
  });

  it('commit μακριά από μέλος → σημείο αυτούσιο (αμετάβλητο)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const far = { x: 0, y: 5000 };
    const commitPt = resolveLineCommitPoint(far, 'mm');
    expect(commitPt.x).toBeCloseTo(far.x);
    expect(commitPt.y).toBeCloseTo(far.y);
  });

  it('το armed ImmediateSnap τροφοδοτεί το preview (mirror του commit click point)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    setImmediateSnap({ found: true, point: { x: 400, y: 50 }, mode: 'endpoint' });
    // ο raw cursor αγνοείται· χρησιμοποιείται το armed snap (x=400) → centerAlong=400.
    const ghost = generateLinePreview([], { x: -999, y: -999 }, 'mm') as ExtendedLineEntity;
    expect(ghost).not.toBeNull();
    expect(ghost.start.x).toBeCloseTo(400);
  });

  // ── ΜΕΤΑ το 1ο κλικ: listening dims ΧΩΡΙΣ flush (Revit temp dims, ADR-508 §line-cyan) ──────
  it('resolveLineListeningDims: κοντά σε παρειά → κυανές διαστάσεις (χωρίς μετακίνηση σημείου)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const dims = resolveLineListeningDims({ x: 300, y: 50 }, 'mm');
    expect(dims).not.toBeNull();
    expect((dims?.dims.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('resolveLineListeningDims: μακριά από παρειά (ελεύθερη κίνηση) → null', () => {
    setTargets({ lineTargets: [horizontalLine] });
    expect(resolveLineListeningDims({ x: 0, y: 5000 }, 'mm')).toBeNull();
  });

  it('resolveLineListeningDims: χωρίς στόχους → null', () => {
    sceneSnapTargetsStore.reset();
    expect(resolveLineListeningDims({ x: 0, y: 50 }, 'mm')).toBeNull();
  });
});
