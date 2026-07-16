/**
 * ADR-662 Φάση 1 + 1b — structural guards για το μόνιμο «Τοπογραφικό» ribbon tab.
 *
 * Robust invariants (ΟΧΙ hardcoded key list που παλιώνει): κάθε button είναι είτε
 * LARGE simple (authoring action `topo.*` με `action === commandKey`, ή ζωντανό tool),
 * είτε (Φάση 1b) SMALL `widget` με έγκυρο `widgetId` (live toggle / numeric field), και
 * το tab είναι εγγεγραμμένο στα defaults + order.
 */

import { TOPOGRAPHY_TAB } from '../topography-tab';
import { DEFAULT_RIBBON_TABS, DEFAULT_RIBBON_TAB_ORDER } from '../ribbon-default-tabs';
import type { RibbonButton } from '../../types/ribbon-types';

/** Live ToolStateStore tools reused by the tab (toolBtn → onToolChange, no action). */
const TOOL_KEYS = new Set(['topo-breakline', 'topo-boundary']);

/** widgetIds wired in RibbonPanel.renderButton (6 toggles + 1 manage button + 3 numeric).
 *  ADR-662 Φάση 1b (toggles/fields) + Φ4 (`topo-cloud-manage` — store-subscribed disabled-
 *  capable button που ανοίγει τον cloud manager dialog). */
const WIDGET_IDS = new Set([
  'topo-grid-visible', 'topo-north-visible', 'topo-cloud-visible', 'topo-cloud-manage',
  'topo-contour-style', 'topo-north-mode', 'topo-cutfill-mode',
  'topo-contour-interval', 'topo-contour-index', 'topo-grid-step',
]);

function allButtons(): RibbonButton[] {
  return TOPOGRAPHY_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}

const isWidget = (b: RibbonButton): boolean => b.type === 'widget';

describe('TOPOGRAPHY_TAB (ADR-662 Φάση 1 + 1b)', () => {
  it('έχει το σωστό id + labelKey', () => {
    expect(TOPOGRAPHY_TAB.id).toBe('topography');
    expect(TOPOGRAPHY_TAB.labelKey).toBe('ribbon.tabs.topography');
  });

  it('έχει τα 6 panels της μετάβασης, με μοναδικά ids', () => {
    const ids = TOPOGRAPHY_TAB.panels.map((p) => p.id);
    expect(ids).toEqual([
      'topo-data', 'topo-surface', 'topo-georef',
      'topo-presentation', 'topo-analysis', 'topo-deliverables',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('κάθε button είναι LARGE simple (authoring) Ή SMALL widget (Φάση 1b)', () => {
    for (const b of allButtons()) {
      if (isWidget(b)) {
        expect(b.size).toBe('small');
      } else {
        expect(b.type).toBe('simple');
        expect(b.size).toBe('large');
      }
    }
    for (const p of TOPOGRAPHY_TAB.panels)
      for (const r of p.rows) expect(r.isInFlyout).toBe(false);
  });

  it('τα action buttons είναι `topo.*` με action === commandKey· τα tools είναι ζωντανά keys', () => {
    for (const b of allButtons()) {
      if (isWidget(b)) continue;
      const { commandKey, action } = b.command;
      if (action !== undefined) {
        expect(action).toBe(commandKey);
        expect(action.startsWith('topo.')).toBe(true);
      } else {
        expect(TOOL_KEYS.has(commandKey)).toBe(true);
      }
    }
  });

  it('τα widget buttons (Φάση 1b) έχουν έγκυρο widgetId, χωρίς action', () => {
    const widgets = allButtons().filter(isWidget);
    // 6 toggles + 1 manage button (topo-cloud-manage) + 3 numeric fields.
    expect(widgets).toHaveLength(10);
    for (const b of widgets) {
      expect(b.widgetId).toBeDefined();
      expect(WIDGET_IDS.has(b.widgetId as string)).toBe(true);
      expect(b.command.action).toBeUndefined();
    }
    // Κάθε καταχωρημένο widgetId χρησιμοποιείται ακριβώς μία φορά.
    const used = widgets.map((b) => b.widgetId);
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(WIDGET_IDS);
  });

  it('όλα τα command ids είναι μοναδικά', () => {
    const ids = allButtons().map((b) => b.command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('είναι εγγεγραμμένο στα defaults + order (μετά τα ΗΛΜ, πριν το insert)', () => {
    expect(DEFAULT_RIBBON_TABS).toContain(TOPOGRAPHY_TAB);
    expect(DEFAULT_RIBBON_TAB_ORDER).toContain('topography');
    const topoIdx = DEFAULT_RIBBON_TAB_ORDER.indexOf('topography');
    expect(topoIdx).toBeGreaterThan(DEFAULT_RIBBON_TAB_ORDER.indexOf('fire-gas'));
    expect(topoIdx).toBeLessThan(DEFAULT_RIBBON_TAB_ORDER.indexOf('insert'));
  });
});
