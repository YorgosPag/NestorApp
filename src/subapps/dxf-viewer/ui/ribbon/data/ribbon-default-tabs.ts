/**
 * ADR-345 §3 + §11 Fase 1 — Default ribbon tab structure.
 * Tabs are scaffolded with placeholder panels (no buttons).
 * Real tools land in Fasi 2-7.
 */

import type { RibbonTab } from '../types/ribbon-types';
import { HOME_DRAW_PANEL } from './home-tab-draw';
import { HOME_MODIFY_PANEL } from './home-tab-modify';
import { VIEW_NAVIGATE_PANEL } from './view-tab-navigate';
import { VIEW_VISUAL_STYLES_PANEL } from './view-tab-visual-styles';
import { VIEW_VIEWPORTS_PANEL } from './view-tab-viewports';

export const DEFAULT_RIBBON_TAB_ORDER: readonly string[] = [
  'home',
  'layers',
  'view',
  'annotate',
  'settings',
] as const;

export const DEFAULT_RIBBON_TABS: readonly RibbonTab[] = [
  {
    id: 'home',
    labelKey: 'ribbon.tabs.home',
    panels: [
      HOME_DRAW_PANEL,
      HOME_MODIFY_PANEL,
      { id: 'annotation', labelKey: 'ribbon.panels.annotation', rows: [] },
    ],
  },
  {
    id: 'layers',
    labelKey: 'ribbon.tabs.layers',
    // Fase 2 — Layers tab uses expanded workspace mode (LevelPanel),
    // no horizontal panels. Body content comes from layersTabContent prop.
    panels: [],
  },
  {
    id: 'view',
    labelKey: 'ribbon.tabs.view',
    panels: [
      VIEW_NAVIGATE_PANEL,
      VIEW_VISUAL_STYLES_PANEL,
      VIEW_VIEWPORTS_PANEL,
    ],
  },
  {
    id: 'annotate',
    labelKey: 'ribbon.tabs.annotate',
    panels: [
      { id: 'text', labelKey: 'ribbon.panels.text', rows: [] },
    ],
  },
  {
    id: 'settings',
    labelKey: 'ribbon.tabs.settings',
    panels: [
      { id: 'general', labelKey: 'ribbon.panels.general', rows: [] },
    ],
  },
] as const;

export function findRibbonTabById(
  tabs: readonly RibbonTab[],
  id: string,
): RibbonTab | undefined {
  return tabs.find((tab) => tab.id === id);
}

export function reorderTabs(
  tabs: readonly RibbonTab[],
  order: readonly string[],
): RibbonTab[] {
  const known = new Map(tabs.map((tab) => [tab.id, tab]));
  const ordered: RibbonTab[] = [];
  for (const id of order) {
    const tab = known.get(id);
    if (tab) {
      ordered.push(tab);
      known.delete(id);
    }
  }
  for (const tab of known.values()) ordered.push(tab);
  return ordered;
}
