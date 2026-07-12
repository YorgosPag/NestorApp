/**
 * BlockSelectionOverlaySubscriber — ADR-640 / ADR-641 / ADR-040 micro-leaf.
 *
 * ADR-641 (Giorgio 2026-07-12): a selected BLOCK no longer shows the dashed selection box or the
 * floating «Μπλοκ «name» · N αντικείμενα» pill. Its selection affordance is now the wall-grade
 * transform gizmo (8 perimeter box handles + move cross + rotation handle, emitted by
 * `getBlockGizmoGrips` and painted by {@link ContainerGizmoLayer}) plus the member highlight the
 * paint leaf already draws; the name + count read-out lives ONLY in the status bar
 * (`StatusBarBlockSelectionLeaf`). So this leaf paints nothing.
 *
 * This is BLOCK-specific: the GROUP still shows its dashed box + «Ομάδα · N» pill via the
 * SEPARATE `GroupSelectionOverlaySubscriber` (untouched) — the two containers no longer share a
 * visible overlay, only the presentational `GroupSelectionOverlay` renderer the group still uses.
 *
 * Kept as a mounted null-leaf (not deleted) so the `ContainerSelectionLayers` composition + its
 * ADR-040 subscription-free contract are unchanged; if the block ever needs a bespoke overlay
 * again it re-grows here.
 *
 * @see components/dxf-layout/ContainerGizmoLayer.tsx — the block's new selection affordance
 * @see components/dxf-layout/GroupSelectionOverlaySubscriber.tsx — the GROUP box+pill (still on)
 * @see ui/toolbar/StatusBarBlockSelectionLeaf.tsx — the name + count read-out (still on)
 */
'use client';

import React from 'react';
import type { ViewTransform } from '../../rendering/types/Types';

interface BlockSelectionOverlaySubscriberProps {
  /** Active level id — retained for prop-shape parity with the sibling container leaves. */
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

export const BlockSelectionOverlaySubscriber = React.memo(function BlockSelectionOverlaySubscriber(
  _props: BlockSelectionOverlaySubscriberProps,
) {
  // ADR-641 — the whole-block dashed box + pill are intentionally not drawn (see file header).
  return null;
});
