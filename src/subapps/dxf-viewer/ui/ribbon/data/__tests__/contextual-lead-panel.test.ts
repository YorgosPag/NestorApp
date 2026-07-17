/**
 * ADR-510 Φ4j / ADR-581 — κάθε contextual ribbon tab ανοίγει με το ΙΔΙΟ leading panel:
 * «Κλείσιμο» (Revit «Modify | …» far-left, γυρνά στο Home) + η σύριγγα «Αντιγραφή
 * Ιδιοτήτων» κολλητά δεξιά του (Giorgio 2026-07-17).
 *
 * Coverage targets the pure `withStandardLeadPanel` normaliser (strip lead-panel buttons
 * + prepend the SSoT panel, idempotent) — the exact transform the registry applies to
 * every contextual tab via `RIBBON_CONTEXTUAL_TABS.map(withStandardLeadPanel)`. The
 * registry itself is not imported here: its module graph eagerly pulls the stair
 * bridge → firestore/firebase-auth, which needs a browser `fetch` jsdom lacks.
 */

import type { RibbonButton, RibbonTab } from '../../types/ribbon-types';
import {
  buildContextualLeadPanel,
  withStandardLeadPanel,
  CONTEXTUAL_CLOSE_ACTION,
} from '../contextual-lead-panel';
import { isContextualTabCloseAction } from '../../hooks/bridge/contextual-tab-close';
import { isMatchSyringeCommand } from '../match-syringe-command';

const allButtons = (tab: RibbonTab): RibbonButton[] =>
  tab.panels.flatMap((panel) => panel.rows.flatMap((row) => row.buttons));

const isClose = (button: RibbonButton): boolean =>
  isContextualTabCloseAction(button.command.action ?? button.command.commandKey ?? '');

const isSyringe = (button: RibbonButton): boolean => isMatchSyringeCommand(button.command);

describe('ADR-510 Φ4j / ADR-581 — SSoT contextual leading panel', () => {
  it('the generic close action is caught by the ADR-363 close route', () => {
    expect(isContextualTabCloseAction(CONTEXTUAL_CLOSE_ACTION)).toBe(true);
  });

  describe('buildContextualLeadPanel', () => {
    const panel = buildContextualLeadPanel('demo');
    const buttons = panel.rows.flatMap((row) => row.buttons);

    it('is one row of exactly two LARGE buttons — close FIRST, syringe to its RIGHT', () => {
      expect(panel.id).toBe('demo-lead');
      expect(panel.rows).toHaveLength(1);
      expect(buttons).toHaveLength(2);
      expect(buttons.map((b) => b.size)).toEqual(['large', 'large']);
      expect(buttons.map((b) => b.command.id)).toEqual(['demo.close', 'demo.match']);
    });

    it('the close button closes the tab', () => {
      const [close] = buttons;
      expect(close?.type).toBe('simple');
      expect(close?.command.labelKey).toBe('ribbon.commands.close');
      expect(close?.command.icon).toBe('select');
      expect(isClose(close as RibbonButton)).toBe(true);
    });

    it('the syringe activates the PERSISTENT tool — no `action` (see match-syringe-command)', () => {
      const syringe = buttons[1];
      expect(syringe?.type).toBe('simple');
      expect(syringe?.command.icon).toBe('match-syringe');
      expect(syringe?.command.commandKey).toBe('match-properties');
      expect(syringe?.command.action).toBeUndefined();
      expect(isSyringe(syringe as RibbonButton)).toBe(true);
    });
  });

  describe('withStandardLeadPanel', () => {
    const tab: RibbonTab = {
      id: 'sample',
      labelKey: 'x',
      isContextual: true,
      panels: [
        {
          id: 'actions',
          labelKey: 'a',
          rows: [
            {
              isInFlyout: false,
              buttons: [
                { type: 'simple', size: 'small', command: { id: 'x.merge', labelKey: 'm', icon: 'merge', commandKey: 'x.merge' } },
                { type: 'simple', size: 'small', command: { id: 'x.close', labelKey: 'c', icon: 'select', commandKey: 'x.actions.close', action: 'x.actions.close' } },
              ],
            },
          ],
        },
        {
          id: 'close-only',
          labelKey: 'b',
          rows: [
            {
              isInFlyout: false,
              buttons: [
                { type: 'simple', size: 'small', command: { id: 'x.close2', labelKey: 'c', icon: 'select', commandKey: 'x.action.close', action: 'x.action.close' } },
              ],
            },
          ],
        },
      ],
    };

    it('prepends the leading panel', () => {
      const out = withStandardLeadPanel(tab);
      expect(out.panels[0]?.id).toBe('sample-lead');
    });

    it('strips legacy per-tab close buttons (both .actions.close and .action.close)', () => {
      const out = withStandardLeadPanel(tab);
      const legacyCloses = allButtons(out).filter(
        (b) => b.command.id === 'x.close' || b.command.id === 'x.close2',
      );
      expect(legacyCloses).toHaveLength(0);
    });

    it('leaves exactly ONE close and ONE syringe (the leading SSoT ones)', () => {
      const out = withStandardLeadPanel(tab);
      expect(allButtons(out).filter(isClose)).toHaveLength(1);
      expect(allButtons(out).filter(isSyringe)).toHaveLength(1);
    });

    it('keeps sibling non-lead buttons and drops panels emptied by the strip', () => {
      const out = withStandardLeadPanel(tab);
      expect(allButtons(out).some((b) => b.command.id === 'x.merge')).toBe(true);
      expect(out.panels.some((p) => p.id === 'close-only')).toBe(false);
    });

    it('is idempotent', () => {
      const once = withStandardLeadPanel(tab);
      const twice = withStandardLeadPanel(once);
      expect(twice.panels.filter((p) => p.id === 'sample-lead')).toHaveLength(1);
      expect(allButtons(twice).filter(isClose)).toHaveLength(1);
      expect(allButtons(twice).filter(isSyringe)).toHaveLength(1);
    });

    it('strips a stray per-tab syringe declared by a tab itself', () => {
      const withOwnSyringe: RibbonTab = {
        ...tab,
        panels: [
          {
            id: 'own-match',
            labelKey: 'm',
            rows: [
              {
                isInFlyout: false,
                buttons: [
                  { type: 'simple', size: 'large', command: { id: 'x.syringe', labelKey: 's', icon: 'match-syringe', commandKey: 'match-properties' } },
                ],
              },
            ],
          },
        ],
      };
      const out = withStandardLeadPanel(withOwnSyringe);
      expect(allButtons(out).filter(isSyringe)).toHaveLength(1);
      expect(allButtons(out).some((b) => b.command.id === 'x.syringe')).toBe(false);
    });

    // Giorgio 2026-07-17 — πινέλο vs dialog = ΔΥΟ λειτουργίες. Το legacy
    // `match-properties.open` του multi-selection tab ΕΧΕΙ `action` → ΔΕΝ είναι η
    // σύριγγα → ΔΕΝ στριπάρεται. Αν αυτό το test κοκκινίσει, το dialog ADR-581
    // (checklist/AI) μόλις εξαφανίστηκε από το UI — δεν το ανοίγει τίποτα άλλο.
    it('keeps the legacy match-properties.open dialog button (it has an `action`)', () => {
      const withDialogButton: RibbonTab = {
        ...tab,
        panels: [
          {
            id: 'multi-selection-match',
            labelKey: 'm',
            rows: [
              {
                isInFlyout: false,
                buttons: [
                  { type: 'simple', size: 'large', command: { id: 'match-properties.open', labelKey: 'mp', icon: 'copy', commandKey: 'match-properties.open', action: 'match-properties.open' } },
                ],
              },
            ],
          },
        ],
      };
      const out = withStandardLeadPanel(withDialogButton);
      expect(allButtons(out).some((b) => b.command.id === 'match-properties.open')).toBe(true);
      expect(allButtons(out).filter(isSyringe)).toHaveLength(1);
    });
  });
});
