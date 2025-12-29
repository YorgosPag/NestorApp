/**
 * 🏢 ENTERPRISE POLYGON SYSTEM CONFIGURATION
 * Role-based configuration management for polygon system
 *
 * @module polygon-system/utils
 */

import type {
  UserRole,
  RoleBasedConfig,
  DEFAULT_VISUAL_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG
} from '../types/polygon-system.types';
import { GEO_COLORS } from '../../../config/color-config';

// 🏢 ENTERPRISE INTEGRATION: Import existing centralized notification service
import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// ============================================================================
// ENTERPRISE CENTRALIZED COLOR SYSTEM
// ============================================================================

/**
 * 🏢 ENTERPRISE: Get semantic colors for polygon system
 * Centralized color management - ΜΟΝΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ
 */
export function getPolygonSemanticColors() {
  // Note: This function should be called within React components that have access to hooks
  // For static exports, we'll use fallback values and provide a runtime replacement
  return {
    danger: {
      normal: { color: 'var(--color-destructive)', borderColor: 'var(--color-destructive-muted)' },
      highlighted: { color: 'var(--color-success)', borderColor: 'var(--color-success-muted)' },
      completed: { color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
    },
    warning: {
      normal: { color: 'var(--color-warning)', borderColor: 'var(--color-warning-muted)' },
      highlighted: { color: 'var(--color-success)', borderColor: 'var(--color-success-muted)' },
      completed: { color: 'var(--color-success-dark)', borderColor: 'var(--color-success-border)' }
    },
    technical: {
      normal: { color: 'var(--color-primary)', borderColor: 'var(--color-primary-muted)' },
      highlighted: { color: 'var(--color-info)', borderColor: 'var(--color-info-muted)' },
      completed: { color: 'var(--color-info-dark)', borderColor: 'var(--color-info-border)' }
    }
  };
}

// ============================================================================
// ROLE-BASED CONFIGURATIONS
// ============================================================================

/**
 * Citizen user configuration
 * - Larger snap tolerance for mobile/touch
 * - Simplified visual feedback
 * - Basic functionality
 */
const CITIZEN_CONFIG: RoleBasedConfig = {
  role: 'citizen',
  snapTolerance: 15,
  enableSnapping: true,
  autoSave: true,
  debug: false,
  visualFeedback: {
    controlPoints: {
      normal: {
        size: 16,
        color: GEO_COLORS.POLYGON.ERROR,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.ERROR, 0.5),
        cursor: 'pointer'
      },
      highlighted: {
        size: 32,
        color: GEO_COLORS.POLYGON.COMPLETED,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.COMPLETED, 0.3),
        animation: 'animate-bounce',
        shadow: 'shadow-lg shadow-green-500/50'
      },
      completed: {
        size: 16,
        color: GEO_COLORS.POLYGON.COMPLETED,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.COMPLETED, 0.4),
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: GEO_COLORS.POLYGON.DRAFT,
        width: 2,
        dashArray: [2, 2]
      },
      completed: {
        color: GEO_COLORS.POLYGON.COMPLETED,
        width: 3,
        dashArray: [1, 0]
      }
    },
    zIndex: {
      controlPoints: 9999,
      lines: 1000,
      notifications: 10000
    }
  },
  notifications: {
    position: 'fixed top-4 right-4',
    autoRemoveDelay: 3000,
    styles: {
      // ✅ ENTERPRISE: Semantic color mapping for notifications
      success: `${COLOR_BRIDGE.bg.success.replace('bg-', 'bg-green-500')} text-white p-4 rounded-lg shadow-lg animate-pulse`, // Keep green-500 for visibility
      warning: `${COLOR_BRIDGE.bg.warning.replace('bg-', 'bg-yellow-500')} text-white p-4 rounded-lg shadow-lg animate-pulse`, // Keep yellow-500 for visibility
      error: `${COLOR_BRIDGE.bg.error.replace('bg-', 'bg-red-500')} text-white p-4 rounded-lg shadow-lg animate-pulse` // Keep red-500 for visibility
    }
  }
};

/**
 * Professional user configuration
 * - Medium snap tolerance for precision work
 * - Enhanced visual feedback
 * - Advanced functionality
 */
const PROFESSIONAL_CONFIG: RoleBasedConfig = {
  role: 'professional',
  snapTolerance: 10,
  enableSnapping: true,
  autoSave: true,
  debug: true,
  visualFeedback: {
    controlPoints: {
      normal: {
        size: 14,
        color: GEO_COLORS.POLYGON.WARNING,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.WARNING, 0.5),
        cursor: 'pointer'
      },
      highlighted: {
        size: 28,
        color: GEO_COLORS.POLYGON.COMPLETED,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.COMPLETED, 0.4),
        animation: 'animate-pulse',
        shadow: 'shadow-md shadow-emerald-500/50'
      },
      completed: {
        size: 14,
        color: GEO_COLORS.POLYGON.COMPLETED,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.COMPLETED, 0.6),
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: GEO_COLORS.POLYGON.WARNING,
        width: 2,
        dashArray: [3, 1]
      },
      completed: {
        color: GEO_COLORS.POLYGON.COMPLETED,
        width: 3,
        dashArray: [1, 0]
      }
    },
    zIndex: {
      controlPoints: 9999,
      lines: 1000,
      notifications: 10000
    }
  },
  notifications: {
    position: 'fixed top-4 left-4',
    autoRemoveDelay: 4000,
    styles: {
      // ✅ ENTERPRISE: Professional notification styles with semantic colors
      success: 'bg-emerald-600 text-white p-4 rounded-lg shadow-lg', // Keep emerald-600 for professional contrast
      warning: 'bg-amber-600 text-white p-4 rounded-lg shadow-lg',   // Keep amber-600 for professional contrast
      error: 'bg-red-600 text-white p-4 rounded-lg shadow-lg'        // Keep red-600 for professional contrast
    }
  }
};

/**
 * Technical user configuration
 * - Highest precision snap tolerance
 * - Advanced visual feedback
 * - Full functionality with debug
 */
const TECHNICAL_CONFIG: RoleBasedConfig = {
  role: 'technical',
  snapTolerance: 5,
  enableSnapping: true,
  autoSave: true,
  debug: true,
  visualFeedback: {
    controlPoints: {
      normal: {
        size: 12,
        color: GEO_COLORS.POLYGON.ADMINISTRATIVE,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.ADMINISTRATIVE, 0.4),
        cursor: 'crosshair'
      },
      highlighted: {
        size: 24,
        color: GEO_COLORS.POLYGON.DRAFT,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.DRAFT, 0.3),
        animation: 'animate-ping',
        shadow: 'shadow-sm shadow-cyan-500/50'
      },
      completed: {
        size: 12,
        color: GEO_COLORS.POLYGON.DRAFT,
        borderColor: GEO_COLORS.withOpacity(GEO_COLORS.POLYGON.DRAFT, 0.5),
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: GEO_COLORS.POLYGON.ADMINISTRATIVE,
        width: 1,
        dashArray: [4, 1, 1, 1]
      },
      completed: {
        color: GEO_COLORS.POLYGON.DRAFT,
        width: 2,
        dashArray: [1, 0]
      }
    },
    zIndex: {
      controlPoints: 9999,
      lines: 1000,
      notifications: 10000
    }
  },
  notifications: {
    position: 'fixed bottom-4 right-4',
    autoRemoveDelay: 5000,
    styles: {
      // ✅ ENTERPRISE: Technical notification styles with semantic colors
      success: 'bg-cyan-600 text-white p-3 rounded-md shadow-md text-sm font-mono',   // Keep cyan-600 for technical contrast
      warning: 'bg-violet-600 text-white p-3 rounded-md shadow-md text-sm font-mono', // Keep violet-600 for technical contrast
      error: 'bg-red-700 text-white p-3 rounded-md shadow-md text-sm font-mono'       // Keep red-700 for technical contrast
    }
  }
};

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/**
 * Get configuration for specific user role
 */
export function getRoleConfig(role: UserRole): RoleBasedConfig {
  switch (role) {
    case 'citizen':
      return CITIZEN_CONFIG;
    case 'professional':
      return PROFESSIONAL_CONFIG;
    case 'technical':
      return TECHNICAL_CONFIG;
    default:
      return CITIZEN_CONFIG; // Default fallback
  }
}

/**
 * Create custom configuration based on role with overrides
 */
export function createCustomConfig(
  role: UserRole,
  overrides: Partial<RoleBasedConfig>
): RoleBasedConfig {
  const baseConfig = getRoleConfig(role);
  return {
    ...baseConfig,
    ...overrides,
    // Deep merge visual feedback if provided
    visualFeedback: overrides.visualFeedback
      ? { ...baseConfig.visualFeedback, ...overrides.visualFeedback }
      : baseConfig.visualFeedback,
    // Deep merge notifications if provided
    notifications: overrides.notifications
      ? { ...baseConfig.notifications, ...overrides.notifications }
      : baseConfig.notifications
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: RoleBasedConfig): boolean {
  const required = [
    'role',
    'snapTolerance',
    'enableSnapping',
    'autoSave',
    'debug',
    'visualFeedback',
    'notifications'
  ];

  return required.every(key => key in config);
}

/**
 * 🏢 ENTERPRISE: Get configuration with centralized colors
 * ΜΟΝΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ για polygon colors
 *
 * Usage: Use this instead of static exports for runtime color updates
 */
export function getEnterprisePolygonConfig(role: UserRole): RoleBasedConfig {
  const semanticColors = getPolygonSemanticColors();
  const baseConfig = getRoleConfig(role);

  // Replace hardcoded colors with semantic colors
  return {
    ...baseConfig,
    visualFeedback: {
      ...baseConfig.visualFeedback,
      controlPoints: {
        normal: {
          ...baseConfig.visualFeedback.controlPoints.normal,
          color: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].normal.color,
          borderColor: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].normal.borderColor
        },
        highlighted: {
          ...baseConfig.visualFeedback.controlPoints.highlighted,
          color: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].highlighted.color,
          borderColor: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].highlighted.borderColor
        },
        completed: {
          ...baseConfig.visualFeedback.controlPoints.completed,
          color: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].completed.color,
          borderColor: semanticColors[role === 'citizen' ? 'danger' : role === 'professional' ? 'warning' : 'technical'].completed.borderColor
        }
      }
    }
  };
}

/**
 * Default polygon system configuration
 */
export const polygonSystemConfig = {
  getRoleConfig,
  createCustomConfig,
  validateConfig,
  getEnterprisePolygonConfig, // 🏢 ENTERPRISE: New centralized function
  roles: {
    citizen: CITIZEN_CONFIG,
    professional: PROFESSIONAL_CONFIG,
    technical: TECHNICAL_CONFIG
  }
};