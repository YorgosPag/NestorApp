/**
 * ADR-510 Φ2E #5 — descriptor completeness for the left-palette line fields.
 *
 * Guards that every group field targets a REAL bridge command key (so read/write
 * can never silently no-op), that the gated groups carry the right visibility keys,
 * and that the control types + numeric configs are coherent.
 */

import { describe, it, expect } from '@jest/globals';
import { LINE_PROPERTY_GROUPS } from '../line-property-fields';
import {
  isLineToolRibbonKey,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../../ribbon/hooks/bridge/line-tool-command-keys';

const allFields = LINE_PROPERTY_GROUPS.flatMap((g) => g.fields);
const groupById = (id: string) => LINE_PROPERTY_GROUPS.find((g) => g.id === id);

describe('LINE_PROPERTY_GROUPS descriptor', () => {
  it('targets only valid bridge command keys', () => {
    for (const f of allFields) {
      expect(isLineToolRibbonKey(f.commandKey)).toBe(true);
    }
  });

  it('labels every field with the shared ribbon.commands.quickStyle.* keys', () => {
    for (const f of allFields) {
      expect(f.labelKey.startsWith('ribbon.commands.quickStyle.')).toBe(true);
    }
  });

  it('keeps «Γενικά» always-visible and gates geometry/polyline', () => {
    expect(groupById('general')?.visibilityKey).toBeUndefined();
    expect(groupById('geometry')?.visibilityKey).toBe(LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry);
    expect(groupById('polyline')?.visibilityKey).toBe(LINE_TOOL_PANEL_VISIBILITY_KEYS.widthApplicable);
  });

  it('gives every numeric field a numericInput config (editable)', () => {
    for (const f of allFields) {
      if (f.control === 'numeric') {
        expect(f.numericInput).toBeDefined();
        expect(f.numericInput?.editable).toBe(true);
      }
    }
  });

  it('routes color to the color control and appearance pickers to selects', () => {
    const byKeySuffix = (suffix: string) =>
      allFields.find((f) => f.commandKey.endsWith(suffix));
    expect(byKeySuffix('.color')?.control).toBe('color');
    expect(byKeySuffix('.layer')?.control).toBe('select');
    expect(byKeySuffix('.linetype')?.control).toBe('select');
    expect(byKeySuffix('.lineweight')?.control).toBe('select');
    expect(byKeySuffix('.length')?.control).toBe('numeric');
    expect(byKeySuffix('.transparency')?.control).toBe('numeric');
  });

  it('covers the full AutoCAD geometry field set (line-only)', () => {
    const geom = groupById('geometry')?.fields.map((f) => f.commandKey) ?? [];
    for (const suffix of ['.length', '.angle', '.startX', '.startY', '.endX', '.endY', '.deltaX', '.deltaY']) {
      expect(geom.some((k) => k.endsWith(suffix))).toBe(true);
    }
  });
});
