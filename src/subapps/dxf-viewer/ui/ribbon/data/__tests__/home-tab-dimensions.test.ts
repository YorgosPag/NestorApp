/**
 * ADR-362 Phase E3 / Φ-Ε4 (2026-07-04) — Tests for the Home → Dimensions launcher.
 *
 * Per Giorgio (2026-07-04): Home keeps EXACTLY ONE «Διάσταση» button. The whole
 * type gallery + auto-dimension + cut-line moved to the contextual «Διαστάσεις»
 * tab (`contextual-dimensions-tab.ts`).
 *
 * Coverage:
 *   - EXACTLY one large SIMPLE button, commandKey `dim-smart`, shortcut DIM
 *   - No split / dropdown / variants left on Home
 *   - The button drives a key that exists in the full creation set (SSoT)
 *   - i18n label in the `ribbon.commands.dim*` namespace; non-empty icon
 */

import { HOME_DIMENSIONS_PANEL } from '../home-tab-dimensions';
import { CONTEXTUAL_DIMENSIONS_TAB } from '../contextual-dimensions-tab';

// SSoT cross-check: the Home button must drive a key that also exists in the
// full contextual «Διαστάσεις» creation tab.
const FULL_SET_KEYS = new Set(
  CONTEXTUAL_DIMENSIONS_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons.map((b) => b.command.commandKey))),
);

describe('ADR-362 Φ-Ε4 — HOME_DIMENSIONS_PANEL single «Διάσταση» button', () => {
  it('is EXACTLY one large simple button anchored on Smart DIM', () => {
    expect(HOME_DIMENSIONS_PANEL.id).toBe('dimensions');
    expect(HOME_DIMENSIONS_PANEL.labelKey).toBe('ribbon.panels.dimensions');
    expect(HOME_DIMENSIONS_PANEL.rows).toHaveLength(1);
    expect(HOME_DIMENSIONS_PANEL.rows[0].buttons).toHaveLength(1);
    const btn = HOME_DIMENSIONS_PANEL.rows[0].buttons[0];
    expect(btn.type).toBe('simple');
    expect(btn.size).toBe('large');
    expect(btn.variants).toBeUndefined();
    expect(btn.command.commandKey).toBe('dim-smart');
    expect(btn.command.shortcut).toBe('DIM');
  });

  it('drives a key that exists in the full creation set + valid i18n/icon (SSoT)', () => {
    const cmd = HOME_DIMENSIONS_PANEL.rows[0].buttons[0].command;
    expect(FULL_SET_KEYS.has(cmd.commandKey)).toBe(true);
    expect(cmd.labelKey).toMatch(/^ribbon\.commands\.dim/);
    expect(typeof cmd.icon).toBe('string');
    expect(cmd.icon).not.toBe('');
  });
});
