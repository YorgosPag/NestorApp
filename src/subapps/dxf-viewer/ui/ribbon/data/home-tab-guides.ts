import type { RibbonPanelDef } from '../types/ribbon-types';

/**
 * ADR-442 — Home → Guides ENTRY launcher (Revit-grade).
 *
 * The full guide toolset now lives in the `guides-editor` CONTEXTUAL tab
 * (`contextual-guides-tab.ts`), which auto-opens the moment any guide tool is
 * active (`activeTool` starts with `guide-`). This panel is reduced to a SINGLE
 * compact split-button — the persistent ENTRY point, mirroring Revit's
 * "Architecture → Grid": you always have one door into the guides context, and
 * the rich editing surface is the contextual tab.
 *
 * Behaviour:
 *   • main click → `guide-x` (the default guide tool) → contextual tab opens
 *   • dropdown   → the 5 most-common starters + "open guide panel"
 *
 * The legacy 33-variant mega-dropdown is INTENTIONALLY gone (that crowded,
 * unscannable dropdown was the whole reason for ADR-442). Every guide tool is
 * reachable as a LARGE button in the contextual tab once you're in context.
 *
 * SSoT: reuses the exact commandKeys / actions / icons / i18n labels already
 * wired here and in `contextual-guides-tab.ts`. Zero new keys.
 */
export const HOME_GUIDES_PANEL: RibbonPanelDef = {
  id: 'guides',
  labelKey: 'ribbon.panels.guides',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.guides',
            labelKey: 'ribbon.commands.guides',
            icon: 'guide-x',
            commandKey: 'guide-x',
            shortcut: 'G',
          },
          variants: [
            { id: 'guide.x', labelKey: 'tools.guideX', icon: 'guide-x', commandKey: 'guide-x' },
            { id: 'guide.z', labelKey: 'tools.guideZ', icon: 'guide-z', commandKey: 'guide-z' },
            { id: 'guide.parallel', labelKey: 'tools.guideParallel', icon: 'guide-parallel', commandKey: 'guide-parallel' },
            { id: 'guide.perpendicular', labelKey: 'tools.guidePerpendicular', icon: 'guide-perpendicular', commandKey: 'guide-perpendicular' },
            { id: 'guide.xz', labelKey: 'tools.guideXZ', icon: 'guide-xz', commandKey: 'guide-xz' },
            {
              id: 'guides.openPanel',
              labelKey: 'ribbon.commands.openGuidePanel',
              icon: 'guide-panel',
              commandKey: 'guide-panel',
              action: 'toggle-guide-panel',
              shortcut: 'G→L',
            },
          ],
        },
      ],
    },
  ],
};
