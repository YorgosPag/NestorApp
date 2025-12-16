/**
 * ENTERPRISE PORTAL SYSTEM EXPORTS
 * Centralized exports για unified portal management
 *
 * @module components/ui/enterprise-portal
 */

// Main Portal System
export {
  EnterprisePortal,
  useEnterprisePortal,
  useSmartPortalPositioning,
  usePhotoPreviewStyles
} from './EnterprisePortalSystem';

// Utilities & Migration Helpers
export {
  migrateDropdownPosition,
  createPortalConfig,
  getZIndexForComponent,
  createDynamicHeightConfig
} from './migration-utilities';

// Types
export type {
  PortalVariant,
  PortalPlacement,
  DropdownPosition,
  EnterprisePortalConfig,
  EnterprisePortalProps
} from './EnterprisePortalSystem';