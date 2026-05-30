/**
 * ADR-362 Phase E1 — Tests for the Home tab DIMENSIONS panel definition.
 *
 * Pure structural assertions on the static `RibbonPanelDef`. No React.
 *
 * Coverage:
 *   - Panel id + labelKey + row layout (1 large split + 2 small chained)
 *   - Smart DIM primary + 10 dropdown variants (smart + 9 manual)
 *   - All commandKeys match ToolType literals from ADR-362 Phase D1/D2/D3
 *   - i18n keys use the `ribbon.commands.dim*` / `ribbon.panels.dimensions`
 *     namespace (no hardcoded labels — SOS N.11)
 *   - No `comingSoon` flag set anywhere (Group D closed, all 10 wired)
 *   - Icons resolved (no undefined / no empty string)
 *   - Shortcut uniqueness within the panel
 */

import { HOME_DIMENSIONS_PANEL } from '../home-tab-dimensions';

const EXPECTED_VARIANT_COMMAND_KEYS = [
  'dim-smart',
  'dim-linear',
  'dim-aligned',
  'dim-angular2L',
  'dim-angular3P',
  'dim-radius',
  'dim-diameter',
  'dim-arc-length',
  'dim-jogged-radius',
  'dim-ordinate',
] as const;

describe('ADR-362 Phase E1 — HOME_DIMENSIONS_PANEL', () => {
  it('declares the dimensions panel with the canonical id + label key', () => {
    expect(HOME_DIMENSIONS_PANEL.id).toBe('dimensions');
    expect(HOME_DIMENSIONS_PANEL.labelKey).toBe('ribbon.panels.dimensions');
    expect(HOME_DIMENSIONS_PANEL.rows).toHaveLength(3);
    expect(HOME_DIMENSIONS_PANEL.rows[0].buttons).toHaveLength(1);
    expect(HOME_DIMENSIONS_PANEL.rows[1].buttons).toHaveLength(2);
    expect(HOME_DIMENSIONS_PANEL.rows[2].buttons).toHaveLength(1);
  });

  it('exposes Center Mark + Center Line as a small split button (ADR-362 Phase M)', () => {
    const center = HOME_DIMENSIONS_PANEL.rows[2].buttons[0];
    expect(center.type).toBe('split');
    expect(center.size).toBe('small');
    expect(center.command.commandKey).toBe('dim-center-mark');
    expect((center.variants ?? []).map((v) => v.commandKey)).toEqual([
      'dim-center-mark',
      'dim-centerline',
    ]);
  });

  it('exposes Smart DIM as a large split button with shortcut DIM', () => {
    const primary = HOME_DIMENSIONS_PANEL.rows[0].buttons[0];
    expect(primary.type).toBe('split');
    expect(primary.size).toBe('large');
    expect(primary.command.commandKey).toBe('dim-smart');
    expect(primary.command.shortcut).toBe('DIM');
    expect(primary.command.icon).toBe('dim-smart');
    expect(primary.command.labelKey).toBe('ribbon.commands.dim');
  });

  it('lists Smart DIM + 9 manual variants in the dropdown (D4 AutoCAD pattern)', () => {
    const variants = HOME_DIMENSIONS_PANEL.rows[0].buttons[0].variants ?? [];
    expect(variants.map((v) => v.commandKey)).toEqual([
      ...EXPECTED_VARIANT_COMMAND_KEYS,
    ]);
  });

  it('exposes Baseline + Continued as standalone small buttons (chained dims need a parent)', () => {
    const chained = HOME_DIMENSIONS_PANEL.rows[1].buttons;
    expect(chained.map((b) => b.command.commandKey)).toEqual([
      'dim-baseline',
      'dim-continued',
    ]);
    expect(chained.every((b) => b.type === 'simple' && b.size === 'small')).toBe(true);
  });

  it('routes every label through the i18n namespace (no hardcoded text — SOS N.11)', () => {
    const allCommands = [
      HOME_DIMENSIONS_PANEL.rows[0].buttons[0].command,
      ...(HOME_DIMENSIONS_PANEL.rows[0].buttons[0].variants ?? []),
      ...HOME_DIMENSIONS_PANEL.rows[1].buttons.map((b) => b.command),
      HOME_DIMENSIONS_PANEL.rows[2].buttons[0].command,
      ...(HOME_DIMENSIONS_PANEL.rows[2].buttons[0].variants ?? []),
    ];
    for (const command of allCommands) {
      expect(command.labelKey).toMatch(/^ribbon\.(commands|panels)\./);
      expect(command.comingSoon).toBeFalsy();
    }
  });

  it('attaches a non-empty icon token to every command (visible in the ribbon)', () => {
    const allCommands = [
      HOME_DIMENSIONS_PANEL.rows[0].buttons[0].command,
      ...(HOME_DIMENSIONS_PANEL.rows[0].buttons[0].variants ?? []),
      ...HOME_DIMENSIONS_PANEL.rows[1].buttons.map((b) => b.command),
      HOME_DIMENSIONS_PANEL.rows[2].buttons[0].command,
      ...(HOME_DIMENSIONS_PANEL.rows[2].buttons[0].variants ?? []),
    ];
    for (const command of allCommands) {
      expect(typeof command.icon).toBe('string');
      expect(command.icon).not.toBe('');
    }
  });

  it('keeps shortcuts unique within the panel', () => {
    const shortcuts: string[] = [];
    const collect = (s?: string) => {
      if (s) shortcuts.push(s);
    };
    collect(HOME_DIMENSIONS_PANEL.rows[0].buttons[0].command.shortcut);
    for (const variant of HOME_DIMENSIONS_PANEL.rows[0].buttons[0].variants ?? []) {
      collect(variant.shortcut);
    }
    for (const button of HOME_DIMENSIONS_PANEL.rows[1].buttons) {
      collect(button.command.shortcut);
    }
    for (const button of HOME_DIMENSIONS_PANEL.rows[2].buttons) {
      collect(button.command.shortcut);
      for (const variant of button.variants ?? []) {
        collect(variant.shortcut);
      }
    }
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});
