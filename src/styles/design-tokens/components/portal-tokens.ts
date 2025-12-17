/**
 * 🏢 PORTAL COMPONENTS - ENTERPRISE DESIGN TOKENS
 *
 * @description Portal και photo preview components για enterprise applications
 * Centralized styling για dropdowns, modals, overlays και photo containers
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 1.0.0 - Initial Portal Token System
 */

// Import base tokens directly to avoid circular dependency
const borderRadius = {
  none: '0',
  sm: '0.125rem',    // 2px
  default: '0.25rem', // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  full: '9999px',
} as const;

const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
} as const;

// ============================================================================
// PORTAL COMPONENTS - DROPDOWN & OVERLAY MANAGEMENT
// ============================================================================

export const portalComponents = {
  // Z-Index Hierarchy (Enterprise Standard)
  zIndex: {
    tooltip: 1000,
    dropdown: 1100,
    modal: 1200,
    notification: 1300,
    overlay: 1400,
    critical: 2000,
    maximum: 2147483647 // Max safe integer για critical components
  },

  // Portal Overlays
  overlay: {
    // Full-screen overlay για modal/dropdown backdrops
    fullscreen: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none' as const,
      zIndex: 1400
    },

    // Backdrop overlay με interaction
    backdrop: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      pointerEvents: 'auto' as const,
      zIndex: 1300
    }
  },

  // Dropdown Containers
  dropdown: {
    // Base positioned dropdown
    positioned: {
      position: 'fixed' as const,
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: borderRadius.lg,
      boxShadow: shadows.lg,
      zIndex: 1100,
      pointerEvents: 'auto' as const,
      overflow: 'hidden' as const
    },

    // Contact/Relationship dropdowns
    relationship: {
      position: 'fixed' as const,
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: borderRadius.lg,
      boxShadow: shadows.xl,
      zIndex: 1100,
      pointerEvents: 'auto' as const,
      minHeight: '150px',
      maxHeight: '300px',
      overflow: 'hidden' as const
    },

    // Employee/Contact selector dropdowns
    selector: {
      position: 'fixed' as const,
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: borderRadius.md,
      boxShadow: shadows.lg,
      zIndex: 1100,
      minWidth: '200px',
      maxHeight: '400px',
      overflow: 'hidden' as const
    },

    // CRM/Inbox dynamic containers
    dynamic: {
      position: 'relative' as const,
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: borderRadius.md,
      overflow: 'auto' as const,
      transition: 'height 200ms'
    }
  },

  // Portal Animations
  animations: {
    // Dropdown enter/exit animations
    dropdown: {
      enter: {
        opacity: 0,
        transform: 'translateY(-8px) scale(0.95)',
        transition: 'opacity 150ms, transform 150ms'
      },
      enterActive: {
        opacity: 1,
        transform: 'translateY(0) scale(1)'
      },
      exit: {
        opacity: 0,
        transform: 'translateY(-8px) scale(0.95)',
        transition: 'opacity 150ms, transform 150ms'
      }
    },

    // Modal enter/exit animations
    modal: {
      backdrop: {
        opacity: 0,
        transition: 'opacity 200ms'
      },
      backdropActive: {
        opacity: 1
      }
    }
  },

  // Positioning Helpers
  positioning: {
    // Standard dropdown offset από trigger element
    dropdownOffset: {
      top: 8,
      bottom: 8,
      left: 0,
      right: 0
    },

    // Minimum margins από viewport edges
    viewportMargins: {
      top: 16,
      bottom: 16,
      left: 16,
      right: 16
    },

    // Smart positioning preferences (priority order)
    preferredPlacements: ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'left', 'right'] as const
  }
} as const;

// ============================================================================
// PHOTO PREVIEW COMPONENTS - DYNAMIC STYLING SYSTEM
// ============================================================================

/**
 * Photo Preview Components για state-based photo containers
 * Supports empty, uploading, error, και with-photo states
 */
export const photoPreviewComponents = {
  // Photo Container States
  container: {
    // Base photo container
    base: {
      position: 'relative' as const,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      width: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all 150ms',
      overflow: 'hidden' as const,
      border: '2px dashed transparent'
    },

    // Empty state (no photo)
    empty: {
      backgroundColor: 'hsl(var(--muted))',
      borderColor: 'hsl(var(--border))',
      '&:hover': {
        backgroundColor: 'hsl(var(--muted) / 0.8)',
        borderColor: 'hsl(var(--border) / 0.8)'
      }
    },

    // With photo state
    withPhoto: {
      backgroundColor: 'transparent',
      borderColor: 'hsl(var(--status-success))',
      '&:hover': {
        borderColor: 'hsl(var(--status-success) / 0.8)',
        boxShadow: '0 0 0 4px hsl(var(--status-success) / 0.12)'
      }
    },

    // Upload states
    uploading: {
      backgroundColor: 'hsl(var(--status-info) / 0.1)',
      borderColor: 'hsl(var(--status-info))',
      cursor: 'wait' as const
    },

    error: {
      backgroundColor: 'hsl(var(--status-error) / 0.1)',
      borderColor: 'hsl(var(--status-error))',
      '&:hover': {
        backgroundColor: 'hsl(var(--status-error) / 0.15)',
        borderColor: 'hsl(var(--status-error) / 0.8)'
      }
    }
  },

  // Dynamic Colors (για backward compatibility με existing PHOTO_COLORS)
  colors: {
    emptyStateBackground: 'hsl(var(--muted))',
    emptyStateBorder: 'hsl(var(--border))',
    withPhotoBorder: 'hsl(var(--status-success))',
    uploadingBackground: 'hsl(var(--status-info) / 0.1)',
    errorBackground: 'hsl(var(--status-error) / 0.1)'
  }
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PortalZIndexLevel = keyof typeof portalComponents.zIndex;
export type DropdownVariant = keyof typeof portalComponents.dropdown;
export type PhotoContainerState = keyof typeof photoPreviewComponents.container;
export type PortalPlacement = typeof portalComponents.positioning.preferredPlacements[number];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get portal z-index value by level
 */
export const getPortalZIndex = (level: PortalZIndexLevel): number => {
  return portalComponents.zIndex[level];
};

/**
 * Get dropdown styles by variant
 */
export const getDropdownStyles = (variant: DropdownVariant) => {
  return portalComponents.dropdown[variant];
};

/**
 * Get photo container styles by state
 */
export const getPhotoContainerStyles = (state: PhotoContainerState) => {
  return {
    ...photoPreviewComponents.container.base,
    ...photoPreviewComponents.container[state]
  };
};

/**
 * Get portal animation styles
 */
export const getPortalAnimations = (type: 'dropdown' | 'modal') => {
  return portalComponents.animations[type];
};