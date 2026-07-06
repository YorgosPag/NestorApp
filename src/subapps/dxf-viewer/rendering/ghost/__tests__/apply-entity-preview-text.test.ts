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
      textGripKind: 'text-move', anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(text(), preview);
    expect(ghost).not.toBe(text());
    expect(pos(ghost)).toEqual({ x: 100, y: 50 });
  });

  it('MTEXT move grip → responds (was skipped: type !== "text")', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 0, delta: { x: 100, y: 50 }, movesEntity: true,
      textGripKind: 'text-move', anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(mtext(), preview);
    expect((ghost as unknown as { type: string }).type).toBe('mtext');
    expect(pos(ghost)).toEqual({ x: 100, y: 50 });
  });

  it('MTEXT corner resize → patches the frame width (not widthFactor)', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 7, delta: { x: 60, y: -40 }, movesEntity: false,
      textGripKind: 'text-corner-se', anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(mtext(), preview) as unknown as { width: number; height: number };
    expect(ghost.width).toBeCloseTo(860, 6);
    expect(ghost.height).toBeCloseTo(290, 6);
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
      textGripKind: 'text-corner-se', anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(textNodeOnly(), preview) as unknown as { text: string; height: number };
    // Flat text injected → TextRenderer paints the ghost (was: missing → early-return → no ghost).
    expect(ghost.text).toBe('DDD');
    // Height resized from the REAL 250 box (SE corner grows height by |Δy|=40), NOT the 2.5 default.
    expect(ghost.height).toBeCloseTo(290, 6);
  });

  it('zero delta → returns the same reference (no ghost paint)', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'mx', gripIndex: 0, delta: { x: 0, y: 0 }, movesEntity: true,
      textGripKind: 'text-move', anchorPos: { x: 0, y: 0 },
    };
    const e = mtext();
    expect(applyEntityPreview(e, preview)).toBe(e);
  });
});
