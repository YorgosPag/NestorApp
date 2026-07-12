'use client';
import React from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ADR-575 — GROUP selection affordance overlay (dashed box + «Ομάδα · N»), ADR-040 leaf.
import { GroupSelectionOverlaySubscriber } from './GroupSelectionOverlaySubscriber';
// ADR-575 §8 — GROUP interactive gizmo (move cross + rotation handle) canvas leaf.
import { GroupGizmoLayer } from './GroupGizmoLayer';
// ADR-640 — BLOCK selection affordance overlay (dashed box + «Μπλοκ «name» · N»), ADR-040 leaf.
import { BlockSelectionOverlaySubscriber } from './BlockSelectionOverlaySubscriber';
// ADR-640 — BLOCK interactive gizmo (move cross + rotation handle) canvas leaf.
import { BlockGizmoLayer } from './BlockGizmoLayer';

/**
 * ADR-575/640 — the GROUP + BLOCK container selection affordances, grouped out of the
 * CanvasLayerStack shell so it stays under the 500-line budget (N.7.1).
 *
 * GROUP and BLOCK share ONE container-gizmo prop shape (move cross + rotation handle, same
 * grip glyphs/temperature), so the gizmo props are built once and spread into both leaves
 * (N.18). This is a pure composition — every subscription lives in the leaves themselves, so
 * this wrapper (like the shell) never touches a high-frequency store (ADR-040 cardinal #1).
 */
type ContainerSelectionLayersProps = Pick<
  React.ComponentProps<typeof BlockGizmoLayer>,
  'sceneLevelId' | 'transform' | 'viewport' | 'gripInteractionState' | 'gripSize'
>;

export const ContainerSelectionLayers = React.memo(function ContainerSelectionLayers(
  props: ContainerSelectionLayersProps,
) {
  const { sceneLevelId, transform, viewport } = props;
  const overlayClassName = `absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`;
  // Group + block gizmos take the identical prop shape → build once, spread into both.
  const gizmoProps = {
    ...props,
    className: `absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`,
  };
  return (
    <>
      {/* ADR-575 — GROUP selection affordance: ONE dashed box + «Ομάδα · N» per selected
          group. Self-subscribing leaf (selection + scene) → the Shell stays subscription-free. */}
      <GroupSelectionOverlaySubscriber
        sceneLevelId={sceneLevelId}
        transform={transform}
        viewport={viewport}
        className={overlayClassName}
      />
      {/* ADR-575 §8 — GROUP interactive GIZMO: ONE move cross + ONE rotation handle at each
          selected group's bbox centre, painted with the SAME grip glyphs + hover/hot temperature. */}
      <GroupGizmoLayer {...gizmoProps} />
      {/* ADR-640 — BLOCK selection affordance: ONE dashed box + «Μπλοκ «name» · N» per selected
          block. Self-subscribing leaf (selection + scene), mirror of the group. */}
      <BlockSelectionOverlaySubscriber
        sceneLevelId={sceneLevelId}
        transform={transform}
        viewport={viewport}
        className={overlayClassName}
      />
      {/* ADR-640 — BLOCK interactive GIZMO: ONE move cross + ONE rotation handle at each selected
          block's bbox centre, painted with the SAME grip glyphs as the group. */}
      <BlockGizmoLayer {...gizmoProps} />
    </>
  );
});
