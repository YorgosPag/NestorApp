import type { SceneModel } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

/**
 * Ιεραρχική συγχώνευση Color Groups
 * Μετακινεί όλα τα DXF layers (2ο επίπεδο) από τα source groups στο target group
 * χωρίς να χαθούν οντότητες, κρατώντας χρώμα+όνομα του target
 */
export function mergeColorGroups(scene: SceneModel, targetGroup: string, sourceGroups: string[]): SceneModel {
  if (!scene?.layersById || sourceGroups.length === 0) return scene;

  const parseGroupHex = (cg: string) => cg.replace(/^Color\s+/i, '').trim();
  const targetHex = parseGroupHex(targetGroup);
  const groupOfLayer = (layer: { color?: string }) => `Color ${layer?.color ?? DEFAULT_LAYER_COLOR}`;

  const layersById = { ...scene.layersById };
  Object.entries(layersById).forEach(([layerId, layerData]) => {
    if (sourceGroups.includes(groupOfLayer(layerData))) {
      layersById[layerId] = { ...layerData, color: targetHex };
    }
  });

  return { ...scene, layersById };
}

