/**
 * ColorManager Component
 * Handles color menu popover and color application to entities
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import React from 'react';
import { ColorPickerModal } from './layers/components/ColorPickerModal';
import type { SceneModel } from '../../types/scene';

interface ColorMenuState {
  open: boolean;
  x: number;
  y: number;
  ids: string[];
}

interface ColorManagerProps {
  colorMenu: ColorMenuState;
  currentScene: SceneModel | null;
  onSceneChange: (scene: SceneModel) => void;
  onColorMenuClose: () => void;
  onExpandForSelection?: (ids: string[], scene: SceneModel) => void;
}

export const ColorManager: React.FC<ColorManagerProps> = ({
  colorMenu,
  currentScene,
  onSceneChange,
  onColorMenuClose,
  onExpandForSelection
}) => {
  // ΒΟΗΘΗΤΙΚΟ: βρίσκει/δημιουργεί layer για το συγκεκριμένο χρώμα
  const ensureLayerForColor = React.useCallback((scene: SceneModel, hex: string): { scene: SceneModel, layerName: string } => {
    // 1) αν ήδη υπάρχει layer με αυτό το χρώμα, χρησιμοποίησέ το
    const existing = Object.entries(scene.layers).find(
      ([name, l]) => (('colorHex' in l && typeof l.colorHex === 'string' && l.colorHex.toLowerCase?.() === hex.toLowerCase?.()) ||
                      ('color' in l && typeof l.color === 'string' && l.color.toLowerCase?.() === hex.toLowerCase?.()))
    );
    if (existing) return { scene, layerName: existing[0] };

    // 2) αλλιώς, φτιάξε καινούριο
    const newName = `COLOR_${hex.replace('#','').toUpperCase()}`;
    const newLayers = {
      ...scene.layers,
      [newName]: { name: newName, color: hex, colorHex: hex, visible: true }
    };
    return { scene: { ...scene, layers: newLayers }, layerName: newName };
  }, []);

  // ΚΥΡΙΟ: εφάρμοσε χρώμα σε ΟΛΕΣ τις επιλεγμένες οντότητες + ενημέρωσε scene/panels
  const applyColorToEntities = React.useCallback((hex: string, ids: string[]) => {
    if (!currentScene || !ids?.length) return;

    // 1) layer για το χρώμα
    const idSet = new Set(ids);
    // εντοπισμός/δημιουργία layer για το hex
    const { scene: sceneA, layerName } = ensureLayerForColor(currentScene, hex);

    // 2) μεταφορά των οντοτήτων στο νέο layer + ενημέρωση color
    const newEntities = sceneA.entities.map(e =>
      idSet.has(e.id) ? { ...e, layer: layerName, color: hex } : e
    );

    const updated = { ...sceneA, entities: newEntities };

    // 3) ΈΝΑ commit + ΈΝΑ render
    onSceneChange(updated);                               // state update

    // 4) Άνοιγμα/expand στα properties για τη νέα ομάδα (προαιρετικό)
    if (onExpandForSelection) {
      onExpandForSelection(ids, updated);
    }

    onColorMenuClose();
  }, [currentScene, ensureLayerForColor, onSceneChange, onExpandForSelection, onColorMenuClose]);

  if (!colorMenu.open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: colorMenu.x,
        top: colorMenu.y,
        zIndex: 9999
      }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} // μη αφήσεις click να "τρυπήσει" στον καμβά
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }} // μην «ξαναανοίξει» το browser menu
    >
      <ColorPickerModal
        title="🎨 Επιλογή Χρώματος για Επιλεγμένες Οντότητες"
        onColorSelect={(hex) => applyColorToEntities(hex, colorMenu.ids)}
        onClose={onColorMenuClose}
      />
    </div>
  );
};