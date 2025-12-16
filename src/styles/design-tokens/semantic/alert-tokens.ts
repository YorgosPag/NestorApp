/**
 * 🚨 ALERT & STATUS SEMANTIC TOKENS
 * Enterprise Design System - Semantic Color & Status Layer
 *
 * @description Centralized alert, severity και status tokens για consistent
 * semantic meaning across όλη την εφαρμογή
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 2.0.0 - Enterprise Consolidation
 */

// ============================================================================
// ALERT SEVERITY COLORS - ISO 27001 COMPLIANT
// ============================================================================

export const alertSeverityColors = {
  critical: {
    background: '#FEE2E2',    // red-100
    border: '#FCA5A5',        // red-300
    text: '#991B1B',          // red-800
    icon: '#DC2626',          // red-600
    accent: '#EF4444'         // red-500
  },
  high: {
    background: '#FEF3C7',    // amber-100
    border: '#FCD34D',        // amber-300
    text: '#92400E',          // amber-800
    icon: '#F59E0B',          // amber-500
    accent: '#F59E0B'         // amber-500
  },
  medium: {
    background: '#DBEAFE',    // blue-100
    border: '#93C5FD',        // blue-300
    text: '#1E40AF',          // blue-800
    icon: '#3B82F6',          // blue-500
    accent: '#3B82F6'         // blue-500
  },
  low: {
    background: '#DCFCE7',    // green-100
    border: '#86EFAC',        // green-300
    text: '#166534',          // green-800
    icon: '#22C55E',          // green-500
    accent: '#22C55E'         // green-500
  },
  info: {
    background: '#F0F9FF',    // sky-50
    border: '#7DD3FC',        // sky-300
    text: '#0C4A6E',          // sky-900
    icon: '#0EA5E9',          // sky-500
    accent: '#0EA5E9'         // sky-500
  }
} as const;

// ============================================================================
// STATUS SEMANTIC COLORS - APPLICATION WIDE
// ============================================================================

export const statusSemanticColors = {
  // General Status Colors
  success: {
    light: '#DCFCE7',         // green-100
    main: '#22C55E',          // green-500
    dark: '#15803D',          // green-700
    text: '#166534',          // green-800
    bg: '#F0FDF4'             // green-50
  },
  warning: {
    light: '#FEF3C7',         // amber-100
    main: '#F59E0B',          // amber-500
    dark: '#D97706',          // amber-600
    text: '#92400E',          // amber-800
    bg: '#FFFBEB'             // amber-50
  },
  error: {
    light: '#FEE2E2',         // red-100
    main: '#EF4444',          // red-500
    dark: '#DC2626',          // red-600
    text: '#991B1B',          // red-800
    bg: '#FEF2F2'             // red-50
  },
  info: {
    light: '#DBEAFE',         // blue-100
    main: '#3B82F6',          // blue-500
    dark: '#1D4ED8',          // blue-700
    text: '#1E40AF',          // blue-800
    bg: '#EFF6FF'             // blue-50
  },

  // Application-Specific Status Colors
  active: {
    light: '#DCFCE7',
    main: '#22C55E',
    dark: '#15803D',
    text: '#166534'
  },
  inactive: {
    light: '#F3F4F6',         // gray-100
    main: '#6B7280',          // gray-500
    dark: '#374151',          // gray-700
    text: '#111827'           // gray-900
  },
  pending: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#D97706',
    text: '#92400E'
  },
  completed: {
    light: '#F3E8FF',         // purple-100
    main: '#8B5CF6',          // purple-500
    dark: '#6D28D9',          // purple-700
    text: '#5B21B6'           // purple-800
  }
} as const;

// ============================================================================
// STATUS BADGE VARIANTS - ENTERPRISE COMPONENTS
// ============================================================================

export const statusBadgeTokens = {
  base: {
    padding: '0.25rem 0.5rem',    // py-1 px-2
    borderRadius: '9999px',       // rounded-full
    fontSize: '0.75rem',          // text-xs
    fontWeight: '500',            // font-medium
    textTransform: 'uppercase' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem'                // gap-1
  },
  variants: {
    // Alert Status Badges
    active: {
      backgroundColor: alertSeverityColors.critical.background,
      color: alertSeverityColors.critical.text,
      border: `1px solid ${alertSeverityColors.critical.border}`
    },
    acknowledged: {
      backgroundColor: alertSeverityColors.high.background,
      color: alertSeverityColors.high.text,
      border: `1px solid ${alertSeverityColors.high.border}`
    },
    resolved: {
      backgroundColor: alertSeverityColors.low.background,
      color: alertSeverityColors.low.text,
      border: `1px solid ${alertSeverityColors.low.border}`
    },
    suppressed: {
      backgroundColor: '#F3F4F6',  // gray-100
      color: '#4B5563',            // gray-600
      border: '1px solid #D1D5DB'  // gray-300
    },

    // General Status Badges
    success: {
      backgroundColor: statusSemanticColors.success.bg,
      color: statusSemanticColors.success.text,
      border: `1px solid ${statusSemanticColors.success.light}`
    },
    warning: {
      backgroundColor: statusSemanticColors.warning.bg,
      color: statusSemanticColors.warning.text,
      border: `1px solid ${statusSemanticColors.warning.light}`
    },
    error: {
      backgroundColor: statusSemanticColors.error.bg,
      color: statusSemanticColors.error.text,
      border: `1px solid ${statusSemanticColors.error.light}`
    },
    info: {
      backgroundColor: statusSemanticColors.info.bg,
      color: statusSemanticColors.info.text,
      border: `1px solid ${statusSemanticColors.info.light}`
    }
  }
} as const;

// ============================================================================
// AUTO-SAVE STATUS INDICATORS - ENTERPRISE SYSTEM
// ============================================================================

export const autoSaveStatusTokens = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                           // space-2
    padding: '0.75rem 1rem',                 // py-3 px-4
    backgroundColor: 'rgba(31, 41, 55, 0.8)', // bg-gray-800/80
    border: '1px solid #4B5563',            // border-gray-600
    borderRadius: '0.375rem',               // rounded-md
    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    zIndex: 9999
  },

  statusDot: {
    width: '0.5rem',                        // w-2
    height: '0.5rem',                       // h-2
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background-color 150ms ease'
  },

  statusColors: {
    saving: {
      dot: '#3B82F6',                       // blue-500
      text: '#60A5FA',                      // blue-400
      border: 'rgba(59, 130, 246, 0.3)'    // blue-500/30
    },
    success: {
      dot: '#22C55E',                       // green-500
      text: '#4ADE80',                      // green-400
      border: 'rgba(34, 197, 94, 0.3)'     // green-500/30
    },
    error: {
      dot: '#EF4444',                       // red-500
      text: '#F87171',                      // red-400
      border: 'rgba(239, 68, 68, 0.3)'     // red-500/30
    },
    idle: {
      dot: '#6B7280',                       // gray-500
      text: '#9CA3AF',                      // gray-400
      border: 'rgba(107, 114, 128, 0.3)'   // gray-500/30
    }
  },

  text: {
    primary: {
      fontSize: '0.875rem',                 // text-sm
      fontWeight: '500',                    // font-medium
      color: '#F3F4F6'                      // text-gray-100
    },
    secondary: {
      fontSize: '0.75rem',                  // text-xs
      color: '#6B7280',                     // text-gray-500
      marginTop: '0.25rem'                  // mt-1
    }
  },

  separator: {
    width: '1px',
    height: '1rem',                         // h-4
    backgroundColor: '#6B7280',             // bg-gray-500
    opacity: 0.7
  }
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status badge variant style με enterprise patterns
 * Replaces: style={{ ...dashboardComponents.statusBadge.base, ...variant }}
 */
export const getStatusBadgeVariant = (status: keyof typeof statusBadgeTokens.variants): React.CSSProperties => {
  return {
    ...statusBadgeTokens.base,
    ...statusBadgeTokens.variants[status]
  } as React.CSSProperties;
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AlertSeverity = keyof typeof alertSeverityColors;
export type StatusSemantic = keyof typeof statusSemanticColors;
export type StatusBadgeVariant = keyof typeof statusBadgeTokens.variants;
export type AutoSaveStatus = keyof typeof autoSaveStatusTokens.statusColors;