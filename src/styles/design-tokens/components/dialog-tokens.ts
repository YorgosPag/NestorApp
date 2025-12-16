/**
 * 💬 DIALOG COMPONENT TOKENS
 * Enterprise Design System - Modal & Dialog Components Layer
 *
 * @description Centralized dialog, modal, form tokens για consistent
 * interactive interfaces, wizards, configuration dialogs κτλ.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 2.0.0 - Enterprise Consolidation
 */

import { statusSemanticColors } from '../semantic/alert-tokens';

// ============================================================================
// MODAL TOKENS
// ============================================================================

export const modalTokens = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: '1rem',                      // p-4
    animation: 'fadeIn 150ms ease-out'
  },

  container: {
    backgroundColor: '#1F2937',           // bg-gray-800
    borderRadius: '0.75rem',              // rounded-xl
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', // shadow-xl
    maxHeight: '90vh',
    width: '100%',
    maxWidth: '600px',
    overflow: 'auto',
    border: '1px solid #374151',          // border-gray-700
    animation: 'slideUp 200ms ease-out'
  },

  header: {
    padding: '1.5rem',                    // p-6
    borderBottom: '1px solid #374151',    // border-b border-gray-700
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  title: {
    fontSize: '1.25rem',                  // text-xl
    fontWeight: '600',                    // font-semibold
    color: '#F9FAFB',                     // text-gray-50
    margin: '0'
  },

  closeButton: {
    padding: '0.5rem',                    // p-2
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9CA3AF',                     // text-gray-400
    fontSize: '1.25rem',                  // text-xl
    cursor: 'pointer',
    borderRadius: '0.25rem',              // rounded
    transition: 'all 150ms ease',

    hover: {
      backgroundColor: '#374151',         // hover:bg-gray-700
      color: '#F9FAFB'                    // hover:text-gray-50
    }
  },

  content: {
    padding: '1.5rem'                     // p-6
  },

  footer: {
    padding: '1.5rem',                    // p-6
    borderTop: '1px solid #374151',       // border-t border-gray-700
    display: 'flex',
    gap: '0.75rem',                       // gap-3
    justifyContent: 'flex-end'
  }
} as const;

// ============================================================================
// FORM TOKENS
// ============================================================================

export const formTokens = {
  fieldset: {
    border: 'none',
    padding: '0',
    margin: '0 0 1.5rem 0'                // mb-6
  },

  label: {
    display: 'block',
    color: '#F9FAFB',                     // text-gray-50
    fontWeight: '500',                    // font-medium
    marginBottom: '0.75rem',              // mb-3
    fontSize: '0.875rem'                  // text-sm
  },

  input: {
    width: '100%',
    padding: '0.75rem',                   // p-3
    backgroundColor: '#374151',           // bg-gray-700
    border: '1px solid #4B5563',          // border-gray-600
    borderRadius: '0.5rem',               // rounded-lg
    color: '#F9FAFB',                     // text-gray-50
    fontSize: '0.875rem',                 // text-sm
    transition: 'border-color 150ms ease',

    focus: {
      outline: 'none',
      borderColor: '#3B82F6',             // focus:border-blue-500
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' // focus:ring-blue-500/10
    },

    disabled: {
      backgroundColor: '#1F2937',         // disabled:bg-gray-800
      color: '#6B7280',                   // disabled:text-gray-500
      cursor: 'not-allowed'
    }
  },

  select: {
    width: '100%',
    padding: '0.75rem',                   // p-3
    backgroundColor: '#374151',           // bg-gray-700
    border: '1px solid #4B5563',          // border-gray-600
    borderRadius: '0.5rem',               // rounded-lg
    color: '#F9FAFB',                     // text-gray-50
    fontSize: '0.875rem',                 // text-sm
    transition: 'border-color 150ms ease',

    focus: {
      outline: 'none',
      borderColor: '#3B82F6',             // focus:border-blue-500
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' // focus:ring-blue-500/10
    },

    disabled: {
      backgroundColor: '#1F2937',         // disabled:bg-gray-800
      color: '#6B7280',                   // disabled:text-gray-500
      cursor: 'not-allowed'
    }
  },

  option: {
    backgroundColor: '#374151',           // bg-gray-700
    color: '#F9FAFB',                     // text-gray-50
    padding: '0.5rem'                     // p-2
  },

  textarea: {
    width: '100%',
    padding: '0.75rem',                   // p-3
    backgroundColor: '#374151',           // bg-gray-700
    border: '1px solid #4B5563',          // border-gray-600
    borderRadius: '0.5rem',               // rounded-lg
    color: '#F9FAFB',                     // text-gray-50
    fontSize: '0.875rem',                 // text-sm
    minHeight: '80px',
    resize: 'vertical' as const,
    transition: 'border-color 150ms ease',

    focus: {
      outline: 'none',
      borderColor: '#3B82F6',             // focus:border-blue-500
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' // focus:ring-blue-500/10
    }
  },

  checkbox: {
    width: '1rem',                        // w-4
    height: '1rem',                       // h-4
    accentColor: '#3B82F6',               // accent-blue-500
    marginRight: '0.5rem'                 // mr-2
  },

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',                 // text-sm
    color: '#F9FAFB',                     // text-gray-50
    cursor: 'pointer'
  }
} as const;

// ============================================================================
// FORM ERROR STATES TOKENS
// ============================================================================

export const formErrorStateTokens = {
  container: {
    padding: '0.75rem',                   // p-3
    backgroundColor: 'rgba(248, 113, 113, 0.1)', // bg-red-400/10
    border: '1px solid #F87171',          // border-red-400
    borderRadius: '0.25rem',              // rounded
    marginTop: '0.75rem'                  // mt-3
  },

  text: {
    color: '#F87171',                     // text-red-400
    fontSize: '0.875rem',                 // text-sm
    margin: '0'
  },

  inputError: {
    borderColor: '#F87171',               // border-red-400
    boxShadow: '0 0 0 3px rgba(248, 113, 113, 0.1)' // ring-red-400/10
  }
} as const;

// ============================================================================
// LOADING STATE TOKENS
// ============================================================================

export const formLoadingStateTokens = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                        // gap-2
    color: '#D1D5DB',                     // text-gray-300
    fontSize: '0.875rem'                  // text-sm
  },

  spinner: {
    width: '1rem',                        // w-4
    height: '1rem',                       // h-4
    border: '2px solid #4B5563',          // border-gray-600
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },

  text: {
    fontWeight: '500'                     // font-medium
  }
} as const;

// ============================================================================
// EMPTY STATE TOKENS
// ============================================================================

export const formEmptyStateTokens = {
  container: {
    marginTop: '0.75rem',                 // mt-3
    padding: '0.75rem',                   // p-3
    backgroundColor: '#374151',           // bg-gray-700
    borderRadius: '0.5rem'                // rounded-lg
  },

  text: {
    color: '#D1D5DB',                     // text-gray-300
    fontSize: '0.875rem',                 // text-sm
    margin: '0',
    textAlign: 'center' as const
  }
} as const;

// ============================================================================
// INFO CARD TOKENS
// ============================================================================

export const infoCardTokens = {
  container: {
    marginBottom: '1rem',                 // mb-4
    padding: '0.75rem',                   // p-3
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // bg-blue-500/10
    border: '1px solid #2563EB',          // border-blue-600
    borderRadius: '0.5rem'                // rounded-lg
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'                         // gap-2
  },

  icon: {
    fontSize: '1.125rem',                 // text-lg
    color: '#60A5FA'                      // text-blue-400
  },

  content: {
    flex: 1
  },

  title: {
    fontWeight: '600',                    // font-semibold
    color: '#F9FAFB',                     // text-gray-50
    margin: '0',
    fontSize: '0.875rem'                  // text-sm
  },

  subtitle: {
    color: '#D1D5DB',                     // text-gray-300
    fontSize: '0.75rem',                  // text-xs
    margin: '0'
  }
} as const;

// ============================================================================
// DIALOG BUTTON TOKENS
// ============================================================================

export const dialogButtonTokens = {
  base: {
    padding: '0.75rem 1rem',              // py-3 px-4
    borderRadius: '0.5rem',               // rounded-lg
    fontSize: '0.875rem',                 // text-sm
    fontWeight: '500',                    // font-medium
    cursor: 'pointer',
    transition: 'all 150ms ease',
    border: 'none',
    outline: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'                         // gap-2
  },

  variants: {
    primary: {
      backgroundColor: '#2563EB',         // bg-blue-600
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#1D4ED8'        // hover:bg-blue-700
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' // focus:ring-blue-500/30
      },

      disabled: {
        backgroundColor: '#4B5563',       // disabled:bg-gray-600
        color: '#9CA3AF',                 // disabled:text-gray-400
        cursor: 'not-allowed'
      }
    },

    secondary: {
      backgroundColor: '#4B5563',         // bg-gray-600
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#374151'        // hover:bg-gray-700
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(107, 114, 128, 0.3)' // focus:ring-gray-500/30
      },

      disabled: {
        backgroundColor: '#374151',       // disabled:bg-gray-700
        color: '#6B7280',                 // disabled:text-gray-500
        cursor: 'not-allowed'
      }
    },

    danger: {
      backgroundColor: '#DC2626',         // bg-red-600
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#B91C1C'        // hover:bg-red-700
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)' // focus:ring-red-500/30
      }
    },

    ghost: {
      backgroundColor: 'transparent',
      color: '#D1D5DB',                   // text-gray-300
      border: '1px solid #4B5563',        // border-gray-600

      hover: {
        backgroundColor: '#374151',       // hover:bg-gray-700
        color: '#F9FAFB'                  // hover:text-gray-50
      }
    }
  }
} as const;

// ============================================================================
// STEP WIZARD TOKENS
// ============================================================================

export const stepWizardTokens = {
  container: {
    marginBottom: '1.5rem'                // mb-6
  },

  list: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'                           // gap-4
  },

  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                        // gap-2
    flex: 1
  },

  stepNumber: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',                 // text-sm
    fontWeight: '500'                     // font-medium
  },

  stepStates: {
    active: {
      backgroundColor: '#2563EB',         // bg-blue-600
      color: '#F9FAFB'                    // text-gray-50
    },

    completed: {
      backgroundColor: '#22C55E',         // bg-green-500
      color: '#F9FAFB'                    // text-gray-50
    },

    inactive: {
      backgroundColor: '#4B5563',         // bg-gray-600
      color: '#9CA3AF'                    // text-gray-400
    }
  },

  stepLabel: {
    fontSize: '0.875rem',                 // text-sm
    fontWeight: '500'                     // font-medium
  },

  stepLabelStates: {
    active: {
      color: '#F9FAFB'                    // text-gray-50
    },

    inactive: {
      color: '#9CA3AF'                    // text-gray-400
    }
  },

  divider: {
    flex: 1,
    height: '1px',
    backgroundColor: '#4B5563'            // bg-gray-600
  }
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DialogButtonVariant = keyof typeof dialogButtonTokens.variants;
export type StepState = keyof typeof stepWizardTokens.stepStates;