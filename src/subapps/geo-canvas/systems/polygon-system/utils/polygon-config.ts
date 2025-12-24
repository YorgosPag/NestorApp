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

// 🏢 ENTERPRISE INTEGRATION: Import existing centralized notification service
import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';

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
        color: '#ef4444',
        borderColor: '#fca5a5',
        cursor: 'pointer'
      },
      highlighted: {
        size: 32,
        color: '#4ade80',
        borderColor: '#bbf7d0',
        animation: 'animate-bounce',
        shadow: 'shadow-lg shadow-green-500/50'
      },
      completed: {
        size: 16,
        color: '#10b981',
        borderColor: '#6ee7b7',
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: '#3b82f6',
        width: 2,
        dashArray: [2, 2]
      },
      completed: {
        color: '#10b981',
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
      success: 'bg-green-500 text-white p-4 rounded-lg shadow-lg animate-pulse',
      warning: 'bg-yellow-500 text-white p-4 rounded-lg shadow-lg animate-pulse',
      error: 'bg-red-500 text-white p-4 rounded-lg shadow-lg animate-pulse'
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
        color: '#f59e0b',
        borderColor: '#fcd34d',
        cursor: 'pointer'
      },
      highlighted: {
        size: 28,
        color: '#10b981',
        borderColor: '#6ee7b7',
        animation: 'animate-pulse',
        shadow: 'shadow-md shadow-emerald-500/50'
      },
      completed: {
        size: 14,
        color: '#059669',
        borderColor: '#34d399',
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: '#f59e0b',
        width: 2,
        dashArray: [3, 1]
      },
      completed: {
        color: '#059669',
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
      success: 'bg-emerald-600 text-white p-4 rounded-lg shadow-lg',
      warning: 'bg-amber-600 text-white p-4 rounded-lg shadow-lg',
      error: 'bg-red-600 text-white p-4 rounded-lg shadow-lg'
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
        color: '#8b5cf6',
        borderColor: '#c4b5fd',
        cursor: 'crosshair'
      },
      highlighted: {
        size: 24,
        color: '#06b6d4',
        borderColor: '#67e8f9',
        animation: 'animate-ping',
        shadow: 'shadow-sm shadow-cyan-500/50'
      },
      completed: {
        size: 12,
        color: '#0891b2',
        borderColor: '#22d3ee',
        cursor: 'default'
      }
    },
    lines: {
      drawing: {
        color: '#8b5cf6',
        width: 1,
        dashArray: [4, 1, 1, 1]
      },
      completed: {
        color: '#0891b2',
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
      success: 'bg-cyan-600 text-white p-3 rounded-md shadow-md text-sm font-mono',
      warning: 'bg-violet-600 text-white p-3 rounded-md shadow-md text-sm font-mono',
      error: 'bg-red-700 text-white p-3 rounded-md shadow-md text-sm font-mono'
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
 * Default polygon system configuration
 */
export const polygonSystemConfig = {
  getRoleConfig,
  createCustomConfig,
  validateConfig,
  roles: {
    citizen: CITIZEN_CONFIG,
    professional: PROFESSIONAL_CONFIG,
    technical: TECHNICAL_CONFIG
  }
};