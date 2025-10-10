/**
 * useEntityStyles - Legacy Compatibility Wrapper
 *
 * @deprecated
 * ⚠️ LEGACY HOOK - Use unified hooks instead:
 * - `useLineStyles(mode)` - For line entities
 * - `useTextStyles(mode)` - For text entities
 * - `useGripStyles(mode)` - For grip entities
 *
 * @description
 * Compatibility wrapper around DxfSettingsProvider hooks.
 * ConfigurationProvider has been MERGED into DxfSettingsProvider (2025-10-06).
 *
 * @migration_history
 * - **Before**: ConfigurationProvider (mode-based, NO persistence)
 * - **After**: DxfSettingsProvider (mode-based + auto-save + localStorage)
 * - **This file**: Backward compatibility wrapper ONLY
 *
 * @architecture
 * ```
 * useEntityStyles('line', 'preview') [LEGACY]
 *   ↓
 * useLineStyles('preview') [DxfSettingsProvider]
 *   ↓
 * Effective Settings (General → Specific → Overrides)
 * ```
 *
 * @usage_legacy
 * ```tsx
 * // ❌ OLD (still works, but deprecated)
 * const { settings } = useEntityStyles('line', 'preview');
 * ```
 *
 * @usage_new
 * ```tsx
 * // ✅ NEW (recommended)
 * const { settings } = useLineStyles('preview');
 * ```
 *
 * @see {@link docs/settings-system/04-HOOKS_REFERENCE.md#legacy-hooks} - Legacy hooks section
 * @see {@link docs/settings-system/10-MIGRATION_GUIDE.md} - Migration guide
 * @see {@link providers/DxfSettingsProvider.tsx} - New unified provider
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06 (Migration completed)
 * @version 1.0.0 (Compatibility wrapper)
 */

import { useLineStyles, useTextStyles, useGripStyles, type ViewerMode } from '../settings-provider';
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
