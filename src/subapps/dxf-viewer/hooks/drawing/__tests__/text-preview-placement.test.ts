/**
 * ADR-508 §text-parity (Giorgio 2026-07-07) — φάντασμα + ενδείξεις τοποθέτησης για «Κείμενο» (`text`)
 * και «Πολυγραμμικό Κείμενο» (`mtext`).
 *
 * Επαληθεύει ότι:
 *  · ο generator παράγει `PreviewText` (type:'text', preview:true) και για τα δύο single-click εργαλεία,
 *  · κοντά σε παρειά μέλους το σημείο εισαγωγής κουμπώνει flush + φέρει τις ΙΔΙΕΣ κυανές `faceDimensions`
 *    με τη γραμμή (κοινό `resolveLineListeningPlacement` snap),
 *  · μακριά → σημείο = cursor, χωρίς κυανές (μόνο λευκά ίχνη/OSNAP αλλού),
 *  · το commit (`resolveFaceFlushInsertionPoint`) εφαρμόζει το ΙΔΙΟ flush εκτός αν νικά ΟΡΑΤΟ OSNAP
 *    (preview ≡ commit, 1:1 mirror του line commit).
 * Pure — πραγματικά module stores (settable), μηδέν canvas/async scheduler.
 */

import { generatePreviewEntity } from '../drawing-preview-generator';
import {
  resolveLineListeningPlacement,
  resolveFaceFlushInsertionPoint,
} from '../line-preview-helpers';
import { sceneSnapTargetsStore, type SceneSnapTargets } from '../../../bim/framing/scene-snap-targets';
import type { LinearMemberSnapTarget } from '../../../bim/framing/linear-member-face-snap';
import { clearImmediateSnap, setImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { setTextRotationOrigin, clearTextRotationOrigin, setTextEditingActive } from '../../../systems/cursor/TextRotationStore';
import type { PreviewText } from '../drawing-types';

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

// text/mtext επιστρέφουν ΠΡΙΝ φτάσουν στο createEntity → stub που δεν καλείται ποτέ.
const noopCreateEntity = () => null;

describe('text/mtext preview placement (ADR-508 §text-parity)', () => {
  beforeEach(() => {
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 }); // wpp = 1
    clearImmediateSnap();
    clearTextRotationOrigin(); // φάση τοποθέτησης by default
    setTextEditingActive(false); // πεδίο κλειστό → επιτρέπεται ghost
  });
  afterEach(() => {
    sceneSnapTargetsStore.reset();
    clearImmediateSnap();
    clearTextRotationOrigin();
  });

  // ── generatePreviewEntity: PreviewText παραγωγή ──────────────────────────────
  it('text μακριά από μέλη → PreviewText στη θέση cursor, χωρίς κυανές', () => {
    sceneSnapTargetsStore.reset();
    const ghost = generatePreviewEntity('text', [], { x: 700, y: 700 }, false, noopCreateEntity, 'mm') as PreviewText;
    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('text');
    expect(ghost.preview).toBe(true);
    expect(ghost.position.x).toBeCloseTo(700);
    expect(ghost.position.y).toBeCloseTo(700);
    expect(ghost.faceDimensions).toBeUndefined();
  });

  it('text κοντά σε παρειά → σημείο εισαγωγής flush (y≈2) + κυανές faceDimensions', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const ghost = generatePreviewEntity('text', [], { x: 300, y: 50 }, false, noopCreateEntity, 'mm') as PreviewText;
    expect(ghost.type).toBe('text');
    expect(ghost.position.x).toBeCloseTo(300);
    expect(ghost.position.y).toBeCloseTo(2); // flush στην παρειά
    expect(ghost.faceDimensions).toBeDefined();
    expect((ghost.faceDimensions?.dims.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('mtext συμπεριφέρεται ΙΔΙΑ με text (ίδιο single-click ghost)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const ghost = generatePreviewEntity('mtext', [], { x: 300, y: 50 }, false, noopCreateEntity, 'mm') as PreviewText;
    expect(ghost.type).toBe('text');
    expect(ghost.position.y).toBeCloseTo(2);
    expect(ghost.faceDimensions).toBeDefined();
  });

  // ── Rotation phase (μετά το 1ο κλικ): θέση κλειδωμένη, γωνία προς τον κέρσορα ──
  it('rotation phase → θέση = origin (κλειδωμένη), rotationDeg προς τον κέρσορα, χωρίς κυανές', () => {
    setTargets({ lineTargets: [horizontalLine] }); // ακόμη και με στόχους: καμία κυανή στη rotation phase
    setTextRotationOrigin({ x: 100, y: 100 });
    const ghost = generatePreviewEntity('text', [], { x: 200, y: 200 }, false, noopCreateEntity, 'mm') as PreviewText;
    expect(ghost.type).toBe('text');
    expect(ghost.position.x).toBeCloseTo(100); // ΚΛΕΙΔΩΜΕΝΗ θέση (origin), όχι ο cursor
    expect(ghost.position.y).toBeCloseTo(100);
    expect(ghost.rotationDeg).toBeCloseTo(45); // (200,200) από (100,100) = 45°
    expect(ghost.faceDimensions).toBeUndefined();
  });

  it('rotation phase → οριζόντιος κέρσορας δίνει 0° κλίση', () => {
    setTextRotationOrigin({ x: 0, y: 0 });
    const ghost = generatePreviewEntity('mtext', [], { x: 500, y: 0 }, false, noopCreateEntity, 'mm') as PreviewText;
    expect(ghost.position.x).toBeCloseTo(0);
    expect(ghost.rotationDeg).toBeCloseTo(0);
  });

  it('πεδίο ανοιχτό (editing active) → κανένα ghost (null) ενώ γράφει ο χρήστης', () => {
    setTargets({ lineTargets: [horizontalLine] });
    setTextEditingActive(true);
    expect(generatePreviewEntity('text', [], { x: 300, y: 50 }, false, noopCreateEntity, 'mm')).toBeNull();
  });

  // ── resolveLineListeningPlacement: κοινό point ⊕ dims από ΕΝΑ snap ────────────
  it('resolveLineListeningPlacement: κοντά σε παρειά → flush point + dims (ίδιο snap)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const { point, faceDimensions } = resolveLineListeningPlacement({ x: 300, y: 50 }, 'mm');
    expect(point.y).toBeCloseTo(2);
    expect(faceDimensions).not.toBeNull();
  });

  it('resolveLineListeningPlacement: μακριά → point = cursor, dims = null', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const { point, faceDimensions } = resolveLineListeningPlacement({ x: 0, y: 5000 }, 'mm');
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(5000);
    expect(faceDimensions).toBeNull();
  });

  // ── resolveFaceFlushInsertionPoint (commit ≡ preview, OSNAP priority) ─────────
  it('commit κοντά σε παρειά, χωρίς OSNAP → flush (ίδιο με το preview point)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const cursor = { x: 300, y: 50 };
    const previewPt = resolveLineListeningPlacement(cursor, 'mm').point;
    const commitPt = resolveFaceFlushInsertionPoint(cursor, 'mm');
    expect(commitPt.x).toBeCloseTo(previewPt.x);
    expect(commitPt.y).toBeCloseTo(previewPt.y);
    expect(commitPt.y).toBeCloseTo(2);
  });

  it('commit με ΟΡΑΤΟ OSNAP → πραγματική κορυφή νικάει το flush (σημείο αυτούσιο)', () => {
    setTargets({ lineTargets: [horizontalLine] });
    setImmediateSnap({ found: true, point: { x: 300, y: 50 }, mode: 'endpoint' });
    const cursor = { x: 300, y: 50 };
    const commitPt = resolveFaceFlushInsertionPoint(cursor, 'mm');
    expect(commitPt.x).toBeCloseTo(300);
    expect(commitPt.y).toBeCloseTo(50); // ΟΧΙ flush στο y=2
  });

  it('commit μακριά από μέλος → σημείο αυτούσιο', () => {
    setTargets({ lineTargets: [horizontalLine] });
    const commitPt = resolveFaceFlushInsertionPoint({ x: 0, y: 5000 }, 'mm');
    expect(commitPt.x).toBeCloseTo(0);
    expect(commitPt.y).toBeCloseTo(5000);
  });
});
