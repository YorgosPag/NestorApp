// ============================================================================
// 📝 ENTERPRISE FORM INTERACTION EFFECTS SYSTEM
// ============================================================================
//
// ✨ Centralized form interaction effects για consistent UX
// Professional form states, validations, και accessibility
// Based on WAI-ARIA guidelines και modern form design patterns
//
// ============================================================================

import { borders } from '@/styles/design-tokens';

/**
 * 🎯 FORM INPUT FOCUS EFFECTS
 * Professional focus states για form inputs
 */
export const FORM_FOCUS_EFFECTS = {
  /** Standard input focus */
  STANDARD: `focus:ring-2 focus:ring-primary focus:ring-offset-2 ${borders.variants.input.focus.className} transition-all duration-200`,

  /** Subtle focus για minimal designs */
  SUBTLE: `focus:ring-1 focus:ring-primary/50 ${borders.variants.input.default.className} transition-all duration-150`,

  /** Enhanced focus για important fields */
  ENHANCED: `focus:ring-2 focus:ring-primary focus:ring-offset-2 ${borders.variants.input.focus.className} focus:shadow-lg transition-all duration-300`,

  /** High contrast accessibility focus */
  HIGH_CONTRAST: 'focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:border-yellow-400 transition-all duration-200',

  /** Error state focus */
  ERROR: 'focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:border-destructive transition-all duration-200',

  /** Success state focus */
  SUCCESS: 'focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:border-hsl(var(--border-success)) transition-all duration-200',

  /** Warning state focus */
  WARNING: 'focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:border-hsl(var(--border-warning)) transition-all duration-200'
} as const;

/**
 * 📋 FORM INPUT HOVER EFFECTS
 * Hover states που complement focus effects
 */
export const FORM_HOVER_EFFECTS = {
  /** Standard input hover */
  STANDARD: `${borders.variants.input.default.className} hover:shadow-sm transition-all duration-200`,

  /** Subtle hover για readonly fields */
  SUBTLE: 'hover:border-border/80 transition-colors duration-150',

  /** Enhanced hover για interactive fields */
  ENHANCED: `${borders.variants.input.focus.className} hover:shadow-md hover:scale-[1.01] transition-all duration-200`,

  /** Disabled hover (no effect) */
  DISABLED: 'cursor-not-allowed opacity-50',

  /** Error state hover */
  ERROR: 'hover:border-destructive/70 transition-colors duration-200',

  /** Success state hover */
  SUCCESS: 'hover:border-hsl(var(--border-success)/70) transition-colors duration-200'
} as const;

/**
 * 🎨 FORM FIELD STATE EFFECTS
 * Visual feedback για different field states
 */
export const FORM_STATE_EFFECTS = {
  /** Default/neutral state */
  DEFAULT: 'border-border bg-background text-foreground',

  /** Active/focused state */
  ACTIVE: `${borders.variants.input.focus.className} bg-background text-foreground shadow-sm`,

  /** Error state */
  ERROR: 'border-destructive bg-destructive/5 text-foreground',

  /** Success state */
  SUCCESS: 'border-hsl(var(--border-success)) bg-green-50 text-foreground dark:bg-green-900/10',

  /** Warning state */
  WARNING: 'border-hsl(var(--border-warning)) bg-yellow-50 text-foreground dark:bg-yellow-900/10',

  /** Disabled state */
  DISABLED: 'border-border/50 bg-muted text-muted-foreground cursor-not-allowed opacity-50',

  /** Loading state */
  LOADING: 'border-border/50 bg-muted text-muted-foreground cursor-wait opacity-75',

  /** Read-only state */
  READONLY: 'border-border/50 bg-muted/50 text-foreground cursor-default'
} as const;

/**
 * 🔘 BUTTON HOVER EFFECTS για forms
 * Specialized button effects για form actions
 */
export const FORM_BUTTON_EFFECTS = {
  /** Primary submit button */
  PRIMARY: 'hover:bg-primary/90 hover:scale-105 hover:shadow-md active:scale-95 transition-all duration-200',

  /** Secondary action button */
  SECONDARY: 'hover:bg-secondary/80 hover:scale-105 active:scale-95 transition-all duration-200',

  /** Destructive action (delete, remove) */
  DESTRUCTIVE: 'hover:bg-destructive/90 hover:scale-105 hover:shadow-lg active:scale-95 transition-all duration-200',

  /** Ghost/minimal button */
  GHOST: 'hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95 transition-all duration-200',

  /** Loading button state */
  LOADING: 'cursor-wait opacity-75 hover:opacity-75 transition-opacity duration-200',

  /** Disabled button state */
  DISABLED: 'cursor-not-allowed opacity-50 hover:opacity-50 transition-opacity duration-200',

  /** Success confirmation button */
  SUCCESS: 'hover:bg-green-600 hover:scale-105 hover:shadow-md active:scale-95 transition-all duration-200',

  /** Cancel/reset button */
  CANCEL: 'hover:bg-muted hover:text-muted-foreground hover:scale-105 active:scale-95 transition-all duration-200'
} as const;

/**
 * 📝 FORM VALIDATION FEEDBACK EFFECTS
 * Visual effects για validation feedback
 */
export const VALIDATION_FEEDBACK_EFFECTS = {
  /** Slide in from right για inline validation */
  SLIDE_IN: 'animate-in slide-in-from-right-2 duration-200',

  /** Fade in για subtle validation messages */
  FADE_IN: 'animate-in fade-in duration-300',

  /** Shake animation για errors */
  SHAKE: 'animate-pulse duration-150',

  /** Success checkmark animation */
  SUCCESS_PULSE: 'animate-in zoom-in-75 duration-200',

  /** Error icon bounce */
  ERROR_BOUNCE: 'animate-bounce duration-500',

  /** Loading spinner */
  LOADING_SPIN: 'animate-spin duration-1000'
} as const;

/**
 * 📦 FORM GROUP EFFECTS
 * Effects για form sections και groups
 */
export const FORM_GROUP_EFFECTS = {
  /** Standard form group */
  STANDARD: 'transition-all duration-200',

  /** Collapsible form section */
  COLLAPSIBLE: 'transition-all duration-300 hover:bg-accent/30 hover:shadow-sm',

  /** Form step/wizard section */
  STEP: `transition-all duration-300 hover:shadow-md ${borders.variants.input.default.className}`,

  /** Form card/container */
  CARD: 'transition-all duration-200 hover:shadow-lg hover:scale-[1.01]',

  /** Highlighted form group */
  HIGHLIGHTED: `transition-all duration-300 hover:bg-primary/5 ${borders.variants.input.default.className}`
} as const;

/**
 * 🏷️ FORM LABEL EFFECTS
 * Interactive label animations
 */
export const FORM_LABEL_EFFECTS = {
  /** Floating label animation */
  FLOATING: 'transition-all duration-200 transform origin-left',

  /** Label hover για better UX */
  INTERACTIVE: 'cursor-pointer transition-colors duration-150 hover:text-primary',

  /** Required field label */
  REQUIRED: 'after:content-["*"] after:text-destructive after:ml-1',

  /** Optional field label */
  OPTIONAL: 'after:content-["(optional)"] after:text-muted-foreground after:ml-1 after:text-sm',

  /** Help text label */
  HELP: 'transition-colors duration-150 hover:text-foreground'
} as const;

/**
 * 🎭 COMPLEX FORM INTERACTIONS
 * Advanced form interaction patterns
 */
export const COMPLEX_FORM_EFFECTS = {
  /** Multi-step form progress */
  STEP_PROGRESS: {
    ACTIVE: 'bg-primary text-primary-foreground shadow-lg scale-110 transition-all duration-300',
    COMPLETED: 'bg-green-500 text-white shadow-md hover:shadow-lg transition-all duration-200',
    PENDING: 'bg-muted text-muted-foreground hover:bg-muted/80 transition-all duration-200'
  },

  /** Form field with validation */
  VALIDATED_FIELD: {
    VALID: `${FORM_STATE_EFFECTS.SUCCESS} ${FORM_FOCUS_EFFECTS.SUCCESS} ${FORM_HOVER_EFFECTS.SUCCESS}`,
    INVALID: `${FORM_STATE_EFFECTS.ERROR} ${FORM_FOCUS_EFFECTS.ERROR} ${FORM_HOVER_EFFECTS.ERROR}`,
    PENDING: `${FORM_STATE_EFFECTS.LOADING} ${FORM_HOVER_EFFECTS.SUBTLE}`
  },

  /** File upload area */
  FILE_UPLOAD: {
    DEFAULT: `border border-dashed ${borders.variants.input.default.className} transition-all duration-200 hover:bg-accent/30`,
    DRAGOVER: `${borders.variants.input.focus.className} bg-primary/10 scale-105 transition-all duration-200`,
    ERROR: 'border-destructive bg-destructive/10',
    SUCCESS: 'border-hsl(var(--border-success)) bg-green-50 dark:bg-green-900/10'
  },

  /** Search input with suggestions */
  SEARCH_FIELD: {
    INPUT: `${FORM_FOCUS_EFFECTS.ENHANCED} ${FORM_HOVER_EFFECTS.ENHANCED}`,
    SUGGESTIONS: 'animate-in fade-in slide-in-from-top-2 duration-200',
    SUGGESTION_ITEM: 'transition-colors duration-150 hover:bg-accent hover:text-accent-foreground cursor-pointer'
  }
} as const;

/**
 * ♿ ACCESSIBILITY-FOCUSED FORM EFFECTS
 * Effects που βελτιώνουν accessibility
 */
export const ACCESSIBLE_FORM_EFFECTS = {
  /** Focus visible για keyboard navigation */
  KEYBOARD_FOCUS: 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all duration-200',

  /** High contrast mode support */
  HIGH_CONTRAST_MODE: 'contrast-more:border-2 contrast-more:border-current',

  /** Screen reader only transitions */
  SR_ONLY_TRANSITION: 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 transition-all duration-200',

  /** Error announcement animation */
  ERROR_ANNOUNCE: 'animate-in fade-in duration-300 role-alert',

  /** Success announcement animation */
  SUCCESS_ANNOUNCE: 'animate-in fade-in duration-300 role-status'
} as const;

/**
 * 💡 UTILITY FUNCTIONS
 * Helper functions για dynamic form effects
 */
export const createFormFieldEffect = (
  state: 'DEFAULT' | 'ERROR' | 'SUCCESS' | 'WARNING' | 'DISABLED' = 'DEFAULT',
  enhanced: boolean = false
): string => {
  const baseEffect = FORM_STATE_EFFECTS[state];
  const focusEffect = enhanced ? FORM_FOCUS_EFFECTS.ENHANCED : FORM_FOCUS_EFFECTS.STANDARD;
  const hoverEffect = state === 'DISABLED' ? FORM_HOVER_EFFECTS.DISABLED : FORM_HOVER_EFFECTS.STANDARD;

  return `${baseEffect} ${focusEffect} ${hoverEffect}`;
};

export const createFormButtonEffect = (
  variant: keyof typeof FORM_BUTTON_EFFECTS = 'PRIMARY',
  size: 'sm' | 'md' | 'lg' = 'md'
): string => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return `${FORM_BUTTON_EFFECTS[variant]} ${sizeClasses[size]}`;
};

/**
 * 🎯 EXPORT EVERYTHING
 */
export const FORM_EFFECTS = {
  FOCUS: FORM_FOCUS_EFFECTS,
  HOVER: FORM_HOVER_EFFECTS,
  STATE: FORM_STATE_EFFECTS,
  BUTTON: FORM_BUTTON_EFFECTS,
  VALIDATION: VALIDATION_FEEDBACK_EFFECTS,
  GROUP: FORM_GROUP_EFFECTS,
  LABEL: FORM_LABEL_EFFECTS,
  COMPLEX: COMPLEX_FORM_EFFECTS,
  ACCESSIBLE: ACCESSIBLE_FORM_EFFECTS,
  createField: createFormFieldEffect,
  createButton: createFormButtonEffect
} as const;

export default FORM_EFFECTS;