/**
 * Selection Update Utilities
 * Shared utilities for updating selection when entities are deleted/modified
 */

/**
 * Update selection by removing affected entity IDs
 */
export function updateSelectionAfterDeletion(
  selectedEntityIds: string[],
  affectedEntityIds: string[],
  onEntitySelect: (newSelection: string[]) => void
): void {
  const newSelection = selectedEntityIds.filter(id => !affectedEntityIds.includes(id));
  if (newSelection.length !== selectedEntityIds.length) {
    onEntitySelect(newSelection);
  }
}

/**
 * Handle layer service result with scene update and selection cleanup
 */
export function handleLayerServiceResult(
  result: { success: boolean; updatedScene?: any; affectedEntityIds?: string[] },
  selectedEntityIds: string[],
  onEntitySelect: (newSelection: string[]) => void,
  setLevelScene: (levelId: string, scene: any) => void,
  currentLevelId: string
): void {
  if (result.success) {
    if (result.affectedEntityIds) {
      updateSelectionAfterDeletion(selectedEntityIds, result.affectedEntityIds, onEntitySelect);
    }
    if (result.updatedScene) {
      setLevelScene(currentLevelId, result.updatedScene);
    }
  }
}