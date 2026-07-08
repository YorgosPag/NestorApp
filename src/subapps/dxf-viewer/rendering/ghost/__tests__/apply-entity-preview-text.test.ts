/**
 * ADR-557 Φ-attachment — text/mtext rect-box live ghost preview.
 *
 * Regression guard: the live ghost (`useGripGhostPreview` → `applyEntityPreview`)
 * receives the SCENE entity, whose type is `'text'` OR `'mtext'`. The branch must
 * handle BOTH (it previously checked only `'text'`, so an MTEXT grip drag produced
 * NO live ghost — "το κείμενο δεν ανταποκρίνεται", Giorgio 2026-06-30). The box is
 * attachment-aware from `textNode.attachment` so the dragged box matches the glyphs.
 */

import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { EntityPreviewTransform } from '../entity-preview-types';
import { applyEntityPreview } from '../apply-entity-preview';
// ADR-557 Φ-attachment — the box now measures real glyph metrics (width + vertical ink).
// Pin a deterministic stub whose ink == its font metrics, so the VISUAL box equals the
// nominal em box (extent ratio 1) and these resize expectations stay machine-independent.
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __stubCleanup: () => void;
beforeAll(() => { __stubCleanup = installStubFont(); });
afterAll(() => __stubCleanup());

const text = (over: Record<string, unknown> = {}): DxfEntityUnion =>
  ({ id: 'tx', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 250,
     textNode: { attachment: 'BR' }, ...over }) as unknown as DxfEntityUnion;

const mtext = (over: Record<string, unknown> = {}): DxfEntityUnion =>
  ({ id: 'mx', type: 'mtext', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 250,
     width: 800, textNode: { attachment: 'BR' }, ...over }) as unknown as DxfEntityUnion;

const pos = (e: DxfEntityUnion) => (e as unknown as { position: { x: number; y: number } }).position;

describe('applyEntityPreview — text/mtext', () => {
  it('TEXT move grip → clones with shifted position', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'tx', gripIndex: 0, delta: { x: 100, y: 50 }, movesEntity: true,
      gripKind: { on: 'text', kind: 'text-move' }, anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(text(), preview);
    expect(ghost).not.toBe(text());
    expect(pos(ghost)).toEqual({ x: 100, y: 50 });
  });

  it('MTEXT move grip → responds (was skipped: type !== "text")', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 0, delta: { x: 100, y: 50 }, movesEntity: true,
      gripKind: { on: 'text', kind: 'text-move' }, anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(mtext(), preview);
    expect((ghost as unknown as { type: string }).type).toBe('mtext');
    expect(pos(ghost)).toEqual({ x: 100, y: 50 });
  });

  it('wide-frame MTEXT corner resize → hugs via widthFactor (Giorgio 2026-07-07), height grows', () => {
    // frame 800 ≫ content('DDD',250)=450 → the box hugs the glyphs, so a corner resize stretches
    // widthFactor (like TEXT) rather than the column frame → no snap-back to content on release.
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 7, delta: { x: 60, y: -40 }, movesEntity: false,
      gripKind: { on: 'text', kind: 'text-corner-se' }, anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(mtext(), preview) as unknown as { widthFactor?: number; height: number };
    expect(ghost.height).toBeCloseTo(290, 6);           // SE corner grows height by |Δy|=40
    expect(typeof ghost.widthFactor).toBe('number');    // hug stretch, not a frame resize
  });

  // ADR-557 Φ-attachment — the in-app scene entity carries NO flat text/height (they live
  // in textNode). The ghost must project via the commit's SSoT so it (a) uses the REAL box
  // (not the 2.5 DIMTXT default → a garbage ~1.5×2.5 transform read as a whole-entity move)
  // and (b) injects flat text/height so `TextRenderer` — which early-returns on a missing
  // flat `text` — actually paints the ghost. (Giorgio 2026-07-06: "moves whole text, no ghost".)
  const textNodeOnly = (over: Record<string, unknown> = {}): DxfEntityUnion =>
    ({ id: 'tn', type: 'text', visible: true, position: { x: 0, y: 0 },
       textNode: { paragraphs: [{ runs: [{ text: 'DDD', style: { height: 250 } }] }], attachment: 'BR' },
       ...over }) as unknown as DxfEntityUnion;

  it('textNode-only TEXT (no flat text/height) → ghost injects flat fields + uses the REAL box', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'tn', gripIndex: 7, delta: { x: 60, y: -40 }, movesEntity: false,
      gripKind: { on: 'text', kind: 'text-corner-se' }, anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(textNodeOnly(), preview) as unknown as { text: string; height: number };
    // Flat text injected → TextRenderer paints the ghost (was: missing → early-return → no ghost).
    expect(ghost.text).toBe('DDD');
    // Height resized from the REAL 250 box (SE corner grows height by |Δy|=40), NOT the 2.5 default.
    expect(ghost.height).toBeCloseTo(290, 6);
  });

  // ADR-557 / body-drag — clicking INSIDE the text body and dragging arms a whole-entity
  // MOVE (`makeTranslationPreview` → `{ movesEntity: true }`, NO grip kind). This previously
  // fell through to the generic `movesEntity` path, which patched only `position` and left
  // the flat text/height undefined → the moving in-app text ghost never painted (Giorgio
  // 2026-07-07). The text branch now also owns this case: project + shift the insertion point.
  describe('body-drag whole-entity MOVE (movesEntity, no grip kind)', () => {
    it('textNode-only TEXT → injects flat text/height + shifts position (ghost paints)', () => {
      const preview: EntityPreviewTransform = { entityId: 'tn', gripIndex: -1, delta: { x: 100, y: 50 }, movesEntity: true };
      const ghost = applyEntityPreview(textNodeOnly(), preview) as unknown as { text: string; height: number; position: { x: number; y: number } };
      expect(ghost.text).toBe('DDD');            // injected from textNode → TextRenderer paints
      expect(ghost.height).toBe(250);            // resolved from the textNode run height
      expect(ghost.position).toEqual({ x: 100, y: 50 });
    });

    it('flat TEXT → keeps text + shifts position', () => {
      const preview: EntityPreviewTransform = { entityId: 'tx', gripIndex: -1, delta: { x: 7, y: -3 }, movesEntity: true };
      const ghost = applyEntityPreview(text(), preview) as unknown as { text: string; position: { x: number; y: number } };
      expect(ghost.text).toBe('DDD');
      expect(ghost.position).toEqual({ x: 7, y: -3 });
    });

    it('textNode-only MTEXT → injects flat text + shifts position, keeps type', () => {
      const inAppM = mtext({ text: undefined, textNode: { paragraphs: [{ runs: [{ text: 'MM', style: { height: 100 } }] }], attachment: 'BR' } });
      const preview: EntityPreviewTransform = { entityId: 'mx', gripIndex: -1, delta: { x: 20, y: 20 }, movesEntity: true };
      const ghost = applyEntityPreview(inAppM, preview) as unknown as { text: string; type: string; position: { x: number; y: number } };
      expect(ghost.text).toBe('MM');
      expect(ghost.type).toBe('mtext');
      expect(ghost.position).toEqual({ x: 20, y: 20 });
    });
  });

  // ADR-557 — the text-rotation hot-grip ghost must ORBIT the user-picked pivot
  // (`rotatePivot`), not the bbox-centre (preview ≡ commit). Guards the forward that
  // threads `rotatePivot` into `applyTextGripDrag` (mirror of the line/arc/polyline).
  it('TEXT rotation ghost threads the picked pivot (orbits it, not the bbox-centre)', () => {
    const anchorPos = { x: 10, y: 0 };
    const delta = { x: -10, y: 10 }; // currentPos = anchor + delta = (0,10)
    const withPivot: EntityPreviewTransform = {
      entityId: 'tx', gripIndex: 1, delta, movesEntity: false,
      gripKind: { on: 'text', kind: 'text-rotation' },
      anchorPos, rotatePivot: { x: -500, y: -500 },
    };
    const noPivot: EntityPreviewTransform = { ...withPivot, rotatePivot: undefined };
    const gP = applyEntityPreview(text(), withPivot) as unknown as { rotation: number; position: { x: number; y: number } };
    const gN = applyEntityPreview(text(), noPivot) as unknown as { rotation: number; position: { x: number; y: number } };
    // Both produce a real rotation patch (non-trivial sweep about their pivot)...
    expect(Number.isFinite(gP.rotation)).toBe(true);
    expect(gP.rotation).not.toBe(0);
    // ...but orbiting a far-off pivot re-homes the position very differently than
    // spinning about the bbox-centre → proves `rotatePivot` is actually threaded.
    expect(Math.hypot(gP.position.x - gN.position.x, gP.position.y - gN.position.y)).toBeGreaterThan(1);
  });

  it('zero delta → returns the same reference (no ghost paint)', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 0, delta: { x: 0, y: 0 }, movesEntity: true,
      gripKind: { on: 'text', kind: 'text-move' }, anchorPos: { x: 0, y: 0 },
    };
    const e = mtext();
    expect(applyEntityPreview(e, preview)).toBe(e);
  });
});
