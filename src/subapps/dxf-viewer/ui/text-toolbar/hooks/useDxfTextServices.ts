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
import { useCanEditText } from '../../../hooks/useCanEditText';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
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
      const layer = scene?.layers[name];
      if (!layer) return undefined;
      return { name: layer.name, locked: layer.locked, frozen: false };
    },
    canUnlockLayer,
  };
}

export function useDxfTextServices(): DxfTextServices | null {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const scene = useCurrentSceneModel();
  const caps = useCanEditText();

  return useMemo(() => {
    if (!currentLevelId) return null;
    const sceneManager = new LevelSceneManagerAdapter(
      getLevelScene,
      setLevelScene,
      currentLevelId,
    );
    const layerProvider = makeLayerProvider(scene, caps.canUnlockLayer);
    const auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder;
    return { sceneManager, layerProvider, auditRecorder };
  }, [currentLevelId, getLevelScene, setLevelScene, scene, caps.canUnlockLayer]);
}
