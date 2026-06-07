import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { ICommand } from '../../core/commands';
import type { ToolType } from '../../ui/toolbar/types';
import type { LevelManagerLike } from './canvas-click-types';
import type { Overlay } from '../../overlays/types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import { useTextDoubleClickEditor } from '../../ui/text-toolbar/hooks/useTextDoubleClickEditor';
import { useAutoAreaMouseMove } from './useAutoAreaMouseMove';
import { useRegionPerimeterMouseMove } from './useRegionPerimeterMouseMove';
import { QuickPropertiesMiniPanelStore } from '../../systems/properties/QuickPropertiesMiniPanelStore';
import { PropertiesPaletteStore } from '../../systems/properties/PropertiesPaletteStore';

interface Params {
  transformRef: React.MutableRefObject<{ scale: number; offsetX: number; offsetY: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeTool: ToolType;
  executeCommand: (command: ICommand) => void;
  getSelectedEntityIds: () => readonly string[];
  dxfScene: DxfScene | null;
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  levelManager: LevelManagerLike;
  currentOverlays: Overlay[];
  transformScale: number;
}

export function useCanvasSectionUI({
  transformRef, containerRef, activeTool, executeCommand,
  getSelectedEntityIds, dxfScene,
  handleMouseMove, levelManager, currentOverlays, transformScale,
}: Params) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') return;
      if (e.key === 'F11') { e.preventDefault(); PropertiesPaletteStore.toggle(); return; }
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); PropertiesPaletteStore.toggle(); return; }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);
  const textEditor = useTextDoubleClickEditor({ transformRef, containerRef, executeCommand, getSelectedEntityIds });
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select') {
      const ids = getSelectedEntityIds();
      if (ids.length === 1) {
        const entity = dxfScene?.entities.find(en => en.id === ids[0]);
        if (entity?.type === 'line') {
          const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
          QuickPropertiesMiniPanelStore.open(ids[0], { x: e.clientX - rect.left, y: e.clientY - rect.top });
          return;
        }
      }
    }
    textEditor.handleDoubleClick(e);
  }, [activeTool, getSelectedEntityIds, dxfScene, containerRef, textEditor]);
  const { handleMouseMoveWithAutoArea } = useAutoAreaMouseMove({ handleMouseMove, activeTool, levelManager, currentOverlays, transformScale });
  // ADR-419 Layer 3 — αλυσίδωση: region/perimeter hover preview πάνω από το auto-area.
  const { handleMouseMoveWithRegionPreview } = useRegionPerimeterMouseMove({ handleMouseMove: handleMouseMoveWithAutoArea, activeTool, levelManager });
  return { textEditor, handleDoubleClick, handleMouseMoveWithAutoArea: handleMouseMoveWithRegionPreview };
}
