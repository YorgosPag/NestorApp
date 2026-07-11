/**
 * ADR-635 — canonical-mm import (and the toolbar Scale tool) must scale a TEXT/MTEXT
 * entity's AUTHORITATIVE height, which lives in `textNode.runs[].style.height`.
 *
 * `resolveTextHeight` reads the run `style.height` FIRST, so scaling only the flat
 * `height` is shadowed → imported DXF text rendered ~1000× too short after the mm scale
 * («κείμενα χωρίς ύψος, μία γραμμή»). These tests lock the fix: `scaleEntity` on a text
 * entity scales BOTH the flat height and the textNode run heights, via the shared
 * `scaleTextNodeRunHeights` SSoT (no duplicate scaler).
 */

import { scaleEntity } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';
import type { DxfTextNode } from '../../../text-engine/types';

function textNode(height: number): DxfTextNode {
  return {
    paragraphs: [{
      runs: [{
        text: '+95.00',
        style: {
          fontFamily: '', bold: false, italic: false, underline: false, overline: false,
          strikethrough: false, height, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: -1,
        },
      }],
      indent: 0, leftMargin: 0, rightMargin: 0, tabs: [],
      justification: 0, lineSpacingMode: 'multiple', lineSpacingFactor: 1,
    }],
    attachment: 'BL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0, isAnnotative: false, annotationScales: [], currentScale: '',
  };
}

const mkText = (h: number): Entity =>
  ({
    id: 'text_0', type: 'text', layerId: 'lyr_test', visible: true,
    position: { x: 0, y: 0 }, text: '+95.00', height: h, fontSize: h,
    textNode: textNode(h),
  } as unknown as Entity);

const nodeHeight = (patch: unknown): number | undefined =>
  (patch as { textNode?: DxfTextNode }).textNode?.paragraphs?.[0]?.runs?.[0]
    ? ((patch as { textNode: DxfTextNode }).textNode.paragraphs[0].runs[0] as { style: { height: number } }).style.height
    : undefined;

describe('ADR-635 — scaleEntity scales text height in textNode (not only flat)', () => {
  it('uniform mm-import scale ×1000 scales height but leaves widthFactor at 1 (no horizontal stretch)', () => {
    const patch = scaleEntity(mkText(0.1003), { x: 0, y: 0 }, 1000, 1000);
    expect((patch as { height: number }).height).toBeCloseTo(100.3, 3);
    expect((patch as { fontSize: number }).fontSize).toBeCloseTo(100.3, 3);
    expect(nodeHeight(patch)).toBeCloseTo(100.3, 3); // was 0.1003 (shadow) before the fix
    // ADR-636 — uniform scale must NOT stretch glyphs (was ×1000 → «τεράστιες οριζόντιες γραμμές»).
    expect((patch as { widthFactor: number }).widthFactor).toBeCloseTo(1, 6);
  });

  it('non-uniform scale: height ×|sy|, widthFactor × sx/sy (ratio)', () => {
    const patch = scaleEntity(mkText(2), { x: 0, y: 0 }, 5, 3);
    expect((patch as { height: number }).height).toBeCloseTo(6, 6);  // 2 × |sy|
    expect(nodeHeight(patch)).toBeCloseTo(6, 6);                     // textNode agrees
    expect((patch as { widthFactor: number }).widthFactor).toBeCloseTo(5 / 3, 6); // sx/sy ratio
  });

  it('e/w grip resize (sy=1) keeps widthFactor = sx (ratio == |sx| when sy===1)', () => {
    const patch = scaleEntity(mkText(2), { x: 0, y: 0 }, 4, 1);
    expect((patch as { widthFactor: number }).widthFactor).toBeCloseTo(4, 6); // unchanged behaviour
    expect((patch as { height: number }).height).toBeCloseTo(2, 6);           // sy=1 → height same
  });

  it('is a no-op for textNode when factor === 1 (returns same run height)', () => {
    const patch = scaleEntity(mkText(2.5), { x: 0, y: 0 }, 1, 1);
    expect(nodeHeight(patch)).toBeCloseTo(2.5, 6);
  });
});
