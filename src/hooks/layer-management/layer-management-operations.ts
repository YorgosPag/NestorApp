import { generateElementId, generateLayerId } from '@/services/enterprise-id.service';
import type { AnyLayerElement, Layer } from '@/types/layers';
import { nowISO } from '@/lib/date-local';

export function createLayerRecord(
  layerData: Omit<Layer, 'id' | 'createdAt' | 'updatedAt' | 'floorId' | 'buildingId' | 'createdBy'>,
  context: { floorId: string; buildingId: string; userId: string }
): Layer {
  const now = nowISO();

  return {
    ...layerData,
    id: generateLayerId(),
    createdAt: now,
    updatedAt: now,
    floorId: context.floorId,
    buildingId: context.buildingId,
    createdBy: context.userId
  };
}

export function updateLayerRecord(layer: Layer, updates: Partial<Layer>): Layer {
  return {
    ...layer,
    ...updates,
    updatedAt: nowISO()
  };
}

export function createElementRecord(
  elementData: Omit<AnyLayerElement, 'id' | 'createdAt' | 'updatedAt'>
): AnyLayerElement {
  const now = nowISO();

  return {
    ...elementData,
    id: generateElementId(),
    createdAt: now,
    updatedAt: now
  } as AnyLayerElement;
}

export function duplicateLayerRecord(layer: Layer): Omit<Layer, 'id' | 'createdAt' | 'updatedAt' | 'floorId' | 'buildingId' | 'createdBy'> {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    floorId: _floorId,
    buildingId: _buildingId,
    createdBy: _createdBy,
    ...rest
  } = layer;

  return {
    ...rest,
    name: `${layer.name} (Αντίγραφο)`,
    elements: layer.elements.map((element) => ({
      ...element,
      id: generateElementId()
    }))
  };
}
