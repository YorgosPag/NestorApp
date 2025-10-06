/**
 * UNIFIED ENTITY STYLES HOOK - COMPATIBILITY WRAPPER
 *
 * 🔄 MIGRATION NOTE (2025-10-06):
 * This file is now a WRAPPER around DxfSettingsProvider hooks.
 * ConfigurationProvider has been MERGED into DxfSettingsProvider.
 *
 * All functionality now comes from:
 * - useLineStyles() from DxfSettingsProvider
 * - useTextStyles() from DxfSettingsProvider
 * - useGripStyles() from DxfSettingsProvider
 *
 * This wrapper exists for BACKWARD COMPATIBILITY ONLY.
 * New code should use the DxfSettingsProvider hooks directly.
 */

import { useLineStyles, useTextStyles, useGripStyles, type ViewerMode } from '../providers/DxfSettingsProvider';
import type {
  EntityType,
  EntityStylesHookResult
} from '../types/viewerConfiguration';
import type { LineSettings } from '../types/lineSettings';
import type { TextSettings } from '../types/textSettings';
import type { GripSettings } from '../types/gripSettings';

// ===== TYPE MAPPING =====

type EntitySettingsMap = {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
};

// ===== MAIN HOOK (WRAPPER) =====

/**
 * 🔄 COMPATIBILITY WRAPPER
 * Delegates to DxfSettingsProvider hooks based on entity type
 *
 * @deprecated Use useLineStyles(), useTextStyles(), or useGripStyles() directly
 */
export function useEntityStyles<T extends EntityType>(
  entityType: T,
  mode?: ViewerMode,
  userOverrides?: Partial<EntitySettingsMap[T]>
): EntityStylesHookResult<EntitySettingsMap[T]> {

  // Delegate to the appropriate hook from DxfSettingsProvider
  if (entityType === 'line') {
    return useLineStyles(mode) as EntityStylesHookResult<EntitySettingsMap[T]>;
  } else if (entityType === 'text') {
    return useTextStyles(mode) as EntityStylesHookResult<EntitySettingsMap[T]>;
  } else if (entityType === 'grip') {
    return useGripStyles(mode) as EntityStylesHookResult<EntitySettingsMap[T]>;
  }

  // Fallback (should never happen)
  throw new Error(`useEntityStyles: Unknown entity type "${entityType}"`);
}

// ===== RE-EXPORT TYPES =====
export type { ViewerMode, EntityType, EntityStylesHookResult };
