import type { Layer, LayerFilter, LayerState } from '@/types/layers';
import { DEFAULT_LAYER_STYLES, SYSTEM_LAYER_COLORS, SYSTEM_LAYERS } from '@/types/layers';
import { nowISO } from '@/lib/date-local';

export interface SystemLayerContext {
  floorId: string;
  buildingId: string;
  userId: string;
  companyId: string;
}

interface SystemLayerDefinition {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  zIndex: number;
  colorKey: keyof typeof SYSTEM_LAYER_COLORS;
  defaultStyleKey: keyof typeof DEFAULT_LAYER_STYLES;
  metadataCategory?: NonNullable<Layer['metadata']>['category'];
}

const SYSTEM_LAYER_DEFINITIONS: readonly SystemLayerDefinition[] = [
  {
    id: SYSTEM_LAYERS.PROPERTIES,
    name: 'Ακίνητα',
    isVisible: true,
    isLocked: false,
    opacity: 1,
    zIndex: 100,
    colorKey: 'properties',
    defaultStyleKey: 'property',
    metadataCategory: 'structural'
  },
  {
    id: SYSTEM_LAYERS.GRID,
    name: 'Πλέγμα',
    isVisible: false,
    isLocked: true,
    opacity: 0.2,
    zIndex: 1,
    colorKey: 'grid',
    defaultStyleKey: 'line'
  }
] as const;

export const INITIAL_LAYER_FILTER: LayerFilter = {
  showVisible: true,
  showHidden: true,
  showLocked: true,
  showUnlocked: true,
  categories: [],
  searchTerm: ''
};

export function createInitialLayerState(maxHistorySize: number): LayerState {
  return {
    layers: [],
    groups: [],
    activeLayerId: null,
    selectedElementIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
    maxHistorySize
  };
}

export function createMissingSystemLayers(existingLayers: Layer[], context: SystemLayerContext): Layer[] {
  const now = nowISO();

  return SYSTEM_LAYER_DEFINITIONS
    .filter((definition) => !existingLayers.some((layer) => layer.id === definition.id))
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      isVisible: definition.isVisible,
      isLocked: definition.isLocked,
      isSystem: true,
      opacity: definition.opacity,
      zIndex: definition.zIndex,
      color: {
        primary: SYSTEM_LAYER_COLORS[definition.colorKey],
        opacity: definition.opacity
      },
      defaultStyle: DEFAULT_LAYER_STYLES[definition.defaultStyleKey],
      elements: [],
      floorId: context.floorId,
      buildingId: context.buildingId,
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
      metadata: definition.metadataCategory
        ? { category: definition.metadataCategory }
        : undefined
    }));
}
