/**
 * ADR-635 Φ C.25 — single-line TEXT anchor (group 11/21) + 72/73 → 9-point attachment.
 *
 * REGRESSION GUARD. The importer used to read every TEXT position from 10/20 and never
 * open 11/21, so every centered / right-justified text was drawn shifted by the whole
 * insertion→alignment distance. In Giorgio's `47_ergasia.dxf` that is 433 of 1.127 TEXT
 * entities, shifted up to ~3,3 m — a full table column — so the coordinate tables
 * overlapped each other on screen.
 *
 * The fixtures below carry the REAL group codes from that file (see the §"real file"
 * describe) so the test fails if the 11/21 read is ever removed again.
 */

import {
  attachmentToVJust,
  mapTextAttachment,
  resolveTextAnchor,
  usesAlignmentPoint,
} from '../dxf-text-anchor';
import { convertAttrib, convertText } from '../dxf-text-converters';
import type { AnySceneEntity } from '../../types/scene';

type TextScene = {
  position: { x: number; y: number };
  alignment: string;
  textNode: { attachment: string };
};

const asText = (e: AnySceneEntity | null): TextScene => {
  expect(e).not.toBeNull();
  return e as unknown as TextScene;
};

/** TEXT `data` map with distinct 10/20 and 11/21 so a wrong read is always visible. */
function textData(extra: Record<string, string> = {}): Record<string, string> {
  return {
    '10': '100', '20': '50',   // first alignment point (insertion)
    '11': '103.3', '21': '50', // second alignment point (the real anchor when 72/73 ≠ 0)
    '40': '0.5', '1': 'A', ...extra,
  };
}

describe('usesAlignmentPoint — which justifications make 11/21 the anchor', () => {
  it('is false for the DXF default (left + baseline) — 10/20 is the anchor', () => {
    expect(usesAlignmentPoint(0, 0)).toBe(false);
  });

  it('is true for Center (1), Right (2) and Middle (4)', () => {
    expect(usesAlignmentPoint(1, 0)).toBe(true);
    expect(usesAlignmentPoint(2, 0)).toBe(true);
    expect(usesAlignmentPoint(4, 0)).toBe(true);
  });

  it('is true for ANY non-baseline vertical justification, even with h = 0', () => {
    expect(usesAlignmentPoint(0, 1)).toBe(true);
    expect(usesAlignmentPoint(0, 2)).toBe(true);
    expect(usesAlignmentPoint(0, 3)).toBe(true);
  });

  it('is FALSE for Aligned (3) and Fit (5) — there 11/21 is the far end, not the anchor', () => {
    // The renderer does not stretch text; `mapHorizontalAlignment` reports these as 'left',
    // so the drawing must start at 10/20. Anchoring at 11/21 would mirror the text.
    expect(usesAlignmentPoint(3, 0)).toBe(false);
    expect(usesAlignmentPoint(5, 0)).toBe(false);
  });
});

describe('resolveTextAnchor', () => {
  it('returns 10/20 for left-baseline TEXT (historic behaviour, unchanged)', () => {
    expect(resolveTextAnchor(textData(), 0, 0)).toEqual({ x: 100, y: 50 });
  });

  it('returns 11/21 for centered TEXT — THE BUG THIS MODULE EXISTS FOR', () => {
    expect(resolveTextAnchor(textData(), 1, 0)).toEqual({ x: 103.3, y: 50 });
  });

  it('returns 11/21 for right-justified TEXT', () => {
    expect(resolveTextAnchor(textData(), 2, 0)).toEqual({ x: 103.3, y: 50 });
  });

  it('falls back to 10/20 when a justified TEXT omits 11/21 (truncated / hand-written DXF)', () => {
    // Must NOT produce NaN: the import's non-finite filter would drop the entity entirely.
    const noAlignPoint = { '10': '7', '20': '8', '40': '0.5', '1': 'A' };
    expect(resolveTextAnchor(noAlignPoint, 2, 0)).toEqual({ x: 7, y: 8 });
  });

  it('falls back to 10/20 when 11/21 is malformed', () => {
    expect(resolveTextAnchor(textData({ '11': 'oops' }), 1, 0)).toEqual({ x: 100, y: 50 });
  });
});

describe('mapTextAttachment — codes 72 + 73 → 9-point grid', () => {
  it('maps the horizontal column through the shared alignment SSoT', () => {
    expect(mapTextAttachment(0, 0)).toBe('BL');
    expect(mapTextAttachment(1, 0)).toBe('BC');
    expect(mapTextAttachment(2, 0)).toBe('BR');
  });

  it('collapses baseline (73=0) and bottom (73=1) onto the B row — the grid has no baseline slot', () => {
    expect(mapTextAttachment(0, 0)).toBe('BL');
    expect(mapTextAttachment(0, 1)).toBe('BL');
  });

  it('maps middle (73=2) and top (73=3) rows', () => {
    expect(mapTextAttachment(0, 2)).toBe('ML');
    expect(mapTextAttachment(2, 2)).toBe('MR');
    expect(mapTextAttachment(0, 3)).toBe('TL');
    expect(mapTextAttachment(1, 3)).toBe('TC');
  });

  it('treats 72=4 (Middle) as center + middle, overriding 73 per the spec', () => {
    expect(mapTextAttachment(4, 0)).toBe('MC');
    expect(mapTextAttachment(4, 3)).toBe('MC');
  });

  it('is round-trip consistent with attachmentToVJust for the T/M rows', () => {
    expect(attachmentToVJust(mapTextAttachment(0, 3))).toBe(3);
    expect(attachmentToVJust(mapTextAttachment(0, 2))).toBe(2);
    expect(attachmentToVJust(mapTextAttachment(0, 0))).toBe(0);
  });
});

describe('convertText / convertAttrib — the anchor reaches the scene entity', () => {
  it('places a LEFT TEXT at 10/20 (no regression for the 694 untouched entities)', () => {
    const e = asText(convertText(textData(), 'L1', 0));
    expect(e.position).toEqual({ x: 100, y: 50 });
    expect(e.textNode.attachment).toBe('BL');
  });

  it('places a CENTER TEXT at 11/21 with a BC attachment', () => {
    const e = asText(convertText(textData({ '72': '1' }), 'L1', 0));
    expect(e.position).toEqual({ x: 103.3, y: 50 });
    expect(e.alignment).toBe('center');
    expect(e.textNode.attachment).toBe('BC');
  });

  it('places a RIGHT TEXT at 11/21 with a BR attachment', () => {
    const e = asText(convertText(textData({ '72': '2' }), 'L1', 0));
    expect(e.position).toEqual({ x: 103.3, y: 50 });
    expect(e.alignment).toBe('right');
    expect(e.textNode.attachment).toBe('BR');
  });

  it('carries the vertical justification (73) onto the attachment — was dropped entirely before', () => {
    const e = asText(convertText(textData({ '72': '1', '73': '3' }), 'L1', 0));
    expect(e.textNode.attachment).toBe('TC');
  });

  it('applies the same rules to ATTRIB (shared single-line path, no twin)', () => {
    const e = asText(convertAttrib(textData({ '72': '2', '2': 'TAG' }), 'L1', 0));
    expect(e.position).toEqual({ x: 103.3, y: 50 });
    expect(e.textNode.attachment).toBe('BR');
  });
});

describe('real `47_ergasia.dxf` group codes (the reported overlap)', () => {
  // Verbatim from the file — the α/α cell «11» (72=1, Center) and the X cell «407710.73»
  // (72=2, Right) of the first coordinate-table row. Both sit on the same baseline y.
  const aaCell = {
    '10': '407568.3522382296', '20': '4502401.257213165', '40': '0.5', '1': '11',
    '72': '1', '11': '407568.7407102623', '21': '4502401.257213165',
  };
  const xCell = {
    '10': '407571.388868516', '20': '4502401.257213165', '40': '0.5', '1': '407710.73',
    '72': '2', '11': '407574.6907102623', '21': '4502401.257213165',
  };

  it('anchors the right-justified X value 3,3 m further right than the old 10/20 read', () => {
    const e = asText(convertText(xCell, 'Pinakas-Syntetagmenon', 0));
    expect(e.position.x).toBeCloseTo(407574.6907102623, 6);
    // The old behaviour — the whole reason the value landed on top of the α/α column.
    const shift = e.position.x - parseFloat(xCell['10']);
    expect(shift).toBeCloseTo(3.3018417463, 6);
  });

  it('the wrong anchor displaced the value by MORE than a whole column — overlap was unavoidable', () => {
    // Font-metric-free proof of the reported overlap. Both cells are right/center anchored on
    // the same baseline, so the only question is how far the value moved relative to the table
    // geometry. Column pitch = distance between the two cells' own 10/20 points.
    const columnPitch = parseFloat(xCell['10']) - parseFloat(aaCell['10']); // ≈3,036 m
    const displacement = parseFloat(xCell['11']) - parseFloat(xCell['10']); // ≈3,302 m
    expect(displacement).toBeGreaterThan(columnPitch);
    // Displacement > pitch ⇒ reading the anchor from 10/20 drops the X value INTO the α/α
    // column no matter which font renders it: that is the screenshot, and it is now fixed.
    const x = asText(convertText(xCell, 'Pinakas-Syntetagmenon', 0));
    expect(x.position.x).toBeCloseTo(parseFloat(xCell['11']), 6);
    expect(x.position.x - parseFloat(aaCell['10'])).toBeGreaterThan(columnPitch);
  });

  it('the centered α/α cell keeps its own (smaller) correction', () => {
    const aa = asText(convertText(aaCell, 'Pinakas-Syntetagmenon', 0));
    expect(aa.position.x).toBeCloseTo(407568.7407102623, 6);
    expect(aa.textNode.attachment).toBe('BC');
    // Center cells shift far less than right cells (half the cell width vs the full width) —
    // which is why the α/α column looked "almost right" while the X column was a column off.
    expect(aa.position.x - parseFloat(aaCell['10'])).toBeCloseTo(0.3884720327, 6);
  });
});
