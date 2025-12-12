// ============================================================================
// 🎯 ENTERPRISE UI EFFECTS - CENTRAL EXPORT HUB
// ============================================================================
//
// ✨ Single source of truth για όλα τα UI effects
// Clean imports και enterprise-grade organization
// Centralized από 374 αρχεία με διάσπαρτα hover patterns
//
// ============================================================================

/**
 * 📦 INDIVIDUAL EFFECT SYSTEMS
 * Import από specialized modules
 */
export { default as UI_HOVER_EFFECTS } from './hover-effects';
export { default as TRANSITIONS } from './transitions';
export { default as SOCIAL_EFFECTS } from './social-effects';
export { default as FORM_EFFECTS } from './form-effects';

/**
 * 🎨 RE-EXPORTS για convenience
 * Common patterns που χρησιμοποιούνται πολύ συχνά
 */
export {
  CORE_HOVER_TRANSFORMS,
  HOVER_SHADOWS,
  INTERACTIVE_PATTERNS,
  COMPLEX_HOVER_EFFECTS,
  createCustomHoverEffect
} from './hover-effects';

export {
  TRANSITION_DURATIONS,
  TRANSITION_PRESETS,
  CONTEXT_TRANSITIONS,
  createCustomTransition
} from './transitions';

export {
  SOCIAL_HOVER_EFFECTS,
  SOCIAL_INTERACTION_PATTERNS,
  createSocialEffect
} from './social-effects';

export {
  FORM_FOCUS_EFFECTS,
  FORM_BUTTON_EFFECTS,
  COMPLEX_FORM_EFFECTS,
  createFormFieldEffect,
  createFormButtonEffect
} from './form-effects';

/**
 * 🚀 UNIFIED ENTERPRISE EFFECTS OBJECT
 * Complete access σε όλα τα effect systems
 */
export const ENTERPRISE_EFFECTS = {
  // Hover Effects System
  HOVER: UI_HOVER_EFFECTS,

  // Transition System
  TRANSITIONS,

  // Social Platform Effects
  SOCIAL: SOCIAL_EFFECTS,

  // Form Interaction Effects
  FORMS: FORM_EFFECTS,

  // Quick Access Constants
  QUICK: {
    // Most common hover patterns
    CARD_HOVER: INTERACTIVE_PATTERNS.CARD_STANDARD,
    BUTTON_HOVER: INTERACTIVE_PATTERNS.BUTTON_PRIMARY,
    LINK_HOVER: INTERACTIVE_PATTERNS.LINK_STANDARD,

    // Most common transitions
    FAST_TRANSITION: TRANSITION_PRESETS.FAST_COLORS,
    SMOOTH_TRANSITION: TRANSITION_PRESETS.SMOOTH_ALL,

    // Most common form effects
    INPUT_FOCUS: FORM_FOCUS_EFFECTS.STANDARD,
    BUTTON_PRIMARY: FORM_BUTTON_EFFECTS.PRIMARY,

    // Most common social effects
    SOCIAL_BUTTON: SOCIAL_INTERACTION_PATTERNS.SHARE_BUTTON
  }
} as const;

/**
 * 🎭 COMBINED UTILITY FUNCTIONS
 * High-level utilities που combine multiple systems
 */

/**
 * Create a complete interactive element effect
 * Combines hover, transition, και focus effects
 */
export const createInteractiveEffect = (options: {
  hover?: keyof typeof CORE_HOVER_TRANSFORMS;
  shadow?: 'SUBTLE' | 'ENHANCED' | 'DRAMATIC';
  transition?: 'FAST' | 'STANDARD' | 'SMOOTH';
  focus?: boolean;
}): string => {
  const parts = [];

  // Add transition
  const transitionMap = {
    FAST: TRANSITION_PRESETS.FAST_COLORS,
    STANDARD: TRANSITION_PRESETS.STANDARD_ALL,
    SMOOTH: TRANSITION_PRESETS.SMOOTH_ALL
  };
  parts.push(transitionMap[options.transition || 'STANDARD']);

  // Add hover transform
  if (options.hover) {
    parts.push(CORE_HOVER_TRANSFORMS[options.hover]);
  }

  // Add shadow
  if (options.shadow) {
    parts.push(HOVER_SHADOWS[options.shadow]);
  }

  // Add focus ring
  if (options.focus) {
    parts.push('focus:ring-2 focus:ring-primary focus:ring-offset-2');
  }

  return parts.join(' ');
};

/**
 * Create a social platform button effect
 * Combines platform colors με appropriate hover effects
 */
export const createSocialPlatformEffect = (
  platform: keyof typeof SOCIAL_HOVER_EFFECTS,
  type: 'BUTTON' | 'ICON' | 'CARD' = 'BUTTON'
): string => {
  return SOCIAL_HOVER_EFFECTS[platform][type];
};

/**
 * Create a form field with complete interaction states
 * Combines focus, hover, και state management
 */
export const createFormFieldEffect = (
  state: 'DEFAULT' | 'ERROR' | 'SUCCESS' | 'WARNING' = 'DEFAULT',
  enhanced: boolean = false
): string => {
  return createFormFieldEffect(state, enhanced);
};

/**
 * 📊 EFFECT ANALYTICS & DEBUGGING
 * Utilities για development και debugging
 */
export const EFFECT_ANALYTICS = {
  // Count total available effects
  getTotalEffectsCount: (): number => {
    let total = 0;
    total += Object.keys(CORE_HOVER_TRANSFORMS).length;
    total += Object.keys(HOVER_SHADOWS).length;
    total += Object.keys(INTERACTIVE_PATTERNS).length;
    total += Object.keys(TRANSITION_PRESETS).length;
    total += Object.keys(SOCIAL_HOVER_EFFECTS).length;
    total += Object.keys(FORM_FOCUS_EFFECTS).length;
    return total;
  },

  // List all available effect categories
  getAvailableCategories: (): string[] => [
    'HOVER_TRANSFORMS',
    'HOVER_SHADOWS',
    'INTERACTIVE_PATTERNS',
    'TRANSITIONS',
    'SOCIAL_EFFECTS',
    'FORM_EFFECTS'
  ],

  // Validate effect string
  validateEffect: (effectString: string): boolean => {
    return effectString.includes('transition') ||
           effectString.includes('hover:') ||
           effectString.includes('focus:');
  }
} as const;

/**
 * 🎨 TYPE DEFINITIONS για TypeScript support
 */
export type HoverTransform = keyof typeof CORE_HOVER_TRANSFORMS;
export type HoverShadow = keyof typeof HOVER_SHADOWS;
export type InteractivePattern = keyof typeof INTERACTIVE_PATTERNS;
export type TransitionPreset = keyof typeof TRANSITION_PRESETS;
export type SocialPlatform = keyof typeof SOCIAL_HOVER_EFFECTS;
export type FormEffect = keyof typeof FORM_FOCUS_EFFECTS;

export type InteractiveOptions = {
  hover?: HoverTransform;
  shadow?: 'SUBTLE' | 'ENHANCED' | 'DRAMATIC';
  transition?: 'FAST' | 'STANDARD' | 'SMOOTH';
  focus?: boolean;
};

/**
 * 📝 USAGE EXAMPLES για documentation
 */
export const USAGE_EXAMPLES = {
  // Simple hover effect
  SIMPLE_CARD: INTERACTIVE_PATTERNS.CARD_STANDARD,

  // Complex interactive button
  INTERACTIVE_BUTTON: createInteractiveEffect({
    hover: 'SCALE_UP_SMALL',
    shadow: 'ENHANCED',
    transition: 'SMOOTH',
    focus: true
  }),

  // Social share button
  SOCIAL_SHARE: createSocialPlatformEffect('FACEBOOK', 'BUTTON'),

  // Form input field
  FORM_INPUT: createFormFieldEffect('DEFAULT', true)
} as const;

// Default export για convenience
export default ENTERPRISE_EFFECTS;