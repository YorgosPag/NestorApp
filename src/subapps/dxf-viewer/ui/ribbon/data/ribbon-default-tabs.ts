/**
 * ADR-345 §3 + §11 Fase 1 — Default ribbon tab structure.
 * Tabs are scaffolded with placeholder panels (no buttons).
 * Real tools land in Fasi 2-7.
 */

import type { RibbonTab } from '../types/ribbon-types';
import { HOME_DRAW_PANEL } from './home-tab-draw';
import { HOME_MODIFY_PANEL, HOME_MODIFY_EDIT_PANEL } from './home-tab-modify';
import { HOME_MATCH_PANEL } from './home-tab-match';
import { VIEW_NAVIGATE_PANEL } from './view-tab-navigate';
import { VIEW_DISPLAY_PANEL } from './view-tab-display';
import { VIEW_VISUAL_STYLES_PANEL } from './view-tab-visual-styles';
import { VIEW_VIEWPORTS_PANEL } from './view-tab-viewports';
import { VIEW_WINDOW_PANEL } from './view-tab-window';
import { VIEW_DRAWING_SCALE_PANEL } from './view-tab-drawing-scale';
import { BIM_GRAPHICS_PANEL, BIM_STYLES_PANEL } from './view-tab-bim-settings';
import { VIEW_LAYER_MANAGER_PANEL } from './view-tab-layer-manager';
import { ANNOTATE_MEASURE_PANEL } from './home-tab-measure';
import { HOME_DIMENSIONS_PANEL } from './home-tab-dimensions';
import { HOME_GUIDES_PANEL } from './home-tab-guides';
import { HOME_AI_PANEL } from './home-tab-ai';
import { SETTINGS_CURSOR_PANEL } from './settings-tab-cursor';
import { SETTINGS_DEVELOPER_PANEL } from './settings-tab-developer';
import { SETTINGS_CREDITS_PANEL } from './settings-tab-credits';
import { INSERT_TAB } from './insert-tab';
import { ANALYZE_TAB } from './analyze-tab';
import { STRUCTURAL_TAB } from './structural-tab';
import { ARCHITECTURE_TAB } from './architecture-tab';
import { MEP_DISCIPLINE_TABS } from './systems-discipline-tabs';

export const DEFAULT_RIBBON_TAB_ORDER: readonly string[] = [
  'home',
  'structural',
  'architecture',
  // ADR-444 — six MEP discipline tabs (one per Greek Η/Μ μελέτη).
  'electrical',
  'water',
  'drainage',
  'heating',
  'hvac',
  'fire-gas',
  'insert',
  'analyze',
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
      HOME_MODIFY_EDIT_PANEL,
      HOME_MATCH_PANEL,
      HOME_GUIDES_PANEL,
      ANNOTATE_MEASURE_PANEL,
      HOME_DIMENSIONS_PANEL,
      HOME_AI_PANEL,
    ],
  },
  // ADR-443/444 — permanent discipline tabs replacing the legacy nested
  // `draw.bim.group` / `draw.arch.group` / `draw.mep.group` cascading dropdowns in
  // Home → Draw with large flat buttons. «Δομικά» (Structure) + «Αρχιτεκτονικά»
  // (Architecture) + SIX MEP discipline tabs (electrical/water/drainage/heating/
  // hvac/fire-gas — one per Greek Η/Μ μελέτη). Clash moved to «Ανάλυση».
  STRUCTURAL_TAB,
  ARCHITECTURE_TAB,
  ...MEP_DISCIPLINE_TABS,
  INSERT_TAB,
  ANALYZE_TAB,
  {
    id: 'view',
    labelKey: 'ribbon.tabs.view',
    panels: [
      VIEW_NAVIGATE_PANEL,
      VIEW_DISPLAY_PANEL,
      VIEW_LAYER_MANAGER_PANEL,
      VIEW_VISUAL_STYLES_PANEL,
      VIEW_VIEWPORTS_PANEL,
      VIEW_WINDOW_PANEL,
      VIEW_DRAWING_SCALE_PANEL,
      BIM_GRAPHICS_PANEL,
      BIM_STYLES_PANEL,
    ],
  },
  {
    id: 'annotate',
    labelKey: 'ribbon.tabs.annotate',
    panels: [
      // ADR-362 Phase E3 — dimension CREATION is a CONTEXTUAL «Διαστάσεις» tab
      // (CONTEXTUAL_DIMENSIONS_TAB, `dim-tool-active`), mirroring guides — it
      // auto-opens when a dim tool is picked. So the Annotate tab keeps only its
      // future text/leader/tag placeholder here.
      { id: 'text', labelKey: 'ribbon.panels.text', rows: [] },
    ],
  },
  {
    id: 'settings',
    labelKey: 'ribbon.tabs.settings',
    panels: [
      SETTINGS_CURSOR_PANEL,
      SETTINGS_DEVELOPER_PANEL,
      SETTINGS_CREDITS_PANEL,
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
