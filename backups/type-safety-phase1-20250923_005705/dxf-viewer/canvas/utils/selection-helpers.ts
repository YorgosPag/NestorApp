import type { Point2D as Point } from '../../types/scene';
import type { SceneModel } from '../../types/scene';
import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
import { publishHighlight } from '../../events/selection-bus';

interface CommitSelectionProps {
  onSelectEntity?: (ids: string[]) => void;
  rendererRef: React.RefObject<any>;
  scene?: SceneModel | null;
}

/**
 * Single source of truth για επιλογές
 */
export function createCommitSelection({ 
  onSelectEntity, 
  rendererRef, 
  scene 
}: CommitSelectionProps) {
  return (ids: string[]) => {
    // ενημέρωσε τον parent (αυτό ανοίγει το Properties μέσω του effect)
    onSelectEntity?.(ids);
    // και κράτα το bus για τα υπόλοιπα subsystems (renderer κ.λπ.)
    publishHighlight({ mode: 'select', ids });
    rendererRef.current?.renderSceneImmediate?.(scene);
  };
}

interface FindEntityAtPointProps {
  point: Point;
  scene?: SceneModel | null;
  rendererRef: React.RefObject<any>;
  tolerance?: number;
}

/**
 * Helper function for finding entity at point using UnifiedEntitySelection
 */
import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';

export function findEntityAtPoint({ 
  point, 
  scene, 
  rendererRef, 
  tolerance = DEFAULT_TOLERANCE 
}: FindEntityAtPointProps) {
  if (!scene || !rendererRef.current) return null;

  const canvas = rendererRef.current.getCanvas();
  const rect = canvas?.getBoundingClientRect();
  const transform = rendererRef.current.getTransform();
  
  if (!rect || !transform) return null;
  
  return UnifiedEntitySelection.findEntityAtPoint(
    point,
    scene.entities,
    scene.layers,
    transform,
    rect,
    tolerance
  );
}

interface AdditiveSelectionProps {
  currentSelectedIds: string[];
  entityId: string;
  isAdditive?: boolean;
}

/**
 * Helper for handling additive selection logic
 */
export function processAdditiveSelection({ 
  currentSelectedIds, 
  entityId, 
  isAdditive = false 
}: AdditiveSelectionProps): string[] {
  if (!isAdditive) {
    return [entityId]; // Single selection
  }

  const set = new Set(currentSelectedIds);
  if (set.has(entityId)) {
    set.delete(entityId); // Toggle off
  } else {
    set.add(entityId); // Toggle on
  }
  
  return Array.from(set);
}

/**
 * Helper to check if event has additive modifiers
 */
export function isAdditiveEvent(event?: React.MouseEvent): boolean {
  return !!(event && (event.ctrlKey || event.metaKey || event.shiftKey));
}

/**
 * Helper to get screen point from mouse event
 */
export function getScreenPointFromEvent(event: React.MouseEvent<HTMLCanvasElement>): Point {
  const r = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}