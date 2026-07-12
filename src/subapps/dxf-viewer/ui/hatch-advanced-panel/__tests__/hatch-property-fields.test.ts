/**
 * ADR-507 — descriptor completeness for the left-palette hatch fields.
 *
 * Guards that every group field targets a REAL bridge command key (so read/write
 * can never silently no-op — ribbon & panel share ONE SSoT), that the gradient group
 * carries the right visibility key, and that control types + selection-only gating
 * are coherent. Mirror του `line-property-fields.test.ts`.
 */

import { describe, it, expect } from '@jest/globals';
import { HATCH_PROPERTY_GROUPS, HATCH_SELECTION_ONLY_KEYS } from '../hatch-property-fields';
import {
  HATCH_RIBBON_KEYS,
  isHatchRibbonStringKey,
  isHatchRibbonNumberKey,
  isHatchRibbonToggleKey,
  isHatchRibbonReadoutKey,
} from '../../ribbon/hooks/bridge/hatch-command-keys';

const allFields = HATCH_PROPERTY_GROUPS.flatMap((g) => g.fields);
const groupById = (id: string) => HATCH_PROPERTY_GROUPS.find((g) => g.id === id);
const byKeySuffix = (suffix: string) => allFields.find((f) => f.commandKey.endsWith(suffix));

/** A field key is valid if ANY of the per-kind hatch bridge guards owns it. */
const isValidHatchKey = (k: string): boolean =>
  isHatchRibbonStringKey(k) || isHatchRibbonNumberKey(k) ||
  isHatchRibbonToggleKey(k) || isHatchRibbonReadoutKey(k);

describe('HATCH_PROPERTY_GROUPS descriptor', () => {
  it('targets only valid bridge command keys', () => {
    for (const f of allFields) {
      expect(isValidHatchKey(f.commandKey)).toBe(true);
    }
  });

  it('labels every field with the shared ribbon.commands.hatchEditor.* keys', () => {
    for (const f of allFields) {
      expect(f.labelKey.startsWith('ribbon.commands.hatchEditor.')).toBe(true);
    }
  });

  it('keeps general/pattern/info always-visible and gates gradient', () => {
    expect(groupById('general')?.visibilityKey).toBeUndefined();
    expect(groupById('pattern')?.visibilityKey).toBeUndefined();
    expect(groupById('info')?.visibilityKey).toBeUndefined();
    expect(groupById('gradient')?.visibilityKey).toBe(HATCH_RIBBON_KEYS.visibility.gradient);
  });

  it('gives every numeric field a numericInput config (editable)', () => {
    for (const f of allFields) {
      if (f.control === 'numeric') {
        expect(f.numericInput).toBeDefined();
        expect(f.numericInput?.editable).toBe(true);
      }
    }
  });

  it('routes each field to the matching palette control', () => {
    expect(byKeySuffix('.fillColor')?.control).toBe('color');
    expect(byKeySuffix('.gradientColor1')?.control).toBe('color');
    expect(byKeySuffix('.layer')?.control).toBe('select');
    expect(byKeySuffix('.fillType')?.control).toBe('select');
    expect(byKeySuffix('.patternName')?.control).toBe('select');
    expect(byKeySuffix('.islandStyle')?.control).toBe('select');
    expect(byKeySuffix('.transparency')?.control).toBe('numeric');
    expect(byKeySuffix('.patternScale')?.control).toBe('numeric');
    expect(byKeySuffix('.sendToBack')?.control).toBe('toggle');
    expect(byKeySuffix('.doubleCrossHatch')?.control).toBe('toggle');
    expect(byKeySuffix('.gradientSingleColor')?.control).toBe('toggle');
    expect(byKeySuffix('.area')?.control).toBe('readout');
  });

  it('provides static options for select fields the bridge does not feed live', () => {
    for (const suffix of ['.fillType', '.patternName', '.islandStyle', '.gradientType', '.lineweight']) {
      expect(byKeySuffix(suffix)?.options.length).toBeGreaterThan(0);
    }
  });

  it('marks transparency / πίσω πλάνο / εμβαδόν as selection-only (hidden in draft)', () => {
    expect(HATCH_SELECTION_ONLY_KEYS.has(HATCH_RIBBON_KEYS.params.transparency)).toBe(true);
    expect(HATCH_SELECTION_ONLY_KEYS.has(HATCH_RIBBON_KEYS.toggles.sendToBack)).toBe(true);
    expect(HATCH_SELECTION_ONLY_KEYS.has(HATCH_RIBBON_KEYS.readouts.area)).toBe(true);
    // Layer/pattern/color are NOT selection-only — they drive draw-defaults too.
    expect(HATCH_SELECTION_ONLY_KEYS.has(HATCH_RIBBON_KEYS.stringParams.layer)).toBe(false);
  });
});
