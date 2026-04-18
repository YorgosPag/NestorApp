import { firestoreQueryService } from '@/services/firestore';
import type { Layer, LayerGroup } from '@/types/layers';
import { nowISO } from '@/lib/date-local';

interface PersistedLayerUpdate {
  id: string;
  payload: Omit<Layer, 'id'> & { updatedAt: string };
}

interface PersistedLayerGroupUpdate {
  id: string;
  payload: Omit<LayerGroup, 'id'>;
}

function toLayerUpdate(layer: Layer): PersistedLayerUpdate {
  const { id, ...rest } = layer;

  return {
    id,
    payload: {
      ...rest,
      updatedAt: nowISO(),
    },
  };
}

function toLayerGroupUpdate(group: LayerGroup): PersistedLayerGroupUpdate {
  const { id, ...rest } = group;

  return {
    id,
    payload: rest,
  };
}

export async function saveLayerManagementWithPolicy(
  layers: Layer[],
  groups: LayerGroup[],
): Promise<void> {
  const nonSystemLayerUpdates = layers
    .filter((layer) => !layer.isSystem)
    .map(toLayerUpdate);

  const groupUpdates = groups.map(toLayerGroupUpdate);

  await Promise.all([
    ...nonSystemLayerUpdates.map(({ id, payload }) =>
      firestoreQueryService.update('LAYERS', id, payload),
    ),
    ...groupUpdates.map(({ id, payload }) =>
      firestoreQueryService.update('LAYER_GROUPS', id, payload, { touchUpdatedAt: false }),
    ),
  ]);
}
