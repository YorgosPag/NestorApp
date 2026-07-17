/**
 * ADR-581 — SSoT ορισμός του κουμπιού σύριγγας. Τα tests φυλάνε τη ΣΗΜΑΣΙΟΛΟΓΙΑ που
 * κρέμεται από την απουσία του `action` (persistent tool vs immediate action) και τη
 * μη-ισοδυναμία με το legacy `match-properties.open` (dialog).
 */

import { HOME_MATCH_PANEL } from '../home-tab-match';
import {
  MATCH_PROPERTIES_TOOL_KEY,
  buildMatchSyringeCommand,
  isMatchSyringeCommand,
} from '../match-syringe-command';

describe('ADR-581 — match syringe command SSoT', () => {
  describe('buildMatchSyringeCommand', () => {
    const command = buildMatchSyringeCommand('demo.match');

    it('carries the caller-supplied id (button ids are global)', () => {
      expect(command.id).toBe('demo.match');
    });

    it('has NO `action` → RibbonLargeButton falls through to onToolChange (persistent tool)', () => {
      expect(command.action).toBeUndefined();
      expect(command.commandKey).toBe(MATCH_PROPERTIES_TOOL_KEY);
    });

    it('uses the reactive syringe icon + the existing i18n keys (no new keys — N.11)', () => {
      expect(command.icon).toBe('match-syringe');
      expect(command.labelKey).toBe('ribbon.commands.matchSyringe');
      expect(command.tooltipKey).toBe('ribbon.commands.matchSyringeTooltip');
      expect(command.shortcut).toBe('MA');
    });
  });

  describe('isMatchSyringeCommand', () => {
    it('matches the SSoT syringe', () => {
      expect(isMatchSyringeCommand(buildMatchSyringeCommand('x.match'))).toBe(true);
    });

    it('does NOT match the legacy match-properties.open dialog button', () => {
      expect(isMatchSyringeCommand({
        commandKey: 'match-properties.open',
        action: 'match-properties.open',
      })).toBe(false);
    });

    it('does NOT match a same-key button that was given an `action` (≠ persistent tool)', () => {
      expect(isMatchSyringeCommand({
        commandKey: MATCH_PROPERTIES_TOOL_KEY,
        action: 'something.else',
      })).toBe(false);
    });

    it('does NOT match an unrelated tool', () => {
      expect(isMatchSyringeCommand({ commandKey: 'move' })).toBe(false);
    });
  });

  it('the Home tab panel consumes the SSoT builder (one definition, two call sites)', () => {
    const buttons = HOME_MATCH_PANEL.rows.flatMap((row) => row.buttons);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.command).toEqual(buildMatchSyringeCommand('match.syringe'));
    expect(isMatchSyringeCommand(buttons[0]!.command)).toBe(true);
  });
});
