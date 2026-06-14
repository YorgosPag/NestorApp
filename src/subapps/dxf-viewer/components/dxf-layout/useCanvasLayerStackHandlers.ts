// ⚠️ ARCHITECTURE-CRITICAL — ADR-040. Extracted from CanvasLayerStack to keep the
// shell <500 lines (N.7.1). Behaviour-preserving: these stay PLAIN functions
// (recreated per render, identical to their previous inline form) — do NOT wrap
// in useCallback without auditing the shell's memo dependencies.
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';

interface MarqueeResult {
  layerIds: string[];
  entityIds: string[];
  circuitIds?: string[];
  subtract?: boolean;
}

export interface CanvasLayerStackHandlers {
  handleTransformChange: (newTransform: ViewTransform) => void;
  handleDxfEntitiesSelected: (entityIds: string[]) => void;
  handleUnifiedMarqueeResult: (result: MarqueeResult) => void;
  handleOverlayClickWithEntityClear: (overlayId: string, point: Point2D) => void;
  handleMultiOverlayClickWithEntityClear: (layerIds: string[]) => void;
  handleDxfEntitySelect: (entityId: string | null, additive?: boolean) => void;
}

type Deps = Pick<
  CanvasLayerStackProps,
  | 'setTransform'
  | 'zoomSystem'
  | 'universalSelection'
  | 'handleOverlayClick'
  | 'handleMultiOverlayClick'
  | 'entitySelectedOnMouseDownRef'
>;

/**
 * Selection & click handlers for {@link CanvasLayerStack}. Returns plain functions
 * (new identity per render) to mirror the previous inline behaviour exactly.
 */
export function useCanvasLayerStackHandlers({
  setTransform,
  zoomSystem,
  universalSelection,
  handleOverlayClick,
  handleMultiOverlayClick,
  entitySelectedOnMouseDownRef,
}: Deps): CanvasLayerStackHandlers {
  const handleTransformChange = (newTransform: ViewTransform) => {
    setTransform(newTransform);
    zoomSystem.setTransform(newTransform);
  };
  const handleDxfEntitiesSelected = (entityIds: string[]) => {
    universalSelection.replaceEntitySelection(entityIds);
  };
  const handleUnifiedMarqueeResult = ({
    layerIds,
    entityIds,
    circuitIds,
    subtract,
  }: MarqueeResult) => {
    // ADR-408 — a window/crossing box that catches circuits' home-run wires selects ALL of
    // them (Revit multi-select), mutually exclusive with entity selection (clear it, mirroring
    // wire click-select). Every selected circuit lights its grips; the primary (top-most in
    // paint order) drives the «Κύκλωμα» properties tab.
    if (circuitIds && circuitIds.length > 0) {
      universalSelection.clearAll();
      useMepCircuitEditorStore.getState().setSelectedCircuits(circuitIds);
      return;
    }
    universalSelection.handleMarqueeResult(layerIds, entityIds, { subtract: !!subtract });
  };
  const handleOverlayClickWithEntityClear = (overlayId: string, point: Point2D) => {
    universalSelection.clearByType('dxf-entity');
    handleOverlayClick(overlayId, point);
  };
  const handleMultiOverlayClickWithEntityClear = (layerIds: string[]) => {
    universalSelection.clearByType('dxf-entity');
    handleMultiOverlayClick(layerIds);
  };
  const handleDxfEntitySelect = (entityId: string | null, additive?: boolean) => {
    if (entityId) {
      universalSelection.handleEntityClick(entityId, { shiftKey: !!additive });
      entitySelectedOnMouseDownRef.current = true;
    } else if (!additive) {
      entitySelectedOnMouseDownRef.current = false;
    }
  };
  return {
    handleTransformChange,
    handleDxfEntitiesSelected,
    handleUnifiedMarqueeResult,
    handleOverlayClickWithEntityClear,
    handleMultiOverlayClickWithEntityClear,
    handleDxfEntitySelect,
  };
}
