/**
 * Tool definitions registry (data SSoT) — extracted from `ToolStateManager.ts`
 * for the Google file-size standard (N.7.1). Pure data: the per-tool lifecycle
 * metadata table + its types. The manager logic (hooks, guards, predicates) stays
 * in `ToolStateManager.ts`, which re-exports these for back-compat.
 */
import type { ToolType } from '../../ui/toolbar/types';

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
  'copy': { id: 'copy', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
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
  // ADR-401 Phase E.1/F.3: Wall + Column Attach Top/Base (pick one host then act, exits on click/ESC)
  'wall-attach-top': { id: 'wall-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'wall-attach-base': { id: 'wall-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'column-attach-top': { id: 'column-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'column-attach-base': { id: 'column-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-401 Phase G.3: Stair Attach Top/Base (pick one host then act, exits on click/ESC)
  'stair-attach-top': { id: 'stair-attach-top', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'stair-attach-base': { id: 'stair-attach-base', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-363 R1: BIM Copy (AutoCAD COPY: base + continuous target picks, exits on ESC)
  'bim-copy': { id: 'bim-copy', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-350: Trim (continuous pick loop, Quick mode default, exits on ENTER/ESC/right-click)
  'trim': { id: 'trim', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-353: Extend (continuous pick loop, Quick mode default, exits on ENTER/ESC/right-click)
  'extend': { id: 'extend', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
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
  'opening': { id: 'opening', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 2 — continuous draw
  'slab':    { id: 'slab',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 3 — polygon N-click + Enter
  'column':  { id: 'column',  category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 4 — single-click + Tab anchor cycle
  'beam':    { id: 'beam',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 5 — 2-click straight/cantilever, 3-click curved
  'beam-from-wall': { id: 'beam-from-wall', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 «Δοκάρι από τοίχο» — 1-click pick wall → beam on its axis (auto-attaches wall top, ADR-401 D)
  'slab-opening': { id: 'slab-opening', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-363 Phase 3.7 — 2-click (host slab + position), continuous chain
  'mep-fixture': { id: 'mep-fixture', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-406 — single-click point-based MEP fixture (light fixture first)
  'electrical-panel': { id: 'electrical-panel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ3 — single-click point-based electrical panel (circuit source)
  'mep-manifold': { id: 'mep-manifold', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ12 — single-click point-based plumbing manifold (συλλέκτης, pipe-network source)
  'mep-drainage-collector': { id: 'mep-drainage-collector', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Φ14 — single-click point-based drainage collector (φρεάτιο, N inlets + 1 outlet)
  'mep-radiator': { id: 'mep-radiator', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Εύρος Β — single-click point-based heating radiator (καλοριφέρ, supply + return terminal)
  'mep-boiler': { id: 'mep-boiler', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-408 Εύρος Β #2 — single-click point-based heating boiler (λέβητας, hydronic source)
  'railing': { id: 'railing', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-407 — 2-click path-based railing (straight guardrail), continuous chain
  'roof':    { id: 'roof',    category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-417 — polygon N-click + Enter (footprint + per-edge slopes)
  'floor-finish': { id: 'floor-finish', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }, // ADR-419 — polygon N-click + Enter (covering per room, IfcCovering FLOORING)
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
};
