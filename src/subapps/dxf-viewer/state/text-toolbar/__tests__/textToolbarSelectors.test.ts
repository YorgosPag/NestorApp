/**
 * ADR-344 Phase 5.A — tests for computeMixedValues.
 */

import { describe, it, expect } from '@jest/globals';
import { computeMixedValues } from '../textToolbarSelectors';
import { DEFAULT_TOOLBAR_VALUES } from '../useTextToolbarStore';
import type {
  DxfTextNode,
  TextRunStyle,
  TextParagraph,
  DxfColor,
} from '../../../text-engine/types';
import { DXF_COLOR_BY_LAYER } from '../../../text-engine/types';

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
      { node: node(style({ bold: true, height: 4 })), layerId: 'WALLS' },
    ]);
    expect(result.bold).toBe(true);
    expect(result.fontHeight).toBe(4);
    expect(result.layerId).toBe('WALLS');
  });

  it('multi-selection with agreement keeps the value', () => {
    const result = computeMixedValues([
      { node: node(style({ bold: true })), layerId: 'L1' },
      { node: node(style({ bold: true })), layerId: 'L1' },
    ]);
    expect(result.bold).toBe(true);
    expect(result.layerId).toBe('L1');
  });

  it('multi-selection with disagreement collapses to null', () => {
    const result = computeMixedValues([
      { node: node(style({ bold: true })), layerId: 'L1' },
      { node: node(style({ bold: false })), layerId: 'L1' },
    ]);
    expect(result.bold).toBeNull();
  });

  it('layer disagreement collapses layerId', () => {
    const result = computeMixedValues([
      { node: node(style()), layerId: 'A' },
      { node: node(style()), layerId: 'B' },
    ]);
    expect(result.layerId).toBeNull();
  });

  it('color DxfColor union compared by value', () => {
    const aci5: DxfColor = { kind: 'ACI', index: 5 };
    const r1 = computeMixedValues([
      { node: node(style({ color: aci5 })), layerId: '0' },
      { node: node(style({ color: { kind: 'ACI', index: 5 } })), layerId: '0' },
    ]);
    expect(r1.color).toEqual(aci5);

    const r2 = computeMixedValues([
      { node: node(style({ color: aci5 })), layerId: '0' },
      { node: node(style({ color: { kind: 'ACI', index: 6 } })), layerId: '0' },
    ]);
    expect(r2.color).toBeNull();
  });

  it('justification disagreement collapses to null', () => {
    const result = computeMixedValues([
      { node: node(style(), { attachment: 'TL' }), layerId: '0' },
      { node: node(style(), { attachment: 'MC' }), layerId: '0' },
    ]);
    expect(result.justification).toBeNull();
  });

  it('rotation agreement preserves value', () => {
    const result = computeMixedValues([
      { node: node(style(), { rotation: 45 }), layerId: '0' },
      { node: node(style(), { rotation: 45 }), layerId: '0' },
    ]);
    expect(result.rotation).toBe(45);
  });
});
