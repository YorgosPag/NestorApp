/**
 * ADR-443 — Tests for the permanent «Δομικά» (Structural) ribbon tab.
 *
 * Revit "Structure" tab: a PERMANENT tab (NOT contextual — must not occupy the
 * single contextual slot) with all load-bearing tools as LARGE flat buttons.
 * Clicking a tool activates it; its existing property contextual tab surfaces on
 * top (not tested here — lives in ribbon-contextual-config.ts).
 *
 * Coverage:
 *   - Tab metadata (id / label / NOT contextual)
 *   - 6 Revit-style panels, canonical ids + label keys
 *   - ALL structural tool commandKeys present + unique (no tool lost vs draw.bim.group)
 *   - EVERY button LARGE simple, no flyout/dropdown
 *   - i18n container labels (no hardcoded strings, N.11); non-empty icons; no comingSoon
 *   - Shortcuts unique
 */

import { STRUCTURAL_TAB } from '../structural-tab';
import type { RibbonCommand } from '../../types/ribbon-types';

// The 24 tool commandKeys + 3 «από κάναβο» action keys (foundation/column/wall).
const EXPECTED_COMMAND_KEYS = [
  // walls (last = ADR-441 «Τοίχοι από κάναβο» action)
  'wall', 'wall-on-entity', 'wall-region-lines', 'wall-region-inside', 'wall-region-box', 'wall-from-perimeter',
  'wall.actions.fromGrid',
  // columns & piers (last = ADR-441 «Κολώνες από κάναβο» action)
  'column', 'column-region-lines', 'column-region-inside', 'column-region-box',
  'column-discrete-from-perimeter', 'column-from-perimeter', 'column-discrete-from-perimeter-walls',
  'column.actions.fromGrid',
  // beams (last = ADR-441 «Δοκάρια από κάναβο» action)
  'beam', 'beam-from-wall', 'beam.actions.fromGrid',
  // floors & openings (+ ADR-441 «Πλάκες από κάναβο» grid actions)
  'slab', 'slab-opening', 'opening',
  'slab.actions.fromGridMat', 'slab.actions.fromGridFloor', 'slab.actions.fromGridRoof',
  // foundation (last two = «Εσχάρα από κάναβο» + «Συνδετήριες από κάναβο» actions)
  'foundation-pad', 'foundation-strip', 'foundation-tie-beam', 'foundation-strip-from-wall',
  'foundation.actions.fromGrid', 'foundation.actions.tieBeamsFromGrid',
  // circulation
  'stair', 'railing',
] as const;

function allButtons() {
  return STRUCTURAL_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function allCommands(): RibbonCommand[] {
  return allButtons().map((b) => b.command);
}

describe('ADR-443 — STRUCTURAL_TAB (permanent «Δομικά» tab)', () => {
  it('is a PERMANENT tab (id/label set, NOT contextual)', () => {
    expect(STRUCTURAL_TAB.id).toBe('structural');
    expect(STRUCTURAL_TAB.labelKey).toBe('ribbon.tabs.structural');
    expect(STRUCTURAL_TAB.isContextual).toBeUndefined();
    expect(STRUCTURAL_TAB.contextualTrigger).toBeUndefined();
  });

  it('declares the six Revit-style panels with canonical ids + label keys', () => {
    expect(STRUCTURAL_TAB.panels.map((p) => p.id)).toEqual([
      'structural-walls', 'structural-columns', 'structural-beams',
      'structural-floors', 'structural-foundation', 'structural-circulation',
    ]);
    expect(STRUCTURAL_TAB.panels.map((p) => p.labelKey)).toEqual([
      'ribbon.panels.structuralWalls', 'ribbon.panels.structuralColumns', 'ribbon.panels.structuralBeams',
      'ribbon.panels.structuralFloors', 'ribbon.panels.structuralFoundation', 'ribbon.panels.structuralCirculation',
    ]);
  });

  it('keeps ALL structural commandKeys present + unique (no tool lost vs draw.bim.group)', () => {
    const keys = allCommands().map((c) => c.commandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(EXPECTED_COMMAND_KEYS));
  });

  // ADR-441 3-mode — «από κάναβο» foundation/wall/column/beam = split-buttons (main inner
  // + 3 περιμετρικά modes στο dropdown)· ΟΛΑ τα υπόλοιπα = simple χωρίς variants.
  const GRID_SPLIT_KEYS: ReadonlySet<string> = new Set([
    'foundation.actions.fromGrid',
    'wall.actions.fromGrid',
    'column.actions.fromGrid',
    'beam.actions.fromGrid',
  ]);

  it('renders every command as a LARGE button — οι 4 «από κάναβο» είναι splits (mode dropdown)', () => {
    for (const button of allButtons()) {
      const isGridSplit = GRID_SPLIT_KEYS.has(button.command.commandKey);
      expect(button.size).toBe('large');
      expect(button.type).toBe(isGridSplit ? 'split' : 'simple');
      if (!isGridSplit) expect(button.variants).toBeUndefined();
    }
    for (const panel of STRUCTURAL_TAB.panels) {
      for (const row of panel.rows) {
        expect(row.isInFlyout).toBe(false);
      }
    }
  });

  it('κάθε «από κάναβο» split-button λιστάρει τα 3 περιμετρικά modes ως action variants', () => {
    const families: ReadonlyArray<[string, readonly string[]]> = [
      ['foundation.actions.fromGrid', ['foundation.actions.fromGrid', 'foundation.actions.fromGridCenter', 'foundation.actions.fromGridOuter']],
      ['wall.actions.fromGrid', ['wall.actions.fromGrid', 'wall.actions.fromGridCenter', 'wall.actions.fromGridOuter']],
      ['column.actions.fromGrid', ['column.actions.fromGrid', 'column.actions.fromGridCenter', 'column.actions.fromGridOuter']],
      ['beam.actions.fromGrid', ['beam.actions.fromGrid', 'beam.actions.fromGridCenter', 'beam.actions.fromGridOuter']],
    ];
    for (const [mainKey, expectedVariants] of families) {
      const grid = allButtons().find((b) => b.command.commandKey === mainKey);
      expect(grid?.type).toBe('split');
      expect(grid?.variants?.map((v) => v.action)).toEqual(expectedVariants);
    }
  });

  it('routes every label through the i18n namespace, no comingSoon, non-empty icon (N.11)', () => {
    for (const command of allCommands()) {
      expect(command.labelKey).toMatch(/^ribbon\.commands\./);
      expect(command.comingSoon).toBeFalsy();
      expect(typeof command.icon).toBe('string');
      expect(command.icon).not.toBe('');
    }
  });

  // ADR-443 icon-distinction pass: every button must carry a UNIQUE icon token so
  // no two tools share a glyph (the original bug: bim-wall×7 / bim-column×9 /
  // bim-beam×6). Regression guard for the base×method composed icon system.
  it('gives every button a UNIQUE icon token (no shared glyphs across the tab)', () => {
    const icons = allCommands().map((c) => c.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('uses distinct composed `struct-*` tokens for the wall/column/beam/foundation families', () => {
    const iconByKey = new Map(allCommands().map((c) => [c.commandKey, c.icon]));
    // Walls + columns + beams + foundation = composed base×method tokens.
    const composed = [
      'wall', 'wall-on-entity', 'wall-region-lines', 'wall-region-inside', 'wall-region-box',
      'wall-from-perimeter', 'wall.actions.fromGrid',
      'column', 'column-region-lines', 'column-region-inside', 'column-region-box',
      'column-discrete-from-perimeter', 'column-from-perimeter', 'column-discrete-from-perimeter-walls',
      'column.actions.fromGrid', 'beam', 'beam-from-wall', 'beam.actions.fromGrid',
      'foundation-pad', 'foundation-strip', 'foundation-tie-beam', 'foundation-strip-from-wall',
      'foundation.actions.fromGrid', 'foundation.actions.tieBeamsFromGrid',
    ];
    for (const key of composed) {
      expect(iconByKey.get(key)).toMatch(/^struct-/);
    }
    // Slab / opening / circulation keep their existing distinct tokens — untouched.
    expect(iconByKey.get('slab')).toBe('bim-slab');
    expect(iconByKey.get('slab-opening')).toBe('bim-slab-opening');
    expect(iconByKey.get('opening')).toBe('bim-opening');
    expect(iconByKey.get('stair')).toBe('stair');
    expect(iconByKey.get('railing')).toBe('bim-railing');
  });

  it('keeps shortcuts unique across the panels', () => {
    const shortcuts = allCommands().map((c) => c.shortcut).filter((s): s is string => !!s);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    expect(shortcuts).toEqual(expect.arrayContaining(['W', 'CL', 'BM', 'SL', 'SO', 'OP', 'FP', 'FS', 'ST', 'RL']));
  });

  it('wires the «… από κάναβο» one-shots as action buttons, not tools (foundation/column/wall)', () => {
    for (const key of ['foundation.actions.fromGrid', 'foundation.actions.tieBeamsFromGrid', 'column.actions.fromGrid', 'wall.actions.fromGrid', 'beam.actions.fromGrid']) {
      const fromGrid = allCommands().find((c) => c.commandKey === key);
      expect(fromGrid?.action).toBe(key);
    }
  });
});
