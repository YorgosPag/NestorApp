/**
 * @file Enterprise Settings Provider - Barrel Export
 * @module settings-provider
 *
 * ✅ ENTERPRISE: Clean public API
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

// Main provider
export {
  EnterpriseDxfSettingsProvider,
  useEnterpriseDxfSettings,
  useEnterpriseDxfSettingsOptional,
  useEnterpriseLineSettings,
  useEnterpriseTextSettings,
  useEnterpriseGripSettings,
  useDxfSettings,
  // Backward compatible hooks
  useLineSettingsFromProvider,
  useTextSettingsFromProvider,
  useGripSettingsFromProvider,
  useLineStyles,
  useTextStyles,
  useGripStyles
} from './EnterpriseDxfSettingsProvider';

// Types
export type {
  ViewerMode,
  StorageMode,
  LineSettings,
  TextSettings,
  GripSettings
} from './EnterpriseDxfSettingsProvider';

// Constants
export { ENTERPRISE_CONSTANTS } from './constants';

// Global stores (backward compatibility)
export { globalGridStore, globalRulerStore } from './globalStores';

// ✅ ENTERPRISE: Specific settings hooks re-export (backward compatibility)
export { useLineDraftSettings } from '../hooks/useLineDraftSettings';
export { useLineHoverSettings } from '../hooks/useLineHoverSettings';
export { useLineSelectionSettings } from '../hooks/useLineSelectionSettings';
export { useLineCompletionSettings } from '../hooks/useLineCompletionSettings';
export { useTextDraftSettings } from '../hooks/useTextDraftSettings';
export { useGripDraftSettings } from '../hooks/useGripDraftSettings';

// Note: Internal hooks/storage modules are NOT exported (implementation details)
