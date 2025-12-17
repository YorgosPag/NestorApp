/**
 * 🔧 SHARED CONSTANTS - ENTERPRISE FOUNDATION
 *
 * @description Centralized constants για αποφυγή circular dependencies.
 * Αυτό το αρχείο περιέχει μόνο constants που χρησιμοποιούνται από πολλαπλά modules.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Foundation
 *
 * 🚨 CRITICAL: Αυτό το αρχείο ΔΕΝ πρέπει να εισάγει τίποτα από άλλα design-token modules
 * για να αποφύγουμε circular dependencies!
 */

// ============================================================================
// BORDER RADIUS CONSTANTS
// ============================================================================

export const BORDER_RADIUS = {
  none: '0',
  sm: '0.125rem',    // 2px
  base: '0.25rem',   // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px'
} as const;

// ============================================================================
// SHADOWS CONSTANTS
// ============================================================================

export const SHADOWS = {
  // Box shadows για elevation
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)'
} as const;

// ============================================================================
// TRANSITIONS CONSTANTS
// ============================================================================

export const TRANSITIONS = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms'
  },
  easing: {
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear'
  },
  // Common transition combinations
  smooth: '200ms cubic-bezier(0, 0, 0.2, 1)',
  quickFade: '150ms cubic-bezier(0, 0, 0.2, 1)',
  slideUp: '300ms cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

export const ANIMATION = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '1000ms'
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    linear: 'linear',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },
  // Keyframe names
  keyframes: {
    spin: 'spin',
    pulse: 'pulse',
    bounce: 'bounce',
    fadeIn: 'fadeIn',
    slideIn: 'slideIn'
  }
} as const;

// ============================================================================
// Z-INDEX CONSTANTS
// ============================================================================

export const Z_INDEX = {
  hide: -1,
  auto: 'auto' as const,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1020,
  banner: 1030,
  overlay: 1400,
  modal: 1500,
  popover: 1600,
  skipLink: 1700,
  toast: 1800,
  tooltip: 1900
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BorderRadius = typeof BORDER_RADIUS;
export type Shadows = typeof SHADOWS;
export type Transitions = typeof TRANSITIONS;
export type Animation = typeof ANIMATION;
export type ZIndex = typeof Z_INDEX;

/**
 * ✅ SHARED CONSTANTS MODULE COMPLETE
 *
 * Features:
 * 1. ✅ Centralized constants για αποφυγή circular dependencies
 * 2. ✅ Border radius constants για consistent rounded corners
 * 3. ✅ Shadows constants για elevation consistency
 * 4. ✅ Transitions constants για smooth animations
 * 5. ✅ Animation constants για keyframe animations
 * 6. ✅ Z-index constants για proper layering
 * 7. ✅ Full TypeScript support με exported types
 * 8. ✅ Enterprise documentation standards
 *
 * Design Principles:
 * - ⚡ Zero dependencies (no imports από άλλα modules)
 * - 🔄 Single source of truth για common constants
 * - 🏢 Enterprise naming conventions
 * - 📏 Consistent value scales (powers of 2, rem units)
 * - 🎯 Professional animation curves
 *
 * Usage:
 * ```typescript
 * import { BORDER_RADIUS, SHADOWS, Z_INDEX } from '@/styles/design-tokens/constants/shared-constants';
 *
 * const myStyles = {
 *   borderRadius: BORDER_RADIUS.md,
 *   boxShadow: SHADOWS.lg,
 *   zIndex: Z_INDEX.modal
 * };
 * ```
 *
 * Result: Bulletproof constants architecture με zero circular dependencies
 */