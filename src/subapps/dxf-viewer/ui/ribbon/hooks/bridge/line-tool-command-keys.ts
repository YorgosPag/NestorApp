/**
 * ADR-357 Phase 17 — Ribbon command keys for the Line Tool Quick Style panel.
 * Mirrors the `stair-command-keys.ts` / `wall-command-keys.ts` pattern.
 *
 * ADR-510 Φ4 — extended to an AutoCAD-grade Properties surface for a SELECTED
 * primitive: General (layer + transparency) + Geometry (length / angle /
 * start / end / delta). Draw-defaults mode keeps the original 5 style fields.
 */

export const LINE_TOOL_RIBBON_KEYS = Object.freeze({
  // ADR-570 Φ1 — named line-style (ByStyle) chooser.
  lineStyle:     'lineToolStyle.lineStyle',
  lineweight:    'lineToolStyle.lineweight',
  linetype:      'lineToolStyle.linetype',
  color:         'lineToolStyle.color',
  // ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE, DXF grp 48).
  linetypeScale: 'lineToolStyle.linetypeScale',
  // ADR-510 Φ3d — polyline width (edge-to-edge, model-space; DXF grp 40/41).
  width: 'lineToolStyle.width',
  // ── ADR-510 Φ4 — AutoCAD «General» additions (selected entity) ──────────────
  layer:        'lineToolStyle.layer',        // DXF grp 8 — per-object layer
  transparency: 'lineToolStyle.transparency', // DXF grp 440 — 0 (opaque) .. 90
  // ── ADR-510 Φ4 — AutoCAD «Geometry» (selected line: start/end derived) ──────
  length: 'lineToolStyle.length', // derived |end-start|
  angle:  'lineToolStyle.angle',  // derived atan2, degrees
  startX: 'lineToolStyle.startX',
  startY: 'lineToolStyle.startY',
  endX:   'lineToolStyle.endX',
  endY:   'lineToolStyle.endY',
  deltaX: 'lineToolStyle.deltaX', // end.x - start.x
  deltaY: 'lineToolStyle.deltaY', // end.y - start.y
  // ── ADR-510 Φ4e — FILLET radius (drives FilletToolStore, not an entity edit) ──
  filletRadius: 'lineToolStyle.filletRadius',
  // ── ADR-510 Φ4f — CHAMFER distances + angle (drive ChamferToolStore) ─────────
  chamferDist1: 'lineToolStyle.chamferDist1',
  chamferDist2: 'lineToolStyle.chamferDist2',
  chamferAngle: 'lineToolStyle.chamferAngle',
} as const);

export type LineToolRibbonKey =
  (typeof LINE_TOOL_RIBBON_KEYS)[keyof typeof LINE_TOOL_RIBBON_KEYS];

export function isLineToolRibbonKey(key: string): key is LineToolRibbonKey {
  return (Object.values(LINE_TOOL_RIBBON_KEYS) as string[]).includes(key);
}

/**
 * ADR-510 Φ4 — the Geometry panel (start/end/length/angle) is meaningful only for
 * a selected `line`; for the other style-editable primitives (circle/arc/…) it
 * self-hides via `RibbonPanelDef.visibilityKey` → `getPanelVisibility`.
 *
 * ADR-510 Φ4g — Revit «Options Bar» pattern: the FILLET radius and the CHAMFER
 * distance/angle numeric fields live in their OWN panels that appear ONLY while
 * the matching tool is active (`toolStateStore.activeTool`). Keeping them out of
 * the always-visible «Τροποποίηση» panel is what makes the tab zero-scroll — the
 * 5 large modify buttons stay narrow, and the parameters surface contextually.
 */
export const LINE_TOOL_PANEL_VISIBILITY_KEYS = Object.freeze({
  geometry: 'lineTool.panel.geometry',
  filletOptions: 'lineTool.panel.filletOptions',
  chamferOptions: 'lineTool.panel.chamferOptions',
  // ADR-510 Φ3d — «Πλάτος» is a polyline-only property (global width; DXF grp 40/41).
  // A plain LINE has no width in the data model, so the field is meaningless there and
  // the write silently skips it — the panel self-hides for non-polyline selections
  // (AutoCAD/Revit parity: Global Width shows ONLY on a polyline).
  widthApplicable: 'lineTool.panel.widthApplicable',
} as const);

export type LineToolPanelVisibilityKey =
  (typeof LINE_TOOL_PANEL_VISIBILITY_KEYS)[keyof typeof LINE_TOOL_PANEL_VISIBILITY_KEYS];

export function isLineToolPanelVisibilityKey(
  key: string,
): key is LineToolPanelVisibilityKey {
  return (Object.values(LINE_TOOL_PANEL_VISIBILITY_KEYS) as string[]).includes(key);
}
