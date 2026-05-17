/**
 * ColorManager Component
 * Handles color menu popover and color application to entities
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import React from 'react';
import { ColorPickerModal } from './layers/components/ColorPickerModal';
import type { SceneModel } from '../../types/scene';
import { getLayer } from '../../stores/LayerStore';
// ADR-358 Phase 9D-5a: factory enforces SceneLayer shape (14 fields) + enterprise-id `lyr_<UUID-v4>`.
import { createSceneLayer } from '../../types/entities';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation(['dxf-viewer-panels']);
  // ΒΟΗΘΗΤΙΚΟ: βρίσκει/δημιουργεί layer για το συγκεκριμένο χρώμα
  const ensureLayerForColor = React.useCallback((scene: SceneModel, hex: string): { scene: SceneModel, layerName: string } => {
    // 1) αν ήδη υπάρχει layer με αυτό το χρώμα, χρησιμοποίησέ το
    const existing = Object.values(scene.layersById ?? scene.layers).find(
      (l) => (('colorHex' in l && typeof l.colorHex === 'string' && l.colorHex.toLowerCase?.() === hex.toLowerCase?.()) ||
              ('color' in l && typeof l.color === 'string' && l.color.toLowerCase?.() === hex.toLowerCase?.()))
    );
    if (existing) return { scene, layerName: existing.name };

    // 2) αλλιώς, φτιάξε καινούριο
    // ADR-358 Phase 9D-5a + Phase 9C: createSceneLayer factory enforces 14-field shape +
    // auto-gens stable `lyr_<UUID-v4>` id via enterprise-id (was inline literal bypassing id contract).
    const newName = `COLOR_${hex.replace('#','').toUpperCase()}`;
    const newLayers = {
      ...scene.layers,
      [newName]: createSceneLayer({ name: newName, color: hex, visible: true, locked: false })
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
    // ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
    const targetLayerId = sceneA.layers[layerName]?.id ?? getLayer(layerName)?.id;
    const newEntities = sceneA.entities.map(e =>
      idSet.has(e.id)
        ? { ...e, layerId: targetLayerId ?? e.layerId, color: hex }
        : e
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
      style={canvasUI.positioning.statusBarOverlays.colorManagerContainer(colorMenu.x, colorMenu.y)}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} // μη αφήσεις click να "τρυπήσει" στον καμβά
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }} // μην «ξαναανοίξει» το browser menu
    >
      <ColorPickerModal
        title={t('dxf-viewer-panels:colorPicker.title')}
        onColorSelect={(hex) => applyColorToEntities(hex, colorMenu.ids)}
        onClose={onColorMenuClose}
      />
    </div>
  );
};
