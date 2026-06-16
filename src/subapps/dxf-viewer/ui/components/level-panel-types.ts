/**
 * LevelPanel — type definitions.
 * Extracted from `LevelPanel.tsx` for file-size compliance (<500 lines).
 * Behavior-preserving; consumed only by `LevelPanel.tsx`.
 *
 * @module ui/components/level-panel-types
 */

import type React from 'react';
import type { ToolType } from '../toolbar/types';
import type { SceneModel } from '../../types/scene';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';

export interface LevelPanelProps {
  currentTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  scene?: SceneModel | null;
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
  expandedKeys?: Set<string>;
  onExpandChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onLayerToggle?: (layerName: string, visible: boolean) => void;
  onLayerDelete?: (layerName: string) => void;
  onLayerColorChange?: (layerName: string, color: string) => void;
  onLayerRename?: (oldName: string, newName: string) => void;
  onLayerCreate?: (name: string, color: string) => void;
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  onColorGroupColorChange?: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  onEntitiesMerge?: (targetEntityId: string, sourceEntityIds: string[]) => void;
  onLayersMerge?: (targetLayerName: string, sourceLayerNames: string[]) => void;
  onColorGroupsMerge?: (targetColorGroup: string, sourceColorGroups: string[]) => void;
}

export type EditingMode = 'selection' | 'drawing' | 'editing' | 'status' | 'types' | null;
