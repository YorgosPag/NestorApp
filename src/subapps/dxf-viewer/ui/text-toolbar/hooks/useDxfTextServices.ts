'use client';

/**
 * ADR-344 Phase 6.E — DXF text command service factory.
 *
 * Builds the three injection dependencies that every text command
 * (UpdateTextStyleCommand, UpdateTextGeometryCommand,
 * UpdateMTextParagraphCommand, …) needs:
 *
 *   - `sceneManager`   — ISceneManager via LevelSceneManagerAdapter,
 *                        scoped to the currently active level
 *   - `layerProvider`  — ILayerAccessProvider that reads SceneLayer
 *                        flags from the live scene and pulls
 *                        `canUnlockLayer` from useCanEditText (Q8)
 *   - `auditRecorder`  — noopAuditRecorder for now; replaced with
 *                        the Firestore POST recorder once Phase 7
 *                        persists DXF text entities (Q12)
 *
 * Returns `null` when no level is active — callers must short-circuit
 * before dispatching a command.
 *
 * AutoCAD parity: equivalent to AutoCAD's command-context object
 * (acedSSAdd/acdbObjectId pair) that every cmd handler receives.
 */

import { useMemo } from 'react';
import { useLevels } from '../../../systems/levels';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import { useCanEditText } from '../../../hooks/useCanEditText';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import { LevelSceneManagerAdapter, createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  noopAuditRecorder,
  type ILayerAccessProvider,
  type LayerSnapshot,
  type IDxfTextAuditRecorder,
} from '../../../core/commands/text/types';
import type { SceneModel } from '../../../types/scene';
import type { ISceneManager } from '../../../core/commands';

export interface DxfTextServices {
  readonly sceneManager: ISceneManager;
  readonly layerProvider: ILayerAccessProvider;
  readonly auditRecorder: IDxfTextAuditRecorder;
}

function makeLayerProvider(
  scene: SceneModel | null,
  canUnlockLayer: boolean,
): ILayerAccessProvider {
  return {
    getLayer(name: string): LayerSnapshot | undefined {
      const layer = Object.values(scene?.layersById ?? {}).find((l) => l.name === name);
      if (!layer) return undefined;
      return { name: layer.name, locked: layer.locked, frozen: false };
    },
    canUnlockLayer,
  };
}

/**
 * Η συναρμολόγηση των services για **ρητά δηλωμένο** level.
 *
 * ADR-344 Φ-3D — εξάχθηκε από το hook παρακάτω επειδή το 3D χρειάζεται τα ΙΔΙΑ services
 * αλλά για level που **δεν είναι απαραίτητα το ενεργό**: με «Όλοι οι όροφοι»
 * (`floor3DScope: 'all'`, ADR-537 δ) βλέπεις — και άρα μπορείς να διορθώσεις — κείμενο
 * άλλου ορόφου. Καρφώνοντας το `currentLevelId`, το commit θα έγραφε στον ΕΝΕΡΓΟ όροφο:
 * σιωπηλή καταστροφή δεδομένων, όχι σφάλμα. Ο 3D καταναλωτής περνά εδώ το level που
 * επιστρέφει το `resolveEntityLevelId`.
 *
 * Καθαρή: μηδέν hooks — καλέσιμη μέσα σε event handler (ADR-040 event-time read).
 */
export function buildDxfTextServices(params: {
  readonly levelId: string | null;
  readonly getLevelScene: LevelsHookReturn['getLevelScene'];
  readonly setLevelScene: LevelsHookReturn['setLevelScene'];
  readonly scene: SceneModel | null;
  readonly canUnlockLayer: boolean;
}): DxfTextServices | null {
  const { levelId, getLevelScene, setLevelScene, scene, canUnlockLayer } = params;
  if (!levelId) return null;
  const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
  const layerProvider = makeLayerProvider(scene, canUnlockLayer);
  const auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder;
  return { sceneManager, layerProvider, auditRecorder };
}

export function useDxfTextServices(): DxfTextServices | null {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const scene = useCurrentSceneModel();
  const caps = useCanEditText();

  return useMemo(
    () => buildDxfTextServices({
      levelId: currentLevelId,
      getLevelScene,
      setLevelScene,
      scene,
      canUnlockLayer: caps.canUnlockLayer,
    }),
    [currentLevelId, getLevelScene, setLevelScene, scene, caps.canUnlockLayer],
  );
}
