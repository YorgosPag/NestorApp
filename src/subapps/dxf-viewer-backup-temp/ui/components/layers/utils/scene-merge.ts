import type { SceneModel } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

/**
 * Ιεραρχική συγχώνευση Color Groups
 * Μετακινεί όλα τα DXF layers (2ο επίπεδο) από τα source groups στο target group
 * χωρίς να χαθούν οντότητες, κρατώντας χρώμα+όνομα του target
 */
export function mergeColorGroups(scene: SceneModel, targetGroup: string, sourceGroups: string[]): SceneModel {
  if (!scene?.layers || sourceGroups.length === 0) return scene;

  // Helper για parsing του color group name → hex color
  const parseGroupHex = (cg: string) => cg.replace(/^Color\s+/i, '').trim(); // "Color #ffc93c" -> "#ffc93c"
  const targetHex = parseGroupHex(targetGroup);

  // Helper για να βρούμε το Color Group ενός layer
  const groupOfLayer = (layer: { color?: string }) => `Color ${layer?.color ?? DEFAULT_LAYER_COLOR}`;
  
  // Κλωνοποίηση των layers για immutable update
  const layers = { ...scene.layers };

  // Μετακινούμε ΟΛΑ τα layers των source groups στο target group
  // αλλάζοντας το color τους στο target color
  Object.entries(layers).forEach(([layerName, layerData]) => {
    const currentGroup = groupOfLayer(layerData);
    if (sourceGroups.includes(currentGroup)) {

      layers[layerName] = { ...layerData, color: targetHex };
    }
  });

  // Τα entities δεν χρειάζονται αλλαγή αν είναι "ByLayer"
  // Το χρώμα τους θα ακολουθήσει αυτόματα το layer color
  
  const newScene: SceneModel = { ...scene, layers };

  return newScene;
}

