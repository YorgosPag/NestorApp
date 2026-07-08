/**
 * Tool definitions registry (data SSoT) — extracted from `ToolStateManager.ts`
 * for the Google file-size standard (N.7.1). Pure data: the per-tool lifecycle
 * metadata table + its types. The manager logic (hooks, guards, predicates) stays
 * in `ToolStateManager.ts`, which re-exports these for back-compat.
 */
import type { ToolType } from '../../ui/toolbar/types';
// ADR-587 Φ2b — tool→entity back-link. `import type` only ⇒ zero runtime coupling/cycle
// (the merge below reads the plain map, not any runtime value from the render layer).
import type { RenderableEntityType } from '../../rendering/contract/renderable-entity-type';

export type ToolCategory = 'selection' | 'drawing' | 'measurement' | 'zoom' | 'utility' | 'editing';
export interface ToolInfo {
  id: ToolType;
  category: ToolCategory;
  requiresCanvas: boolean;
  canInterrupt: boolean;
  allowsContinuous: boolean;
  /** 🏢 ENTERPRISE (2026-01-26): ADR-033 - Whether this tool preserves overlay draw mode when active */
  preservesOverlayMode: boolean;
  /** ADR-357 Phase 5: Chain mode — last endpoint seeds start of next segment (AutoCAD LINE pattern) */
  allowsChain?: boolean;
  /**
   * ADR-587 Φ2b — the RenderableEntityType this tool authors (tool→entity back-link).
   * DERIVED from {@link TOOL_CREATES_ENTITY} at module load, never hand-set on an entry
   * (mirror of the Φ2 `descriptor.dxfExportType` derivation). Absent ⇒ the tool does not
   * author a persistent renderable scene entity (editing / selection / measurement /
   * guide / dimension / attach tools, and the `finish-paint` face-override brush).
   * ToolType-keyed by design (§5.1): one entity ⇐ many tools (e.g. 6 `wall-*`, 16 fixtures).
   */
  createsEntityType?: RenderableEntityType;
}
export const TOOL_DEFINITIONS: Record<ToolType, ToolInfo> = {
  // Selection tools - preserve overlay mode for editing
  'select': { id: 'select', category: 'selection', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: true },
  // Drawing tools - cancel overlay mode (CAD drawing ≠ overlay drawing)
  'line': { id: 'line', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false, allowsChain: true },
  'line-perpendicular': { id: 'line-perpendicular', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'line-parallel': { id: 'line-parallel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'rectangle': { id: 'rectangle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle': { id: 'circle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-diameter': { id: 'circle-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-2p-diameter': { id: 'circle-2p-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-3p': { id: 'circle-3p', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-chord-sagitta': { id: 'circle-chord-sagitta', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-2p-radius': { id: 'circle-2p-radius', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-best-fit': { id: 'circle-best-fit', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-ttt': { id: 'circle-ttt', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'polyline': { id: 'polyline', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'polygon': { id: 'polygon', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-507 S2 — γραμμοσκίαση: polygon N-click + Enter (κλειστό όριο → HatchEntity).
  'hatch': { id: 'hatch', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'ellipse': { id: 'ellipse', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'text': { id: 'text', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'mtext': { id: 'mtext', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'arc': { id: 'arc', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-3p': { id: 'arc-3p', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-cse': { id: 'arc-cse', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-sce': { id: 'arc-sce', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Measurement tools - cancel overlay mode (measurement ≠ overlay drawing)
  // 🏢 ENTERPRISE FIX (2026-01-26): allowsContinuous: true for consecutive measurements
  // Pattern: AutoCAD/BricsCAD - measurement tools stay active for multiple measurements
  'measure': { id: 'measure', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-distance': { id: 'measure-distance', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (2026-01-27): Continuous distance measurement - AutoCAD MEASUREGEOM pattern
  // Creates separate measurement entities for each pair of points, continues until double-click/Escape
  'measure-distance-continuous': { id: 'measure-distance-continuous', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-area': { id: 'measure-area', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'auto-measure-area': { id: 'auto-measure-area', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle': { id: 'measure-angle', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-line-arc': { id: 'measure-angle-line-arc', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-two-arcs': { id: 'measure-angle-two-arcs', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-measuregeom': { id: 'measure-angle-measuregeom', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-constraint': { id: 'measure-angle-constraint', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-radius': { id: 'measure-radius', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-perimeter': { id: 'measure-perimeter', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Zoom tools - cancel overlay mode (zoom interaction ≠ overlay drawing)
  'zoom-in': { id: 'zoom-in', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-out': { id: 'zoom-out', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-extents': { id: 'zoom-extents', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-window': { id: 'zoom-window', category: 'zoom', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // Utility tools - pan doesn't interact with overlay drawing
  'pan': { id: 'pan', category: 'utility', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (Phase 3): Editing tools for entity manipulation
  'move': { id: 'move', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'rotate': { id: 'rotate', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-363 R1 / ADR-577: unified COPY (AutoCAD COPY: base + continuous target picks, exits on ESC)
  'copy': { id: 'copy', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-581: Match/Transfer Properties brush (σύριγγα) — category 'editing' ⇒ ΟΧΙ interactive/drawing (δεν μπαίνει στο drawing-preview pipeline). allowsContinuous: πολλαπλά inject clicks.
  'match-properties': { id: 'match-properties', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'delete': { id: 'delete', category: 'editing', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'grip-edit': { id: 'grip-edit', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: true },
  // ADR-348: Scale command (uniform + non-uniform + copy mode + reference mode)
  'scale': { id: 'scale', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // Mirror command
  'mirror': { id: 'mirror', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-349 Phase 1a: Stretch (crossing-window) + MStretch (multi-window union)
  'stretch': { id: 'stretch', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'mstretch': { id: 'mstretch', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-363 Phase 5.6: Wall Split (Revit Split Element — continuous pick loop, exits on ESC)
  'wall-split': { id: 'wall-split', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-566: Wall Merge (AutoCAD JOIN for walls — continuous pick loop, exits on ESC)
  'wall-merge': { id: 'wall-merge', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-568: Wall gap-bridge + auto-opening (collinear walls with a gap — continuous pick loop, exits on ESC)
  'wall-gap-opening': { id: 'wall-gap-opening', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-401 Phase E.1/F.3: Wall + Column Attach Top/Base (pick one host then act, exits on click/ESC)
  'wall-attach-top': { id: 'wall-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'wall-attach-base': { id: 'wall-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'column-attach-top': { id: 'column-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'column-attach-base': { id: 'column-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-401 Phase G.3: Stair Attach Top/Base (pick one host then act, exits on click/ESC)
  'stair-attach-top': { id: 'stair-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'stair-attach-base': { id: 'stair-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-350: Trim (continuous pick loop, Quick mode default, exits on ENTER/ESC/right-click)
  'trim': { id: 'trim', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-353: Extend (continuous pick loop, Quick mode default, exits on ENTER/ESC/right-click)
  'extend': { id: 'extend', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-510 Φ4d: Offset (pick source → live ghost → click; continuous, exits on ENTER/ESC/right-click)
  'offset': { id: 'offset', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-510 Φ4e: Fillet (pick 2 lines → tangent arc + trim, or Polyline mode; continuous, exits on ENTER/ESC/right-click)
  'fillet': { id: 'fillet', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-510 Φ4f: Chamfer (pick 2 lines → bevel line + trim, or Polyline mode; continuous, exits on ENTER/ESC/right-click)
  'chamfer': { id: 'chamfer', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-353 Phase A: Rectangular Array (single-shot: pre-select sources → activate → array created → ribbon contextual tab adjusts params)
  'array-rect': { id: 'array-rect', category: 'editing', requiresCanvas: false, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-353 Phase B: Polar Array (requiresCanvas=true: B2 adds interactive center-pick)
  'array-polar': { id: 'array-polar', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // Crop tools (window / polygon / lasso freehand)
  'crop-window': { id: 'crop-window', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'polygon-crop': { id: 'polygon-crop', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'lasso-crop': { id: 'lasso-crop', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // 🏢 ENTERPRISE: Layering tool - ALWAYS preserves overlay mode (it's the overlay management tool!)
  'layering': { id: 'layering', category: 'utility', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: true },
  // ADR-189: Construction guide tools
  'guide-x': { id: 'guide-x', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-z': { id: 'guide-z', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-parallel': { id: 'guide-parallel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-delete': { id: 'guide-delete', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-xz': { id: 'guide-xz', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-perpendicular': { id: 'guide-perpendicular', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 §3.7-3.16: Construction snap point tools
  'guide-segments': { id: 'guide-segments', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-distance': { id: 'guide-distance', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-add-point': { id: 'guide-add-point', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-delete-point': { id: 'guide-delete-point', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 §3.9/3.10/3.12: Arc guide tools
  'guide-arc-segments': { id: 'guide-arc-segments', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-arc-distance': { id: 'guide-arc-distance', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-arc-line-intersect': { id: 'guide-arc-line-intersect', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-circle-intersect': { id: 'guide-circle-intersect', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B5: Guide drag move tool
  'guide-move': { id: 'guide-move', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Center of rectangle formed by 4 guides
  'guide-rect-center': { id: 'guide-rect-center', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Construction point at midpoint of line entity
  'guide-line-midpoint': { id: 'guide-line-midpoint', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Construction point at center of circle/arc entity
  'guide-circle-center': { id: 'guide-circle-center', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B2: Automatic grid generation
  'guide-grid': { id: 'guide-grid', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B28: Rotate single guide
  'guide-rotate': { id: 'guide-rotate', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B30: Rotate all guides
  'guide-rotate-all': { id: 'guide-rotate-all', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B29: Rotate guide group
  'guide-rotate-group': { id: 'guide-rotate-group', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B33: Smart equalize guide spacing
  'guide-equalize': { id: 'guide-equalize', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B31: Polar array of guides
  'guide-polar-array': { id: 'guide-polar-array', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B32: Scale all guides
  'guide-scale': { id: 'guide-scale', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B16: Guide at typed angle
  'guide-angle': { id: 'guide-angle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B19: Mirror guides across axis
  'guide-mirror': { id: 'guide-mirror', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B8: Guide from entity
  'guide-from-entity': { id: 'guide-from-entity', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B14: Multi-select guides
  'guide-select': { id: 'guide-select', category: 'selection', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B17: Copy/offset pattern
  'guide-copy-pattern': { id: 'guide-copy-pattern', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B24: Guide offset from entity edge
  'guide-offset-entity': { id: 'guide-offset-entity', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 B23: Structural preset grid
  'guide-preset-grid': { id: 'guide-preset-grid', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B37: Batch guide from selection
  'guide-from-selection': { id: 'guide-from-selection', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'stair': { id: 'stair', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false }, // ADR-358 Phase 0
  'wall':  { id: 'wall',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true,  preservesOverlayMode: false }, // ADR-363 Phase 1 — continuous draw (chain walls)
  'wall-on-entity': { id: 'wall-on-entity', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 1J — wall on existing 2D entity (pick line/rectangle)
  'wall-region-lines': { id: 'wall-region-lines', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Τοίχος από 4 γραμμές» (split του wall-in-region)
  'wall-region-inside': { id: 'wall-region-inside', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Τοίχος μέσα σε περιοχή»
  'wall-region-box': { id: 'wall-region-box', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Τοίχοι με πλαίσιο» (box-select)
  'wall-from-perimeter': { id: 'wall-from-perimeter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 «Τοίχος από περίγραμμα» — box-select faces → leg walls
  'column-from-perimeter': { id: 'column-from-perimeter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — box-select faces → ΕΝΑ ColumnEntity/περίμετρο
  'column-discrete-from-perimeter': { id: 'column-discrete-from-perimeter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — box-select faces → ΧΩΡΙΣ ένωση, αυτόματη ταξινόμηση + confirm
  'column-discrete-from-perimeter-walls': { id: 'column-discrete-from-perimeter-walls', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 «Πολλαπλή δημιουργία τοιχίων» — discrete-from-perimeter intent=walls
  'column-region-lines': { id: 'column-region-lines', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Κολώνα από 4 γραμμές» (split του column-in-region)
  'column-region-inside': { id: 'column-region-inside', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Κολώνα μέσα σε περιοχή»
  'column-region-box': { id: 'column-region-box', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — «Κολώνες με πλαίσιο» (box-select)
  'column-from-polygon': { id: 'column-from-polygon', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 §column-polygon-sketch — «Κολώνα από σχεδιασμένο πολύγωνο» (vertex chain N-click + Enter, ΙΔΙΟ engine με slab)
  'opening': { id: 'opening', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 2 — continuous draw
  'slab':    { id: 'slab',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 3 — polygon N-click + Enter
  'column':  { id: 'column',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 4 — single-click + Tab anchor cycle
  'beam':    { id: 'beam',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 5 — 2-click straight/cantilever, 3-click curved
  'foundation-pad': { id: 'foundation-pad', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-436 Slice 1 — μεμονωμένο πέδιλο, single-click + Tab anchor cycle
  'foundation-strip': { id: 'foundation-strip', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-436 Slice 2 — πεδιλοδοκός, 2-click line (mirror beam)
  'foundation-tie-beam': { id: 'foundation-tie-beam', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-436 Slice 2 — συνδετήρια δοκός, 2-click line (mirror beam)
  'foundation-strip-from-wall': { id: 'foundation-strip-from-wall', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-436 Slice 2 — «Πεδιλοδοκός από τοίχο», 1-click pick wall → strip on its axis (auto-attach ADR-401 D)
  'beam-from-wall': { id: 'beam-from-wall', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 «Δοκάρι από τοίχο» — 1-click pick wall → beam on its axis (auto-attaches wall top, ADR-401 D)
  'beam-between-members': { id: 'beam-between-members', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-569 «Δοκάρι ανάμεσα σε μέλη» — σειριακά κλικ σε κολόνες/τοιχία → δοκάρι ανά διαδοχικό ζεύγος (παρειά→παρειά, continuous chain + selection-first)
  'slab-opening': { id: 'slab-opening', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 3.7 — 2-click (host slab + position), continuous chain
  'mep-fixture': { id: 'mep-fixture', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-406 — single-click point-based MEP fixture (light fixture first)
  'mep-socket': { id: 'mep-socket', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-430 — single-click point-based electrical socket (πρίζα, mep-fixture kind, power-in connector)
  'mep-data-outlet': { id: 'mep-data-outlet', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-431 — single-click point-based data outlet (πρίζα δικτύου / RJ45, mep-fixture kind, data-in connector)
  'mep-air-terminal': { id: 'mep-air-terminal', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-432 — single-click point-based HVAC air terminal (στόμιο/diffuser, mep-fixture kind, supply-air duct inlet)
  'mep-ahu': { id: 'mep-ahu', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-432 — single-click point-based air handling unit (ΚΚΜ/AHU, mep-fixture kind, supply-air duct outlet = network source)
  'mep-sprinkler': { id: 'mep-sprinkler', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-433 — single-click point-based fire sprinkler head (καταιονητήρας, mep-fixture kind, fire-sprinkler pipe inlet)
  'mep-fire-riser': { id: 'mep-fire-riser', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-433 — single-click point-based fire riser (στήλη πυρόσβεσης, mep-fixture kind, fire-sprinkler pipe outlet = network source)
  'mep-gas-meter': { id: 'mep-gas-meter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-434 — single-click point-based gas meter (μετρητής αερίου, mep-fixture kind, fuel-gas outlet = network source)
  'mep-gas-cooker': { id: 'mep-gas-cooker', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-434 — single-click point-based gas cooker (εστία αερίου, mep-fixture kind, fuel-gas inlet terminal)
  'mep-comms-rack': { id: 'mep-comms-rack', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-431 — single-click point-based comms-rack (rack/patch-panel, electrical-panel kind, weak-current source)
  'electrical-panel': { id: 'electrical-panel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ3 — single-click point-based electrical panel (circuit source)
  'mep-manifold': { id: 'mep-manifold', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ12 — single-click point-based plumbing manifold (συλλέκτης, pipe-network source)
  'mep-drainage-collector': { id: 'mep-drainage-collector', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ14 — single-click point-based drainage collector (φρεάτιο, N inlets + 1 outlet)
  'mep-floor-drain': { id: 'mep-floor-drain', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ14 — single-click point-based floor drain (σιφώνι, mep-fixture kind, 1 sanitary-drainage outlet)
  // ADR-408 Φ14 — single-click point-based sanitary terminals (WC/washbasin/shower/bathtub/bidet), mep-fixture kinds, each 1 sanitary-drainage outlet.
  'mep-wc': { id: 'mep-wc', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'mep-washbasin': { id: 'mep-washbasin', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'mep-shower': { id: 'mep-shower', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'mep-bathtub': { id: 'mep-bathtub', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'mep-bidet': { id: 'mep-bidet', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-408 Δρόμος B — single-click point-based appliances (washing machine, …), mep-fixture kinds, cold inlet + 1 sanitary-drainage outlet each.
  'mep-washing-machine': { id: 'mep-washing-machine', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-408 Φ15 — single-click vertical drain stack (κατακόρυφη στήλη, vertical mep-segment).
  'mep-drain-riser': { id: 'mep-drain-riser', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'mep-radiator': { id: 'mep-radiator', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Εύρος Β — single-click point-based heating radiator (καλοριφέρ, supply + return terminal)
  'mep-boiler': { id: 'mep-boiler', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Εύρος Β #2 — single-click point-based heating boiler (λέβητας, hydronic source)
  'mep-water-heater': { id: 'mep-water-heater', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 — single-click point-based domestic water heater (θερμοσίφωνας, DHW source)
  'mep-underfloor': { id: 'mep-underfloor', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Εύρος Β #3 — polygon N-click + Enter area-based radiant floor heating loop (ενδοδαπέδια)
  'railing': { id: 'railing', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-407 — 2-click path-based railing (straight guardrail), continuous chain
  'roof':    { id: 'roof',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-417 — polygon N-click + Enter (footprint + per-edge slopes)
  'floor-finish': { id: 'floor-finish', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — polygon N-click + Enter (covering per room, IfcCovering FLOORING)
  'wall-covering': { id: 'wall-covering', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-511 — pick τοίχου+παρειάς → 2-click span (φινίρισμα τοίχου per room/face, IfcCovering CLADDING)
  'wall-covering-room': { id: 'wall-covering-room', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-511 Slice C — pick τοίχου+παρειάς → auto N regions ανά δωμάτιο (room-fill, ένα undo)
  // ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush: category 'drawing' → isInDrawingMode
  // (το mouse-up skip-άρει την επιλογή entity ενώ βάφεις)· ο click intercept στο
  // useCanvasClickHandler καταναλώνει το κλικ (βάφει όψη σοβά) → μένει armed (πολλές όψεις).
  'finish-paint': { id: 'finish-paint', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'furniture': { id: 'furniture', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-410 — single-click mesh-based CC0 furniture (chair first)
  'floorplan-symbol': { id: 'floorplan-symbol', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-415 — single-click pure-vector 2D floorplan symbol (WC/sanitary first)
  'mep-duct': { id: 'mep-duct', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ8 — 2-click linear duct run, continuous chain
  'mep-pipe': { id: 'mep-pipe', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ8 — 2-click linear pipe run, continuous chain
  'mep-drain-pipe': { id: 'mep-drain-pipe', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ14 — 2-click sanitary drainage pipe (preset classification + slope), continuous chain
  // ADR-359 Phase 1: Auxiliary geometry tools (XLINE = infinite, RAY = semi-infinite)
  'xline': { id: 'xline', category: 'drawing', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: false, allowsChain: true },
  'ray':   { id: 'ray',   category: 'drawing', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: false, allowsChain: true },
  // ADR-362 Phase D1: Enterprise Dimension creation tools (Smart DIM + 4 manual overrides)
  'dim-smart':      { id: 'dim-smart',      category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-linear':     { id: 'dim-linear',     category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-aligned':    { id: 'dim-aligned',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-362 Phase N: pick-entity quick dimension — 2-click (entity pick + placement), drag decides aligned/H/V.
  'dim-entity':     { id: 'dim-entity',     category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-angular2L':  { id: 'dim-angular2L',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-angular3P':  { id: 'dim-angular3P',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-362 Phase D2: Radial family + Ordinate creation tools
  'dim-radius':        { id: 'dim-radius',        category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-diameter':      { id: 'dim-diameter',      category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-arc-length':    { id: 'dim-arc-length',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-jogged-radius': { id: 'dim-jogged-radius', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-ordinate':      { id: 'dim-ordinate',      category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-362 Phase D3: Chained dim creation (Baseline / Continued) — same metadata as D1/D2 dim tools.
  'dim-baseline':      { id: 'dim-baseline',      category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-continued':     { id: 'dim-continued',     category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-362 Phase A1: Center mark + centerline tools
  'dim-center-mark':   { id: 'dim-center-mark',   category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'dim-centerline':    { id: 'dim-centerline',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-563 Φ4-Α: interactive cut-line dimension tool (dialog → 3-click → ghost chain).
  // `drawing` category → mouse-up skips selection + grips skipped, like the dim tools.
  'auto-dim-cutline':  { id: 'auto-dim-cutline',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-583: Annotation symbol library — single-click placement (North arrow first).
  // `drawing` category, continuous (place several), the click is consumed in
  // useCanvasClickHandler PRIORITY 1.8 so it never enters the unified drawing accumulator.
  'north-arrow':       { id: 'north-arrow',       category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
};

/**
 * ADR-587 Φ2b — Tool → RenderableEntityType authoring SSoT (ToolType-keyed, §5.1).
 *
 * ΤΟ σημείο αλήθειας για «ποια οντότητα φτιάχνει κάθε εργαλείο». Κρατιέται **συμπαγές**
 * (grouped ανά entity type) ώστε το «μία οντότητα → ΠΟΛΛΑ tools» (§5.1) να φαίνεται με
 * μια ματιά — ακριβώς όπως ο compact command→category πίνακας του Revit, ΟΧΙ ένα πεδίο
 * σκορπισμένο σε 6 wall entries 40 γραμμές μακριά. Το `ToolInfo.createsEntityType` είναι
 * **DERIVED** από εδώ (loop παρακάτω), mirror του Φ2 `descriptor.dxfExportType` ⇐ `ENTITY_TYPE_MAPPING`.
 *
 * **Κάθε τιμή επαληθεύτηκε από τον κώδικα δημιουργίας** (factory `type:` literal ή drawing-hook
 * commit), ΟΧΙ από το όνομα του tool — π.χ. `north-arrow`→`annotation-symbol`,
 * `mep-drainage-collector`→`mep-manifold`, `mep-drain-riser`→`mep-segment`.
 *
 * **Deliberately absent** (τεκμηριωμένο, ΟΧΙ κενό προς συμπλήρωση):
 *  - editing / selection / zoom / utility / attach tools → τροποποιούν, δεν δημιουργούν.
 *  - `category:'measurement'` tools → τα line/polyline/angle outputs τους είναι measurement
 *    artifacts (flag `measurement:true`), όχι entity authoring.
 *  - `guide-*` → construction guides (όχι RenderableEntityType scene entities).
 *  - `dim-*` / `auto-dim-cutline` → dimension subsystem (dimension + center-mark/centerline·
 *    τα δύο τελευταία ΔΕΝ είναι ακόμη RenderableEntityTypes → χωριστό follow-up).
 *  - `finish-paint` → per-face override σε υπάρχον wall-covering (δεν δημιουργεί entity).
 *  - `ellipse` / `arc` (dropdown parent) → χωρίς επαληθευμένο dedicated creation path.
 *
 * **Surfaced asymmetry** (ADR-587 §6 — το registry το ανέδειξε, ΟΧΙ διορθώνεται εδώ):
 *  - `floorplan-symbol` — το tool `floorplan-symbol` ΔΗΜΙΟΥΡΓΕΙ `type:'floorplan-symbol'`
 *    (`floorplan-symbol.factory.ts:47`) που ΕΧΕΙ renderer (`FloorplanSymbolRenderer`), αλλά ο τύπος
 *    ΛΕΙΠΕΙ από το ADR-550 `RENDERABLE_ENTITY_TYPES` (αποδίδεται μέσω του entity-model path, όχι του
 *    `EntityRendererComposite`). Το να μπει εκεί απαιτεί πλήρη αλλαγή ADR-550 (surfaces+contracts+
 *    render-coverage) → χωριστό follow-up. Εξαιρείται από τον χάρτη· καρφωμένο στο coverage test.
 *
 * **Entity-side gaps** (RenderableEntityTypes ΧΩΡΙΣ ToolType back-link): `thermal-space`,
 * `space-separator` (δημιουργούνται από hooks που ΔΕΝ είναι `ToolType` → εκτός `TOOL_DEFINITIONS`),
 * καθώς και import-only types (`spline`/`lwpolyline`/`rect`/`point`/`dimension`/`angle-measurement`).
 * Καρφωμένα στο coverage test.
 */
export const TOOL_CREATES_ENTITY: Partial<Record<ToolType, RenderableEntityType>> = {
  // ── CAD primitives (2D) ──
  'line': 'line', 'line-perpendicular': 'line', 'line-parallel': 'line',
  'rectangle': 'rectangle',
  'circle': 'circle', 'circle-diameter': 'circle', 'circle-2p-diameter': 'circle',
  'circle-3p': 'circle', 'circle-chord-sagitta': 'circle', 'circle-2p-radius': 'circle',
  'circle-best-fit': 'circle', 'circle-ttt': 'circle',
  'polyline': 'polyline', 'polygon': 'polyline',
  'arc-3p': 'arc', 'arc-cse': 'arc', 'arc-sce': 'arc',
  'hatch': 'hatch',
  'text': 'text', 'mtext': 'mtext',
  'xline': 'xline', 'ray': 'ray',
  // ── BIM structural ──
  'stair': 'stair',
  'wall': 'wall', 'wall-on-entity': 'wall', 'wall-region-lines': 'wall',
  'wall-region-inside': 'wall', 'wall-region-box': 'wall', 'wall-from-perimeter': 'wall',
  'column': 'column', 'column-from-perimeter': 'column', 'column-discrete-from-perimeter': 'column',
  'column-discrete-from-perimeter-walls': 'column', 'column-region-lines': 'column',
  'column-region-inside': 'column', 'column-region-box': 'column', 'column-from-polygon': 'column',
  'opening': 'opening',
  'slab': 'slab',
  'slab-opening': 'slab-opening',
  'beam': 'beam', 'beam-from-wall': 'beam', 'beam-between-members': 'beam',
  'foundation-pad': 'foundation', 'foundation-strip': 'foundation',
  'foundation-tie-beam': 'foundation', 'foundation-strip-from-wall': 'foundation',
  'roof': 'roof',
  'railing': 'railing',
  // ── BIM finishes ──
  'floor-finish': 'floor-finish',
  'wall-covering': 'wall-covering', 'wall-covering-room': 'wall-covering',
  'furniture': 'furniture',
  // NB: `floorplan-symbol` deliberately absent — see the JSDoc «surfaced asymmetries» note.
  // ── Annotation (ADR-583 Βορράς) — tool id ≠ entity type ──
  'north-arrow': 'annotation-symbol',
  // ── MEP fixtures (16 tools → ΕΝΑ entity, discriminated by `kind`) ──
  'mep-fixture': 'mep-fixture', 'mep-socket': 'mep-fixture', 'mep-data-outlet': 'mep-fixture',
  'mep-air-terminal': 'mep-fixture', 'mep-ahu': 'mep-fixture', 'mep-sprinkler': 'mep-fixture',
  'mep-fire-riser': 'mep-fixture', 'mep-gas-meter': 'mep-fixture', 'mep-gas-cooker': 'mep-fixture',
  'mep-floor-drain': 'mep-fixture', 'mep-wc': 'mep-fixture', 'mep-washbasin': 'mep-fixture',
  'mep-shower': 'mep-fixture', 'mep-bathtub': 'mep-fixture', 'mep-bidet': 'mep-fixture',
  'mep-washing-machine': 'mep-fixture',
  // ── MEP panels / manifolds (comms-rack→panel, drainage-collector→manifold) ──
  'electrical-panel': 'electrical-panel', 'mep-comms-rack': 'electrical-panel',
  'mep-manifold': 'mep-manifold', 'mep-drainage-collector': 'mep-manifold',
  // ── MEP equipment ──
  'mep-radiator': 'mep-radiator', 'mep-boiler': 'mep-boiler',
  'mep-water-heater': 'mep-water-heater', 'mep-underfloor': 'mep-underfloor',
  // ── MEP linear segments (duct/pipe/drain/riser → ΕΝΑ entity) ──
  'mep-duct': 'mep-segment', 'mep-pipe': 'mep-segment', 'mep-drain-pipe': 'mep-segment',
  'mep-drain-riser': 'mep-segment',
};

// ADR-587 Φ2b — project the SSoT map onto each `ToolInfo.createsEntityType` (DERIVED, mirror
// of Φ2 `dxfExportType`). One derives the other ⇒ cannot drift; consumers may read either the
// compact map (fan-out view) or `TOOL_DEFINITIONS[tool].createsEntityType` (per-tool view).
for (const toolId of Object.keys(TOOL_CREATES_ENTITY) as ToolType[]) {
  TOOL_DEFINITIONS[toolId].createsEntityType = TOOL_CREATES_ENTITY[toolId];
}
