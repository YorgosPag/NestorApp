/**
 * 📊 DASHBOARD COMPONENT TOKENS
 * Enterprise Design System - Dashboard Components Layer
 *
 * @description Centralized dashboard component tokens για consistent
 * dashboard layouts, metrics cards, charts κτλ.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 2.0.0 - Enterprise Consolidation
 */

import { alertSeverityColors, statusSemanticColors } from '../semantic/alert-tokens';

// ============================================================================
// DASHBOARD LAYOUT TOKENS
// ============================================================================

export const dashboardLayoutTokens = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#F9FAFB',           // bg-gray-50
    padding: '1.5rem'                     // p-6
  },

  header: {
    backgroundColor: '#FFFFFF',           // bg-white
    borderRadius: '0.5rem',               // rounded-lg
    padding: '1.5rem',                    // p-6
    marginBottom: '1.5rem',               // mb-6
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' // shadow-md
  },

  title: {
    margin: '0 0 0.5rem 0',               // mb-2
    fontSize: '1.75rem',                  // text-28px
    fontWeight: '700',                    // font-bold
    color: '#111827'                      // text-gray-900
  },

  subtitle: {
    margin: '0',
    color: '#6B7280',                     // text-gray-500
    fontSize: '1.125rem'                  // text-lg
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'                        // space-3
  },

  metricsGrid: {
    marginBottom: '1.5rem'                // mb-6
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1.5rem'                         // gap-6
  }
} as const;

// ============================================================================
// METRICS CARD TOKENS
// ============================================================================

export const metricsCardTokens = {
  base: {
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #E5E7EB',          // border-gray-200
    borderRadius: '0.5rem',               // rounded-lg
    padding: '1rem',                      // p-4
    minHeight: '120px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)'
  },

  states: {
    hover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    }
  },

  title: {
    margin: '0',
    fontSize: '0.875rem',                 // text-sm
    color: '#6B7280',                     // text-gray-500
    fontWeight: '500'                     // font-medium
  },

  value: {
    fontSize: '1.75rem',                  // text-28px
    fontWeight: '700',                    // font-bold
    lineHeight: '1',                      // leading-none
    color: '#111827'                      // text-gray-900
  },

  subtitle: {
    margin: '0',
    fontSize: '0.75rem',                  // text-xs
    color: '#9CA3AF'                      // text-gray-400
  },

  icon: {
    fontSize: '1.25rem'                   // text-20px
  },

  trend: {
    fontSize: '0.875rem',                 // text-sm
    color: '#6B7280'                      // text-gray-500
  },

  trendVariants: {
    up: {
      color: statusSemanticColors.success.main
    },
    down: {
      color: statusSemanticColors.error.main
    },
    stable: {
      color: '#6B7280'                    // text-gray-500
    }
  }
} as const;

// ============================================================================
// ALERTS LIST TOKENS
// ============================================================================

export const alertsListTokens = {
  container: {
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #E5E7EB',          // border-gray-200
    borderRadius: '0.5rem',               // rounded-lg
    padding: '1rem',                      // p-4
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },

  header: {
    margin: '0 0 1rem 0',                 // mb-4
    fontSize: '1.125rem',                 // text-lg
    fontWeight: '600',                    // font-semibold
    color: '#111827'                      // text-gray-900
  },

  scrollArea: {
    maxHeight: '400px',
    overflowY: 'auto' as const
  },

  item: {
    padding: '0.75rem',                   // p-3
    borderBottom: '1px solid #F3F4F6',    // border-b border-gray-100
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',                       // gap-3
    transition: 'background-color 150ms ease',

    hover: {
      backgroundColor: '#F9FAFB'          // hover:bg-gray-50
    }
  },

  alertContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'                        // gap-1
  },

  alertTitle: {
    fontSize: '0.875rem',                 // text-sm
    fontWeight: '500',                    // font-medium
    color: '#111827'                      // text-gray-900
  },

  alertDescription: {
    fontSize: '0.75rem',                  // text-xs
    color: '#6B7280',                     // text-gray-500
    lineHeight: '1.5'
  },

  alertMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                        // gap-2
    fontSize: '0.75rem',                  // text-xs
    color: '#9CA3AF'                      // text-gray-400
  }
} as const;

// ============================================================================
// EVENTS LIST TOKENS
// ============================================================================

export const eventsListTokens = {
  container: {
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #E5E7EB',          // border-gray-200
    borderRadius: '0.5rem',               // rounded-lg
    padding: '1rem',                      // p-4
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },

  header: {
    margin: '0 0 1rem 0',                 // mb-4
    fontSize: '1.125rem',                 // text-lg
    fontWeight: '600',                    // font-semibold
    color: '#111827'                      // text-gray-900
  },

  scrollArea: {
    maxHeight: '300px',
    overflowY: 'auto' as const
  },

  item: {
    padding: '0.5rem',                    // p-2
    borderBottom: '1px solid #F3F4F6',    // border-b border-gray-100
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',                       // gap-3
    fontSize: '0.875rem'                  // text-sm
  },

  eventIcon: {
    fontSize: '0.875rem',                 // text-sm
    width: '1rem',
    textAlign: 'center' as const
  },

  eventText: {
    flex: 1,
    color: '#111827'                      // text-gray-900
  },

  timestamp: {
    fontSize: '0.75rem',                  // text-xs
    color: '#9CA3AF'                      // text-gray-400
  }
} as const;

// ============================================================================
// ALERT CONFIGURATION TOKENS
// ============================================================================

export const alertConfigTokens = {
  container: {
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #E5E7EB',          // border-gray-200
    borderRadius: '0.5rem',               // rounded-lg
    padding: '1rem',                      // p-4
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                        // gap-2
    marginBottom: '0.75rem'               // mb-3
  },

  title: {
    margin: '0',
    fontSize: '1.125rem',                 // text-lg
    fontWeight: '600'                     // font-semibold
  },

  configList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'                        // gap-1
  },

  configItem: {
    fontSize: '0.75rem',                  // text-xs
    color: '#6B7280'                      // text-gray-500
  }
} as const;

// ============================================================================
// LOADING STATE TOKENS
// ============================================================================

export const loadingStateTokens = {
  container: {
    backgroundColor: '#F9FAFB',           // bg-gray-50
    borderRadius: '0.5rem',               // rounded-lg
    padding: '2rem',                      // p-8
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px'
  },

  spinner: {
    fontSize: '1.5rem',                   // text-24px
    marginBottom: '0.5rem',               // mb-2
    animation: 'spin 1s linear infinite'
  },

  text: {
    color: '#6B7280',                     // text-gray-500
    fontSize: '0.875rem'                  // text-sm
  },

  error: {
    color: statusSemanticColors.error.main,
    marginTop: '0.5rem',                  // mt-2
    fontSize: '0.75rem'                   // text-xs
  }
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type MetricsTrendVariant = keyof typeof metricsCardTokens.trendVariants;