// ============================================================================
// 📱 ENTERPRISE SOCIAL PLATFORM EFFECTS SYSTEM
// ============================================================================
//
// ✨ Centralized hover effects για social media platforms
// Brand-consistent colors και animations
// Based on official platform design guidelines
//
// 🏢 ENTERPRISE: Integrated με centralized border token system
// ============================================================================

import { useBorderTokens } from '../../../hooks/useBorderTokens';

/**
 * 🎨 SOCIAL PLATFORM BRAND COLORS
 * Official brand colors για consistent theming
 */
export const SOCIAL_BRAND_COLORS = {
  FACEBOOK: {
    PRIMARY: '#1877f2',
    HOVER: '#166fe5',
    SHADOW: 'rgba(24, 119, 242, 0.3)'
  },

  TWITTER: {
    PRIMARY: '#1da1f2',
    HOVER: '#1991db',
    SHADOW: 'rgba(29, 161, 242, 0.3)'
  },

  LINKEDIN: {
    PRIMARY: '#0077b5',
    HOVER: '#006399',
    SHADOW: 'rgba(0, 119, 181, 0.3)'
  },

  INSTAGRAM: {
    PRIMARY: '#e4405f',
    HOVER: '#d62d4a',
    SHADOW: 'rgba(228, 64, 95, 0.3)'
  },

  YOUTUBE: {
    PRIMARY: '#ff0000',
    HOVER: '#e60000',
    SHADOW: 'rgba(255, 0, 0, 0.3)'
  },

  WHATSAPP: {
    PRIMARY: '#25d366',
    HOVER: '#22c35c',
    SHADOW: 'rgba(37, 211, 102, 0.3)'
  },

  TELEGRAM: {
    PRIMARY: '#0088cc',
    HOVER: '#007bb5',
    SHADOW: 'rgba(0, 136, 204, 0.3)'
  },

  GITHUB: {
    PRIMARY: '#333333',
    HOVER: '#24292e',
    SHADOW: 'rgba(51, 51, 51, 0.3)'
  },

  EMAIL: {
    PRIMARY: '#ea4335',
    HOVER: '#d33b2c',
    SHADOW: 'rgba(234, 67, 53, 0.3)'
  }
} as const;

/**
 * 🔄 LEGACY: SOCIAL PLATFORM HOVER EFFECTS (Deprecated)
 * @deprecated Use createEnterpriseSocialHoverEffects(borderTokens) instead
 * Platform-specific hover patterns με brand colors
 * Kept for backward compatibility - will be removed in v2.0
 */
export const SOCIAL_HOVER_EFFECTS = {
  FACEBOOK: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-600 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300'
  },

  TWITTER: {
    BUTTON: 'hover:shadow-lg hover:shadow-sky-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-sky-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/20 transition-all duration-300'
  },

  LINKEDIN: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-700/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-700 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-blue-700/50 hover:shadow-lg hover:shadow-blue-700/20 transition-all duration-300'
  },

  INSTAGRAM: {
    BUTTON: 'hover:shadow-lg hover:shadow-pink-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-pink-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/20 transition-all duration-300'
  },

  YOUTUBE: {
    BUTTON: 'hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-red-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300'
  },

  WHATSAPP: {
    BUTTON: 'hover:shadow-lg hover:shadow-green-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-green-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300'
  },

  TELEGRAM: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300'
  },

  GITHUB: {
    BUTTON: 'hover:shadow-lg hover:shadow-gray-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-gray-900 hover:scale-110 transition-all duration-200 dark:hover:text-gray-100',
    CARD: 'hover:border-border/50 hover:shadow-lg hover:shadow-gray-500/20 transition-all duration-300'
  },

  EMAIL: {
    BUTTON: 'hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-red-500 hover:scale-110 transition-all duration-200',
    CARD: 'hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300'
  }
} as const;

/**
 * 🎭 SOCIAL INTERACTION PATTERNS
 * Common interaction patterns για social features
 */
export const SOCIAL_INTERACTION_PATTERNS = {
  /** Share button hover */
  SHARE_BUTTON: 'transition-all duration-200 hover:scale-105 hover:shadow-lg hover:-translate-y-1',

  /** Like/Heart button hover */
  LIKE_BUTTON: 'transition-all duration-200 hover:scale-110 hover:text-red-500',

  /** Follow button hover */
  FOLLOW_BUTTON: 'transition-all duration-200 hover:scale-105 hover:shadow-md',

  /** Social profile card hover */
  PROFILE_CARD: 'transition-all duration-300 hover:scale-102 hover:shadow-xl hover:-translate-y-1',

  /** Social feed item hover */
  FEED_ITEM: 'transition-all duration-200 hover:bg-accent/50 hover:shadow-md',

  /** Comment hover */
  COMMENT_HOVER: 'transition-colors duration-150 hover:bg-accent/30',

  /** Social notification hover */
  NOTIFICATION: 'transition-all duration-200 hover:bg-accent hover:scale-102',

  /** Social avatar hover */
  AVATAR: 'transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-primary hover:ring-offset-2'
} as const;

/**
 * 🚀 UNIFIED SOCIAL SHARING PATTERNS
 * Ready-to-use patterns για social sharing components
 */
export const SOCIAL_SHARING_PATTERNS = {
  /** Standard sharing grid */
  SHARING_GRID: 'transition-all duration-200 hover:scale-105 hover:shadow-lg hover:-translate-y-1',

  /** Floating share button */
  FLOATING_SHARE: 'transition-all duration-300 hover:scale-110 hover:shadow-xl hover:rotate-1',

  /** Inline share button */
  INLINE_SHARE: 'transition-all duration-200 hover:scale-105 hover:shadow-md',

  /** Share dropdown item */
  DROPDOWN_ITEM: 'transition-all duration-150 hover:bg-accent hover:text-accent-foreground hover:pl-4',

  /** Share modal trigger */
  MODAL_TRIGGER: 'transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground'
} as const;

/**
 * 📊 GROUP HOVER EFFECTS για social containers
 * Parent-child interaction patterns
 */
export const SOCIAL_GROUP_EFFECTS = {
  /** When hovering social card, highlight icons */
  CARD_GROUP: {
    CONTAINER: 'group transition-all duration-300 hover:shadow-lg hover:scale-102',
    ICONS: 'group-hover:scale-110 group-hover:opacity-80 transition-all duration-200',
    ACTIONS: 'group-hover:translate-x-1 transition-transform duration-200'
  },

  /** Social platform grid effects */
  PLATFORM_GRID: {
    CONTAINER: 'group transition-all duration-200',
    ICON: 'group-hover:scale-110 transition-transform duration-200',
    LABEL: 'group-hover:text-primary transition-colors duration-200'
  },

  /** Social profile hover effects */
  PROFILE_GROUP: {
    CONTAINER: 'group transition-all duration-300 hover:shadow-xl',
    AVATAR: 'group-hover:scale-105 transition-transform duration-200',
    INFO: 'group-hover:translate-x-2 transition-transform duration-200',
    BADGE: 'group-hover:scale-110 transition-transform duration-200'
  }
} as const;

/**
 * 🎨 PLATFORM-SPECIFIC ICON EFFECTS
 * Specialized hover effects για each platform's iconography
 */
export const PLATFORM_ICON_EFFECTS = {
  /** Standard icon hover με platform colors */
  STANDARD: (platform: keyof typeof SOCIAL_HOVER_EFFECTS) =>
    `${SOCIAL_HOVER_EFFECTS[platform].ICON}`,

  /** Pulsating effect για notifications */
  PULSE: 'hover:animate-pulse hover:scale-110 transition-all duration-200',

  /** Bounce effect για playful interactions */
  BOUNCE: 'hover:animate-bounce hover:scale-105 transition-all duration-200',

  /** Rotate effect για share icons */
  ROTATE: 'hover:rotate-12 hover:scale-110 transition-all duration-200',

  /** Glow effect για premium platforms */
  GLOW: 'hover:drop-shadow-lg hover:scale-110 transition-all duration-300'
} as const;

/**
 * 💡 UTILITY FUNCTIONS
 * Helper functions για dynamic social effects
 */
export const createSocialEffect = (
  platform: keyof typeof SOCIAL_HOVER_EFFECTS,
  type: 'BUTTON' | 'ICON' | 'CARD' = 'BUTTON'
): string => {
  return SOCIAL_HOVER_EFFECTS[platform][type];
};

export const createCustomSocialEffect = (
  color: string,
  shadowOpacity: number = 0.3,
  scale: number = 1.05
): string => {
  return `hover:shadow-lg hover:shadow-${color}/${Math.round(shadowOpacity * 100)} hover:scale-${Math.round(scale * 100)} transition-all duration-200`;
};

// ============================================================================
// 🏢 ENTERPRISE FACTORY FUNCTIONS
// ============================================================================

/**
 * 🎯 Enterprise Social Hover Effects Factory
 * Creates social platform effects using centralized border tokens
 */
export const createEnterpriseSocialHoverEffects = (borderTokens: ReturnType<typeof useBorderTokens>) => ({
  FACEBOOK: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-600 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('info')}/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300`
  },

  TWITTER: {
    BUTTON: 'hover:shadow-lg hover:shadow-sky-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-sky-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('info')}/50 hover:shadow-lg hover:shadow-sky-500/20 transition-all duration-300`
  },

  LINKEDIN: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-700/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-700 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('info')}/50 hover:shadow-lg hover:shadow-blue-700/20 transition-all duration-300`
  },

  INSTAGRAM: {
    BUTTON: 'hover:shadow-lg hover:shadow-pink-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-pink-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('warning')}/50 hover:shadow-lg hover:shadow-pink-500/20 transition-all duration-300`
  },

  YOUTUBE: {
    BUTTON: 'hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-red-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('error')}/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300`
  },

  WHATSAPP: {
    BUTTON: 'hover:shadow-lg hover:shadow-green-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-green-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('success')}/50 hover:shadow-lg hover:shadow-green-500/20 transition-all duration-300`
  },

  TELEGRAM: {
    BUTTON: 'hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-blue-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('info')}/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300`
  },

  GITHUB: {
    BUTTON: 'hover:shadow-lg hover:shadow-gray-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-gray-700 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('muted')}/50 hover:shadow-lg hover:shadow-gray-500/20 transition-all duration-300`
  },

  PINTEREST: {
    BUTTON: 'hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200',
    ICON: 'hover:text-red-500 hover:scale-110 transition-all duration-200',
    CARD: `hover:${borderTokens.getStatusBorder('error')}/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300`
  }
});

/**
 * 🎯 EXPORT EVERYTHING
 */
export const SOCIAL_EFFECTS = {
  COLORS: SOCIAL_BRAND_COLORS,
  HOVER: SOCIAL_HOVER_EFFECTS,
  INTERACTIONS: SOCIAL_INTERACTION_PATTERNS,
  SHARING: SOCIAL_SHARING_PATTERNS,
  GROUP: SOCIAL_GROUP_EFFECTS,
  ICONS: PLATFORM_ICON_EFFECTS,
  createEffect: createSocialEffect,
  createCustom: createCustomSocialEffect
} as const;

export default SOCIAL_EFFECTS;