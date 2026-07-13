/**
 * ADR-363 / ADR-510 Φ4j — every contextual ribbon tab opens with the SAME leading
 * «Κλείσιμο» button (Revit «Modify | …» far-left) that returns to the Home tab.
 *
 * Coverage targets the pure `withStandardClose` normaliser (strip legacy close +
 * prepend the SSoT close, idempotent) — the exact transform the registry applies to
 * every contextual tab via `RIBBON_CONTEXTUAL_TABS.map(withStandardClose)`. The
 * registry itself is not imported here: its module graph eagerly pulls the stair
 * bridge → firestore/firebase-auth, which needs a browser `fetch` jsdom lacks.
 */

import type { RibbonButton, RibbonTab } from '../../types/ribbon-types';
import {
  buildClosePanel,
  withStandardClose,
  CONTEXTUAL_CLOSE_ACTION,
} from '../contextual-close-panel';
import { isContextualTabCloseAction } from '../../hooks/bridge/contextual-tab-close';

const allButtons = (tab: RibbonTab): RibbonButton[] =>
  tab.panels.flatMap((panel) => panel.rows.flatMap((row) => row.buttons));

const isClose = (button: RibbonButton): boolean =>
  isContextualTabCloseAction(button.command.action ?? button.command.commandKey ?? '');

describe('ADR-510 Φ4j — SSoT contextual «Κλείσιμο» panel', () => {
  it('the generic close action is caught by the ADR-363 close route', () => {
    expect(isContextualTabCloseAction(CONTEXTUAL_CLOSE_ACTION)).toBe(true);
  });

  it('buildClosePanel produces one LARGE «Κλείσιμο» button that closes the tab', () => {
    const panel = buildClosePanel('demo');
    expect(panel.id).toBe('demo-close');
    expect(panel.labelKey).toBe('ribbon.panels.close');
    const buttons = panel.rows.flatMap((row) => row.buttons);
    expect(buttons).toHaveLength(1);
    const [close] = buttons;
    expect(close?.type).toBe('simple');
    expect(close?.size).toBe('large');
    expect(close?.command.id).toBe('demo.close');
    expect(close?.command.labelKey).toBe('ribbon.commands.close');
    expect(close?.command.icon).toBe('select');
    expect(isClose(close as RibbonButton)).toBe(true);
  });

  describe('withStandardClose', () => {
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

    it('prepends the leading close panel', () => {
      const out = withStandardClose(tab);
      expect(out.panels[0]?.id).toBe('sample-close');
    });

    it('strips legacy per-tab close buttons (both .actions.close and .action.close)', () => {
      const out = withStandardClose(tab);
      const legacyCloses = allButtons(out).filter(
        (b) => b.command.id === 'x.close' || b.command.id === 'x.close2',
      );
      expect(legacyCloses).toHaveLength(0);
    });

    it('leaves exactly ONE close button (the leading SSoT one)', () => {
      const out = withStandardClose(tab);
      expect(allButtons(out).filter(isClose)).toHaveLength(1);
    });

    it('keeps sibling non-close buttons and drops panels emptied by the strip', () => {
      const out = withStandardClose(tab);
      expect(allButtons(out).some((b) => b.command.id === 'x.merge')).toBe(true);
      expect(out.panels.some((p) => p.id === 'close-only')).toBe(false);
    });

    it('is idempotent', () => {
      const once = withStandardClose(tab);
      const twice = withStandardClose(once);
      expect(twice.panels.filter((p) => p.id === 'sample-close')).toHaveLength(1);
      expect(allButtons(twice).filter(isClose)).toHaveLength(1);
    });
  });
});
