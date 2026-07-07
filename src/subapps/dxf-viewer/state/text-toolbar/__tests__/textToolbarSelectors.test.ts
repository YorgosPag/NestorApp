/**
 * ADR-344 Phase 5.A — tests for computeMixedValues.
 */

import { describe, it, expect } from '@jest/globals';
import { computeMixedValues, type TextFlatGeometry } from '../textToolbarSelectors';
import { DEFAULT_TOOLBAR_VALUES } from '../useTextToolbarStore';
import type {
  DxfTextNode,
  TextRunStyle,
  TextParagraph,
  DxfColor,
} from '../../../text-engine/types';
import { DXF_COLOR_BY_LAYER } from '../../../text-engine/types';

/**
 * ADR-557 — flat entity geometry SSoT (renderer + commit truth). `computeMixedValues`
 * reads rotation / widthFactor / height / fontFamily from HERE, not the AST node.
 */
function flat(overrides: Partial<TextFlatGeometry> = {}): TextFlatGeometry {
  return {
    rotation: 0,
    widthFactor: 1,
    height: 2.5,
    fontFamily: 'Arial',
    ...overrides,
  };
}

function style(overrides: Partial<TextRunStyle> = {}): TextRunStyle {
  return {
    fontFamily: 'Arial',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 2.5,
    widthFactor: 1,
    obliqueAngle: 0,
    tracking: 1,
    color: DXF_COLOR_BY_LAYER,
    ...overrides,
  };
}

function paragraph(text: string, s: TextRunStyle): TextParagraph {
  return {
    runs: [{ text, style: s }],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
  };
}

function node(s: TextRunStyle, overrides: Partial<DxfTextNode> = {}): DxfTextNode {
  return {
    paragraphs: [paragraph('hello', s)],
    attachment: 'ML',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
    ...overrides,
  };
}

describe('computeMixedValues', () => {
  it('empty selection returns defaults', () => {
    expect(computeMixedValues([])).toEqual(DEFAULT_TOOLBAR_VALUES);
  });

  it('single entity exposes its style verbatim', () => {
    const result = computeMixedValues([
      { node: node(style({ bold: true })), layerId: 'WALLS', flat: flat({ height: 4 }) },
    ]);
    expect(result.bold).toBe(true);
    expect(result.fontHeight).toBe(4);
    expect(result.layerId).toBe('WALLS');
  });

  it('multi-selection with agreement keeps the value', () => {
    const result = computeMixedValues([
      { node: node(style({ bold: true })), layerId: 'L1', flat: flat() },
      { node: node(style({ bold: true })), layerId: 'L1', flat: flat() },
    ]);
    expect(result.bold).toBe(true);
    expect(result.layerId).toBe('L1');
  });

  it('multi-selection with disagreement collapses to null', () => {
    const result = computeMixedValues([
      { node: node(style({ bold: true })), layerId: 'L1', flat: flat() },
      { node: node(style({ bold: false })), layerId: 'L1', flat: flat() },
    ]);
    expect(result.bold).toBeNull();
  });

  it('layer disagreement collapses layerId', () => {
    const result = computeMixedValues([
      { node: node(style()), layerId: 'A', flat: flat() },
      { node: node(style()), layerId: 'B', flat: flat() },
    ]);
    expect(result.layerId).toBeNull();
  });

  it('color DxfColor union compared by value', () => {
    const aci5: DxfColor = { kind: 'ACI', index: 5 };
    const r1 = computeMixedValues([
      { node: node(style({ color: aci5 })), layerId: '0', flat: flat() },
      { node: node(style({ color: { kind: 'ACI', index: 5 } })), layerId: '0', flat: flat() },
    ]);
    expect(r1.color).toEqual(aci5);

    const r2 = computeMixedValues([
      { node: node(style({ color: aci5 })), layerId: '0', flat: flat() },
      { node: node(style({ color: { kind: 'ACI', index: 6 } })), layerId: '0', flat: flat() },
    ]);
    expect(r2.color).toBeNull();
  });

  it('justification disagreement collapses to null', () => {
    const result = computeMixedValues([
      { node: node(style(), { attachment: 'TL' }), layerId: '0', flat: flat() },
      { node: node(style(), { attachment: 'MC' }), layerId: '0', flat: flat() },
    ]);
    expect(result.justification).toBeNull();
  });

  // ── ADR-557 flat entity SSoT (rotation / widthFactor / height / fontFamily) ──

  it('rotation agreement preserves the FLAT value (not the stale node)', () => {
    const result = computeMixedValues([
      // node.rotation stays 0 (commit never writes it); the flat SSoT is 45.
      { node: node(style(), { rotation: 0 }), layerId: '0', flat: flat({ rotation: 45 }) },
      { node: node(style(), { rotation: 0 }), layerId: '0', flat: flat({ rotation: 45 }) },
    ]);
    expect(result.rotation).toBe(45);
  });

  it('rotation disagreement collapses to null (flat SSoT)', () => {
    const result = computeMixedValues([
      { node: node(style()), layerId: '0', flat: flat({ rotation: 45 }) },
      { node: node(style()), layerId: '0', flat: flat({ rotation: 90 }) },
    ]);
    expect(result.rotation).toBeNull();
  });

  it('widthFactor reads the FLAT value, not the run style', () => {
    const result = computeMixedValues([
      // run.style.widthFactor stays 1 (commit never updates it); the flat SSoT is 0.8.
      { node: node(style({ widthFactor: 1 })), layerId: '0', flat: flat({ widthFactor: 0.8 }) },
    ]);
    expect(result.widthFactor).toBe(0.8);
  });

  it('widthFactor disagreement collapses to null (flat SSoT)', () => {
    const result = computeMixedValues([
      { node: node(style()), layerId: '0', flat: flat({ widthFactor: 0.8 }) },
      { node: node(style()), layerId: '0', flat: flat({ widthFactor: 1 }) },
    ]);
    expect(result.widthFactor).toBeNull();
  });

  it('fontHeight reads the FLAT value and collapses on disagreement', () => {
    const agree = computeMixedValues([
      { node: node(style()), layerId: '0', flat: flat({ height: 5 }) },
      { node: node(style()), layerId: '0', flat: flat({ height: 5 }) },
    ]);
    expect(agree.fontHeight).toBe(5);

    const mixed = computeMixedValues([
      { node: node(style()), layerId: '0', flat: flat({ height: 5 }) },
      { node: node(style()), layerId: '0', flat: flat({ height: 3 }) },
    ]);
    expect(mixed.fontHeight).toBeNull();
  });

  it('fontFamily reads the FLAT value (never «Μεικτή» from an empty run)', () => {
    const result = computeMixedValues([
      // The AST run carries no font, but the flat SSoT resolved a real family.
      { node: node(style({ fontFamily: '' })), layerId: '0', flat: flat({ fontFamily: 'Arial' }) },
    ]);
    expect(result.fontFamily).toBe('Arial');
  });

  it('fontFamily disagreement collapses to null (flat SSoT)', () => {
    const result = computeMixedValues([
      { node: node(style()), layerId: '0', flat: flat({ fontFamily: 'Arial' }) },
      { node: node(style()), layerId: '0', flat: flat({ fontFamily: 'Times New Roman' }) },
    ]);
    expect(result.fontFamily).toBeNull();
  });
});
