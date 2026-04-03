import type { DocumentData } from 'firebase/firestore';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore';
import type { Layer, LayerGroup } from '@/types/layers';
import { saveLayerManagementWithPolicy } from '@/services/layer/layer-management-mutation-gateway';
import { createMissingSystemLayers, type SystemLayerContext } from './layer-management-defaults';

export interface LoadedLayerManagementData {
  layers: Layer[];
  groups: LayerGroup[];
}

export async function loadLayerManagementData(context: SystemLayerContext): Promise<LoadedLayerManagementData> {
  const layersQuery = query(
    collection(db, COLLECTIONS.LAYERS),
    where('floorId', '==', context.floorId),
    orderBy('zIndex', 'asc')
  );

  const groupsQuery = query(
    collection(db, COLLECTIONS.LAYER_GROUPS),
    where('floorId', '==', context.floorId),
    orderBy('order', 'asc')
  );

  const [layersSnapshot, groupsSnapshot] = await Promise.all([
    getDocs(layersQuery),
    getDocs(groupsQuery)
  ]);

  const loadedLayers: Layer[] = layersSnapshot.docs.map((layerDoc) => ({
    id: layerDoc.id,
    ...layerDoc.data()
  } as Layer));

  const groups: LayerGroup[] = groupsSnapshot.docs.map((groupDoc) => ({
    id: groupDoc.id,
    ...groupDoc.data()
  } as LayerGroup));

  const systemLayers = createMissingSystemLayers(loadedLayers, context);

  return {
    layers: [...systemLayers, ...loadedLayers.filter((layer) => !layer.isSystem)],
    groups
  };
}

export async function saveLayerManagementData(layers: Layer[], groups: LayerGroup[]): Promise<void> {
  await saveLayerManagementWithPolicy(layers, groups);
}

export function subscribeToLayerManagement(
  context: SystemLayerContext,
  handlers: {
    onLayers: (layers: Layer[]) => void;
    onError: (message: string) => void;
  }
): () => void {
  return firestoreQueryService.subscribe<DocumentData>(
    'LAYERS',
    (result) => {
      const loadedLayers: Layer[] = result.documents.map((document) => ({
        ...document,
      } as unknown as Layer));

      const systemLayers = createMissingSystemLayers(loadedLayers, context);
      handlers.onLayers([...systemLayers, ...loadedLayers.filter((layer) => !layer.isSystem)]);
    },
    (error) => {
      handlers.onError(error.message);
    },
    {
      constraints: [where('floorId', '==', context.floorId)]
    }
  );
}
