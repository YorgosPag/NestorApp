import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneLayer } from '../../types/scene';
import type { Region } from '../../types/overlay';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';

export interface UniversalSelectionInput {
  // DXF Entities (optional)
  entities?: AnySceneEntity[];
  entityLayers?: Record<string, SceneLayer>;

  // Overlay Regions (optional)
  overlays?: Region[];

  // Color Layers (optional)
  colorLayers?: ColorLayer[];

  // Selection settings
  // 🏢 ADR-105: Default tolerance from centralized config
  tolerance?: number; // Default: TOLERANCE_CONFIG.HIT_TEST_FALLBACK (5 pixels)
  enableDebugLogs?: boolean; // Default: false

  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ CALLBACKS - Όλη η multi-selection λογική εδώ
  onLayerSelected?: (layerId: string, position: Point2D) => void; // Individual layer callback
  currentPosition?: Point2D; // Current cursor position for callbacks
}

export interface UniversalSelectionResult {
  selectedIds: string[]; // Όλα τα επιλεγμένα IDs μαζί
  selectionType: 'window' | 'crossing';
  selectionBounds: { min: Point2D, max: Point2D };
  callbacksExecuted: number; // 🎯 ADD: Πόσα callbacks εκτελέστηκαν

  // Breakdown αν χρειάζεται (optional)
  breakdown?: {
    entityIds: string[];
    overlayIds: string[];
    layerIds: string[];
  };

  debugInfo?: {
    testedEntities: number;
    testedOverlays: number;
    testedLayers: number;
    totalTested: number;
    isCrossing: boolean;
  };
}
