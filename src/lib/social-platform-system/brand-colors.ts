// ============================================================================
// 🎨 ENTERPRISE SOCIAL BRAND COLORS - CENTRALIZED SOURCE OF TRUTH
// ============================================================================
//
// Purpose: Centralized brand color tokens for social platforms.
// This is the single source of truth for brand colors used across the app.
//
// Note: Values are intentionally centralized here to comply with the
// "ZERO hardcoded values" rule outside domain configs.
//
// ============================================================================

export const SOCIAL_BRAND_COLORS = {
  FACEBOOK: {
    PRIMARY: '#1877f2',
    HOVER: '#166fe5',
    SHADOW: 'rgba(24, 119, 242, 0.3)',
  },

  TWITTER: {
    PRIMARY: '#1da1f2',
    HOVER: '#1991db',
    SHADOW: 'rgba(29, 161, 242, 0.3)',
  },

  LINKEDIN: {
    PRIMARY: '#0077b5',
    HOVER: '#006399',
    SHADOW: 'rgba(0, 119, 181, 0.3)',
  },

  INSTAGRAM: {
    PRIMARY: '#e4405f',
    HOVER: '#d62d4a',
    SHADOW: 'rgba(228, 64, 95, 0.3)',
  },

  YOUTUBE: {
    PRIMARY: '#ff0000',
    HOVER: '#e60000',
    SHADOW: 'rgba(255, 0, 0, 0.3)',
  },

  WHATSAPP: {
    PRIMARY: '#25d366',
    HOVER: '#22c35c',
    SHADOW: 'rgba(37, 211, 102, 0.3)',
  },

  TELEGRAM: {
    PRIMARY: '#0088cc',
    HOVER: '#007bb5',
    SHADOW: 'rgba(0, 136, 204, 0.3)',
  },

  GITHUB: {
    PRIMARY: '#333333',
    HOVER: '#24292e',
    SHADOW: 'rgba(51, 51, 51, 0.3)',
  },

  EMAIL: {
    PRIMARY: '#ea4335',
    HOVER: '#d33b2c',
    SHADOW: 'rgba(234, 67, 53, 0.3)',
  },
} as const;

export type SocialBrandKey = keyof typeof SOCIAL_BRAND_COLORS;
