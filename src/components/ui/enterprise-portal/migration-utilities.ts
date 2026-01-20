/**
 * ENTERPRISE PORTAL MIGRATION UTILITIES
 * Helper functions για migration από existing hardcoded portal patterns
 *
 * ✅ ENTERPRISE REFACTORED: Migration helpers για existing components
 * ✅ Backward compatibility utilities
 * ✅ Type-safe configuration builders
 *
 * @module components/ui/enterprise-portal/migration-utilities
 */

import { portalComponents, photoPreviewComponents, zIndex } from '../../../styles/design-tokens';
import type {
  PortalVariant,
  PortalPlacement,
  DropdownPosition,
  EnterprisePortalConfig
} from './EnterprisePortalSystem';

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate existing hardcoded dropdown position objects
 * FROM: { top: number, left: number, width: number, zIndex: number }
 * TO: Enterprise portal config
 */
export const migrateDropdownPosition = (
  legacyPosition: {
    top: number;
    left: number;
    width?: number;
    height?: number;
    zIndex?: number;
  },
  variant: PortalVariant = 'dropdown'
): DropdownPosition => {
  return {
    top: legacyPosition.top,
    left: legacyPosition.left,
    width: legacyPosition.width,
    height: legacyPosition.height
  };
};

/**
 * Create portal config για common use cases
 */
export const createPortalConfig = {
  // Relationship/Contact dropdown (CustomRelationshipSelect pattern)
  relationship: (triggerElement: Element | null): EnterprisePortalConfig => ({
    variant: 'relationship',
    placement: 'bottom-start',
    triggerElement,
    closeOnClickOutside: true,
    closeOnEscape: true,
    animate: true
  }),

  // Employee/Contact selector (EmployeeSelector pattern)
  selector: (triggerElement: Element | null): EnterprisePortalConfig => ({
    variant: 'selector',
    placement: 'bottom-start',
    triggerElement,
    closeOnClickOutside: true,
    closeOnEscape: true,
    animate: true
  }),

  // Generic dropdown με custom position
  positioned: (customPosition: DropdownPosition): EnterprisePortalConfig => ({
    variant: 'dropdown',
    customPosition,
    closeOnClickOutside: true,
    closeOnEscape: true,
    animate: false // Positioned dropdowns usually don't need animation
  })
};

/**
 * Get appropriate z-index για component types
 * Replaces hardcoded z-index values (9999, 2147483647, etc.)
 */
export const getZIndexForComponent = (componentType: string): number => {
  switch (componentType.toLowerCase()) {
    case 'tooltip':
      return portalComponents.zIndex.tooltip;
    case 'dropdown':
    case 'select':
    case 'combobox':
      return portalComponents.zIndex.dropdown;
    case 'modal':
    case 'dialog':
      return portalComponents.zIndex.modal;
    case 'notification':
    case 'toast':
      return zIndex.toast; // 🏢 ENTERPRISE: Use centralized zIndex.toast (1700)
    case 'overlay':
    case 'backdrop':
      return portalComponents.zIndex.overlay;
    case 'critical':
    case 'emergency':
      return portalComponents.zIndex.critical;
    case 'maximum':
    case 'topmost':
      return zIndex.critical; // 🏢 ENTERPRISE: Use centralized zIndex.critical as maximum
    default:
      return portalComponents.zIndex.dropdown; // Safe default
  }
};

/**
 * Create dynamic height configuration για CRM/Inbox components
 * Replaces inline style={{ height }} patterns
 */
export const createDynamicHeightConfig = (height: string | number) => ({
  containerStyle: {
    // 🏢 ENTERPRISE: Use positioned as base style (dynamic was removed)
    ...portalComponents.dropdown.positioned,
    height: typeof height === 'number' ? `${height}px` : height
  }
});

// ============================================================================
// PHOTO PREVIEW MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate hardcoded photo colors to centralized system
 * FOR: PhotoPreviewCard.tsx migration
 */
export const migratePhotoColors = (hasPhoto: boolean, uploadState?: 'uploading' | 'error') => {
  if (uploadState === 'uploading') {
    return {
      backgroundColor: photoPreviewComponents.colors.uploadingBackground,
      borderColor: photoPreviewComponents.colors.emptyStateBorder
    };
  }

  if (uploadState === 'error') {
    return {
      backgroundColor: photoPreviewComponents.colors.errorBackground,
      borderColor: photoPreviewComponents.colors.emptyStateBorder
    };
  }

  return {
    backgroundColor: hasPhoto ? undefined : photoPreviewComponents.colors.emptyStateBackground,
    borderColor: hasPhoto
      ? photoPreviewComponents.colors.withPhotoBorder
      : photoPreviewComponents.colors.emptyStateBorder
  };
};

// ============================================================================
// LEGACY COMPATIBILITY HELPERS
// ============================================================================

/**
 * Backward compatibility για existing buttonRect/dropdownPosition patterns
 */
export const createLegacyPositionCompat = {
  /**
   * Convert buttonRect (DOMRect) to portal position
   * FOR: EnterpriseContactDropdown migration
   */
  fromButtonRect: (buttonRect: DOMRect, offset = 8): DropdownPosition => ({
    top: buttonRect.bottom + offset,
    left: buttonRect.left,
    width: buttonRect.width
  }),

  /**
   * Convert dropdownPosition object to portal config
   * FOR: CustomRelationshipSelect migration
   */
  fromDropdownPosition: (dropdownPosition: {
    top: number;
    left: number;
    width: number;
    height?: number;
  }): DropdownPosition => ({
    top: dropdownPosition.top,
    left: dropdownPosition.left,
    width: dropdownPosition.width,
    height: dropdownPosition.height
  })
};

// ============================================================================
// PORTAL OVERLAY UTILITIES
// ============================================================================

/**
 * Create full-screen overlay configs (για modal backdrops)
 * Replaces hardcoded full-screen positioning
 */
export const createFullScreenOverlay = () => ({
  style: portalComponents.overlay.fullscreen,
  'aria-hidden': true,
  role: 'presentation'
});

/**
 * Create backdrop overlay με interaction
 */
export const createBackdropOverlay = (onClick?: () => void) => ({
  style: portalComponents.overlay.backdrop,
  onClick,
  role: 'button',
  'aria-label': 'Close dialog',
  tabIndex: -1
});

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate portal configuration for common issues
 */
export const validatePortalConfig = (config: EnterprisePortalConfig): string[] => {
  const issues: string[] = [];

  if (!config.variant) {
    issues.push('Portal variant is required');
  }

  if (!config.triggerElement && !config.customPosition) {
    issues.push('Either triggerElement or customPosition must be provided');
  }

  if (config.variant === 'modal' && !config.closeOnEscape) {
    issues.push('Modal portals should have closeOnEscape enabled for accessibility');
  }

  return issues;
};

/**
 * Debug portal positioning for development
 */
export const debugPortalPosition = (
  config: EnterprisePortalConfig,
  calculatedPosition?: DropdownPosition
) => {
  if (process.env.NODE_ENV !== 'development') return;

  console.group('🔍 Portal Debug Info');
  console.log('Config:', config);
  console.log('Calculated Position:', calculatedPosition);

  if (config.triggerElement) {
    const rect = config.triggerElement.getBoundingClientRect();
    console.log('Trigger Element Rect:', rect);
  }

  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  console.log('Viewport:', viewport);
  console.groupEnd();
};

/**
 * ✅ MIGRATION UTILITIES COMPLETE
 *
 * Features:
 * 1. ✅ Migration helpers για existing hardcoded patterns
 * 2. ✅ Backward compatibility utilities for smooth transition
 * 3. ✅ Type-safe configuration builders
 * 4. ✅ Z-index management utilities
 * 5. ✅ Photo preview migration support
 * 6. ✅ Legacy pattern compatibility
 * 7. ✅ Validation & debugging utilities
 * 8. ✅ Full-screen overlay helpers
 *
 * Result: Smooth migration path από existing patterns στο unified system
 * Standards: Zero breaking changes, enterprise-grade migration support
 */