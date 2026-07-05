/**
 * ADR-404 Phase 5c — Slab tool bridge store (drawing-mode ↔ ribbon).
 *
 * Pattern mirror του `wall-tool-bridge-store.ts` (Phase 5b): **minimal** handle
 * που εκθέτει τα `overrides` του slab tool (`SlabParamOverrides` — ήδη φέρει
 * `geometryType` + `slope`) ώστε το ribbon panel «Κλίση» χωρίς επιλεγμένη πλάκα
 * να οδηγεί τα overrides → η **επόμενη** πλάκα που σχεδιάζεται γεννιέται ήδη
 * κεκλιμένη (`buildDefaultSlabParams` εφαρμόζει `overrides.slope`).
 *
 * Why module store instead of context (ίδιο σκεπτικό με τοίχο/κολώνα):
 *   - `useSlabTool` ζει στο `CanvasSection` subtree.
 *   - `useRibbonSlabBridge` ζει στο `DxfViewerContent` subtree.
 *   - Sibling subtrees — shared context θα απαιτούσε intrusive lift-up (ADR-040).
 *
 * Single writer (`useSlabTool` effect) → multi reader (bridge callbacks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5c
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type { SlabParamOverrides } from '../../../../hooks/drawing/slab-completion';

/** Snapshot του slab tool state που χρειάζεται το ribbon για read/write της κλίσης. */
export interface SlabToolBridgeHandle {
  readonly isActive: boolean;
  readonly overrides: SlabParamOverrides;
  setParamOverrides(overrides: SlabParamOverrides): void;
}

export const slabToolBridgeStore = createToolBridgeStore<SlabToolBridgeHandle>();
