/**
 * ADR-442 — Contextual ribbon tab for the Guides & Grid system (Revit-grade).
 *
 * Trigger: `guide-tool-active` — dispatched by `useActiveContextualTrigger`
 * (app/ribbon-contextual-config.ts) whenever `activeTool` starts with `guide-`.
 * Guides have NO persistent selection (selection lives only while a guide tool
 * is active — `useGuideWorkflowState`), so "tool active" covers both the
 * tool-active AND the guide-selected case with a single, state-free trigger.
 *
 * Why a contextual tab: the legacy Home → Guides panel packed 33 guide tools
 * into ONE split-button dropdown (tiny icons, hard to scan). This tab surfaces
 * the same tools as LARGE, grouped buttons the moment a guide tool is active —
 * the AutoCAD/Revit contextual-ribbon pattern. The Home → Guides split-button
 * stays as the persistent ENTRY point (you need a way to start a guide tool
 * before this tab can appear).
 *
 * LAYOUT (Giorgio 2026-06-12): EVERY command is a LARGE icon-button. NOTHING is
 * hidden behind a flyout/dropdown — all rows are `isInFlyout: false`, all buttons
 * `size: 'large'`. The ribbon body scrolls horizontally (`overflow-x: auto`) when
 * the full set exceeds the viewport. This is the explicit product decision: max
 * scannability over compactness.
 *
 * SSoT: every button reuses the EXISTING command keys / actions / icons / i18n
 * labels already wired by `home-tab-guides.ts` (guide tools) and
 * `view-tab-display.ts` (`grid` action). Zero new command labels, zero new
 * dispatch paths — behaviour is identical to the legacy buttons. Only the 6
 * tab/panel container labels are new (ribbon.tabs.guides + ribbon.panels.guides*).
 *
 * Panels (Revit "Modify | Grids" grouping):
 *   Σχεδίαση Οδηγών   → axis / relative / point guides
 *   Τόξα & Σημεία     → arc guides + from-geometry derivations
 *   Επεξεργασία       → move / rotate / mirror / scale / delete …
 *   Κάναβοι & Διατάξεις → grid / preset-grid / polar-array + the canvas grid toggle
 *   Εμφάνιση & Ανάλυση → guide panel / visibility / analysis
 *
 * @see docs/centralized-systems/reference/adrs/ADR-442-guides-contextual-ribbon-tab.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';

export const GUIDES_CONTEXTUAL_TRIGGER = 'guide-tool-active';

/** Helper: a LARGE tool button (commandKey → onToolChange). */
function toolBtn(id: string, labelKey: string, icon: string, commandKey: string): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey } };
}

/** Helper: a LARGE action button (action → onAction, optional shortcut). */
function actionBtn(
  id: string, labelKey: string, icon: string, commandKey: string, action: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, action, shortcut } };
}

export const CONTEXTUAL_GUIDES_TAB: RibbonTab = {
  id: 'guides-editor',
  labelKey: 'ribbon.tabs.guides',
  isContextual: true,
  contextualTrigger: GUIDES_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Σχεδίαση Οδηγών ──────────────────────────────────────────────────────
    {
      id: 'guides-draw',
      labelKey: 'ribbon.panels.guidesDraw',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('guidesTab.x', 'tools.guideX', 'guide-x', 'guide-x'),
            toolBtn('guidesTab.z', 'tools.guideZ', 'guide-z', 'guide-z'),
            toolBtn('guidesTab.parallel', 'tools.guideParallel', 'guide-parallel', 'guide-parallel'),
            toolBtn('guidesTab.perpendicular', 'tools.guidePerpendicular', 'guide-perpendicular', 'guide-perpendicular'),
            toolBtn('guidesTab.xz', 'tools.guideXZ', 'guide-xz', 'guide-xz'),
            toolBtn('guidesTab.segments', 'tools.guideSegments', 'trim', 'guide-segments'),
            toolBtn('guidesTab.distance', 'tools.guideDistance', 'measure-distance', 'guide-distance'),
            toolBtn('guidesTab.addPoint', 'tools.guideAddPoint', 'guide-x', 'guide-add-point'),
            toolBtn('guidesTab.deletePoint', 'tools.guideDeletePoint', 'guide-z', 'guide-delete-point'),
          ],
        },
      ],
    },
    // ── Τόξα & Σημεία ────────────────────────────────────────────────────────
    {
      id: 'guides-arcs-points',
      labelKey: 'ribbon.panels.guidesArcsPoints',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('guidesTab.fromEntity', 'tools.guideFromEntity', 'guide-x', 'guide-from-entity'),
            toolBtn('guidesTab.offsetEntity', 'tools.guideOffsetEntity', 'offset', 'guide-offset-entity'),
            toolBtn('guidesTab.fromSelection', 'tools.guideFromSelection', 'select', 'guide-from-selection'),
            toolBtn('guidesTab.arcSegments', 'tools.guideArcSegments', 'arc-3p', 'guide-arc-segments'),
            toolBtn('guidesTab.arcDistance', 'tools.guideArcDistance', 'arc-3p', 'guide-arc-distance'),
            toolBtn('guidesTab.arcLineIntersect', 'tools.guideArcLineIntersect', 'guide-perpendicular', 'guide-arc-line-intersect'),
            toolBtn('guidesTab.circleIntersect', 'tools.guideCircleIntersect', 'circle-radius', 'guide-circle-intersect'),
            toolBtn('guidesTab.lineMidpoint', 'tools.guideLineMidpoint', 'guide-x', 'guide-line-midpoint'),
            toolBtn('guidesTab.circleCenter', 'tools.guideCircleCenter', 'circle-radius', 'guide-circle-center'),
            toolBtn('guidesTab.rectCenter', 'tools.guideRectCenter', 'rectangle', 'guide-rect-center'),
          ],
        },
      ],
    },
    // ── Επεξεργασία Οδηγών ───────────────────────────────────────────────────
    {
      id: 'guides-modify',
      labelKey: 'ribbon.panels.guidesModify',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('guidesTab.select', 'tools.guideSelect', 'select', 'guide-select'),
            toolBtn('guidesTab.move', 'tools.guideMove', 'move', 'guide-move'),
            toolBtn('guidesTab.rotate', 'tools.guideRotate', 'rotate', 'guide-rotate'),
            toolBtn('guidesTab.rotateAll', 'tools.guideRotateAll', 'rotate', 'guide-rotate-all'),
            toolBtn('guidesTab.rotateGroup', 'tools.guideRotateGroup', 'rotate', 'guide-rotate-group'),
            toolBtn('guidesTab.mirror', 'tools.guideMirror', 'mirror', 'guide-mirror'),
            toolBtn('guidesTab.scale', 'tools.guideScale', 'scale', 'guide-scale'),
            toolBtn('guidesTab.equalize', 'tools.guideEqualize', 'guide-parallel', 'guide-equalize'),
            toolBtn('guidesTab.angle', 'tools.guideAngle', 'measure-angle', 'guide-angle'),
            toolBtn('guidesTab.copyPattern', 'tools.guideCopyPattern', 'copy', 'guide-copy-pattern'),
            toolBtn('guidesTab.delete', 'tools.guideDelete', 'explode', 'guide-delete'),
          ],
        },
      ],
    },
    // ── Κάναβοι & Διατάξεις ──────────────────────────────────────────────────
    {
      id: 'guides-grid-arrays',
      labelKey: 'ribbon.panels.guidesGridArrays',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('guidesTab.grid', 'tools.guideGrid', 'array-rect', 'guide-grid'),
            toolBtn('guidesTab.presetGrid', 'tools.guidePresetGrid', 'array-rect', 'guide-preset-grid'),
            toolBtn('guidesTab.polarArray', 'tools.guidePolarArray', 'array-polar', 'guide-polar-array'),
            // ADR-442 — the canvas grid toggle is mirrored here (reuses the exact
            // `grid` action/icon from view-tab-display.ts). It also stays in
            // View → Display until Giorgio confirms which home he prefers.
            actionBtn('guidesTab.displayGrid', 'ribbon.commands.displayGrid', 'display-grid', 'grid', 'grid', 'G'),
          ],
        },
      ],
    },
    // ── Εμφάνιση & Ανάλυση ───────────────────────────────────────────────────
    {
      id: 'guides-display',
      labelKey: 'ribbon.panels.guidesDisplay',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('guidesTab.openPanel', 'ribbon.commands.openGuidePanel', 'guide-panel', 'guide-panel', 'toggle-guide-panel', 'G→L'),
            actionBtn('guidesTab.toggleVisibility', 'ribbon.commands.toggleGuides', 'guide-visibility', 'guides-visibility', 'toggle-guides', 'G→V'),
            actionBtn('guidesTab.analysis', 'ribbon.commands.guideAnalysis', 'guide-analysis', 'guide-analysis', 'toggle-guide-analysis-panel'),
          ],
        },
      ],
    },
  ],
};
