'use client';

/**
 * CanvasSection Overlays — extracted portal-style overlays (ADR-040 Phase XXII.A).
 *
 * Holds: 4 context menus (Drawing, Entity, Guide, GuideBatch), grip menus,
 * quick properties (3 leaves), mirror confirm, text editor overlays (×2),
 * and selection cycling popover. All are sibling overlays of the canvas
 * (each is its own ADR-040 micro-leaf subscriber where applicable).
 *
 * Lives directly below CanvasSection in the React tree. The orchestrator passes
 * down the wired callbacks/refs; this file owns the JSX shape so CanvasSection
 * stays under the 500-line file-size budget (CLAUDE.md N.7.1).
 */

import React from 'react';
import DrawingContextMenu, { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import EntityContextMenu, { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import GuideContextMenu, { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import GuideBatchContextMenu, { type GuideBatchContextMenuHandle } from '../../ui/components/GuideBatchContextMenu';
import { PromptDialog } from '../../systems/prompt-dialog';
import { GripHoverMenu } from '../grip/GripHoverMenu';
import { GripContextMenu } from '../grip/GripContextMenu';
import { QuickPropertiesHoverPopover } from '../../systems/properties/QuickPropertiesHoverPopover';
import { QuickPropertiesMiniPanel } from '../../systems/properties/QuickPropertiesMiniPanel';
import { PropertiesPalette } from '../../systems/properties/PropertiesPalette';
import { MirrorConfirmOverlay } from '../../ui/components/MirrorConfirmOverlay';
import { TextEditorOverlay } from '../../ui/text-toolbar/TextEditorOverlay';
import { SelectionCyclingPopover } from '../../systems/selection/SelectionCyclingPopover';

type QuickHoverProps = React.ComponentProps<typeof QuickPropertiesHoverPopover>;
type QuickMiniProps = React.ComponentProps<typeof QuickPropertiesMiniPanel>;
type PalettePropsT = React.ComponentProps<typeof PropertiesPalette>;
type DrawingMenuProps = React.ComponentProps<typeof DrawingContextMenu>;
type EntityMenuProps = React.ComponentProps<typeof EntityContextMenu>;
type GuideMenuProps = React.ComponentProps<typeof GuideContextMenu>;
type GuideBatchMenuProps = React.ComponentProps<typeof GuideBatchContextMenu>;
type MirrorOverlayProps = React.ComponentProps<typeof MirrorConfirmOverlay>;
type TextOverlayProps = React.ComponentProps<typeof TextEditorOverlay>;
type CyclingProps = React.ComponentProps<typeof SelectionCyclingPopover>;

export interface CanvasSectionOverlaysProps {
  drawingMenuRef: React.RefObject<DrawingContextMenuHandle | null>;
  entityMenuRef: React.RefObject<EntityContextMenuHandle | null>;
  guideMenuRef: React.RefObject<GuideContextMenuHandle | null>;
  guideBatchMenuRef: React.RefObject<GuideBatchContextMenuHandle | null>;
  drawingMenu: Omit<DrawingMenuProps, 'ref'>;
  entityMenu: Omit<EntityMenuProps, 'ref'>;
  guideMenu: Omit<GuideMenuProps, 'ref'>;
  guideBatchMenu: Omit<GuideBatchMenuProps, 'ref'>;
  quickHover: QuickHoverProps;
  quickMini: QuickMiniProps;
  propertiesPalette: PalettePropsT;
  mirrorOverlay: MirrorOverlayProps | null;
  textEditorOverlay: TextOverlayProps | null;
  textCreationOverlay: TextOverlayProps | null;
  selectionCycling: CyclingProps;
}

export const CanvasSectionOverlays: React.FC<CanvasSectionOverlaysProps> = (p) => {
  return (
    <>
      <DrawingContextMenu ref={p.drawingMenuRef as React.Ref<DrawingContextMenuHandle>} {...p.drawingMenu} />
      <EntityContextMenu ref={p.entityMenuRef as React.Ref<EntityContextMenuHandle>} {...p.entityMenu} />
      <GuideContextMenu ref={p.guideMenuRef as React.Ref<GuideContextMenuHandle>} {...p.guideMenu} />
      <GuideBatchContextMenu ref={p.guideBatchMenuRef as React.Ref<GuideBatchContextMenuHandle>} {...p.guideBatchMenu} />
      <PromptDialog />
      <GripHoverMenu />
      {/* ADR-357 Phase 11 — Right-click hot grip context menu (AutoCAD, micro-leaf, ADR-040) */}
      <GripContextMenu />
      {/* ADR-357 Phase 8 — Quick Properties hover tooltip (micro-leaf, ADR-040) */}
      <QuickPropertiesHoverPopover {...p.quickHover} />
      {/* ADR-357 Phase 9 — Quick Properties mini-panel on double-click (micro-leaf, ADR-040) */}
      <QuickPropertiesMiniPanel {...p.quickMini} />
      {/* ADR-357 Phase 10 — Full Properties Palette F11/Ctrl+1 (micro-leaf, ADR-040) */}
      <PropertiesPalette {...p.propertiesPalette} />
      {p.mirrorOverlay && <MirrorConfirmOverlay {...p.mirrorOverlay} />}
      {p.textEditorOverlay && <TextEditorOverlay {...p.textEditorOverlay} />}
      {p.textCreationOverlay && <TextEditorOverlay {...p.textCreationOverlay} />}
      {/* ADR-357 Phase 15 — G13 Selection Cycling popover (portal, micro-leaf, ADR-040) */}
      <SelectionCyclingPopover {...p.selectionCycling} />
    </>
  );
};
