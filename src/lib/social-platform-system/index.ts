// ============================================================================
// 🏢 ENTERPRISE SOCIAL PLATFORM SYSTEM - UNIFIED EXPORTS
// ============================================================================
//
// 🎯 PURPOSE: Single entry point για ΟΛΟΚΛΗΡΟ το social platform system
// 🔗 REPLACES: Multiple scattered imports across the application
// 🏢 STANDARDS: Enterprise barrel pattern, clean API surface
//
// 📋 UNIFIED SYSTEM INCLUDES:
// - Platform configurations & definitions
// - External sharing services
// - Social profile management
// - Analytics & UTM tracking
// - Backwards compatibility layers
//
// ============================================================================

import { PRODUCT_NAME } from '@/constants/product-identity';

// ============================================================================
// PLATFORM CONFIGURATION EXPORTS
// ============================================================================

// Core platform definitions και utilities
export {
  // Platform types
  type SocialPlatformType,
  type PlatformCapabilities,
  type PlatformUIConfig,
  type PlatformUrlConfig,
  type UnifiedSocialPlatform,

  // Platform data
  UNIFIED_SOCIAL_PLATFORMS,

  // Platform utilities
  getPlatformById,
  getAllPlatforms,
  getSharingPlatforms,
  getProfilePlatforms,
  getMobilePlatforms,
  getMediaSupportingPlatforms,
  getEmailRequiredPlatforms,
  isValidPlatform,
  detectPlatformFromUrl,

  // Platform icons
  WhatsAppIcon,
  FacebookIcon,
  TwitterIcon,
  LinkedInIcon,
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  GitHubIcon,
  TikTokIcon,
} from './platform-config';

export { SOCIAL_BRAND_COLORS, type SocialBrandKey } from './brand-colors';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('social-platform-system');

// ============================================================================
// SHARING SERVICE EXPORTS
// ============================================================================

// Core sharing functionality
export {
  // Service class
  SharingService,

  // Types για sharing
  type ShareData,
  type ShareOptions,
  type PropertyShareData,
  type PhotoShareData,
  type ShareResult,

  // Core methods
  buildPlatformShareUrl,
  shareContent,
  copyToClipboard,
  isWebShareSupported,

  // Legacy compatibility functions
  getSocialShareUrls,
  getPhotoSocialShareUrls,
} from './sharing-service';

// ============================================================================
// PROFILE SERVICE EXPORTS
// ============================================================================

// Social profile management
export {
  // Service class
  ProfileService,

  // Types για profiles
  type SocialProfile,
  type ProfileValidationResult,
  type ProfileGenerationOptions,
  type BulkProfileResult,

  // Core methods
  generateSocialUrl,
  validateSocialUrl,
  extractUsernameFromSocialUrl,
  getSupportedSocialPlatforms,

  // Legacy compatibility
  SOCIAL_URL_TEMPLATES,
  SOCIAL_URL_PLACEHOLDERS,
  type SocialPlatform,
} from './profile-service';

// ============================================================================
// ANALYTICS SERVICE EXPORTS
// ============================================================================

// Analytics και tracking functionality
export {
  // Service class
  AnalyticsService,

  // Types για analytics
  type UtmParameters,
  type ShareAnalyticsEvent,
  type CampaignConfig,
  type UrlGenerationOptions,
  type AnalyticsSummary,

  // Core methods
  generateShareableURL,
  trackShareEvent,
} from './analytics-service';

// ============================================================================
// CONVENIENCE RE-EXPORTS - HIGH-LEVEL API
// ============================================================================

/**
 * 🎯 High-Level Social Platform System API
 *
 * Enterprise-grade convenience API που συνδυάζει όλα τα services
 * για common use cases
 */

// Re-export services με consistent naming
import SharingServiceClass from './sharing-service';
import ProfileServiceClass from './profile-service';
import AnalyticsServiceClass from './analytics-service';

export const SocialPlatforms = {
  // Platform information
  platforms: UNIFIED_SOCIAL_PLATFORMS,

  // Service access
  sharing: SharingServiceClass,
  profiles: ProfileServiceClass,
  analytics: AnalyticsServiceClass,

  // Quick access utilities
  utils: {
    // Platform utilities
    getPlatform: getPlatformById,
    getAllPlatforms,
    getSharingPlatforms,
    getProfilePlatforms,

    // Common operations
    buildShareUrl: SharingServiceClass.buildPlatformShareUrl,
    generateProfileUrl: ProfileServiceClass.generateProfileUrl,
    trackShare: AnalyticsServiceClass.trackShareEvent,
    generateTrackingUrl: AnalyticsServiceClass.generateShareableUrl,

    // Validation
    validatePlatform: isValidPlatform,
    validateProfileUrl: ProfileServiceClass.validateProfileUrl,
    detectPlatform: detectPlatformFromUrl,
  }
};

// Import platform utilities
import {
  UNIFIED_SOCIAL_PLATFORMS,
  getPlatformById,
  getAllPlatforms,
  getSharingPlatforms,
  getProfilePlatforms,
  isValidPlatform,
  detectPlatformFromUrl
} from './platform-config';

// NOTE: SOCIAL_BRAND_COLORS + SocialBrandKey already exported at line 57

// ============================================================================
// BACKWARDS COMPATIBILITY LAYER
// ============================================================================

/**
 * 🔄 Legacy API Compatibility
 *
 * Maintains compatibility με existing code που χρησιμοποιεί
 * the old scattered systems
 */

// Legacy SocialSharingPlatforms.tsx compatibility
export const SOCIAL_SHARING_PLATFORMS = getSharingPlatforms();
export const generatePlatformButtonStyles = (platform: string, variant: string) => {
  // Legacy function - would need actual implementation
  logger.warn('generatePlatformButtonStyles is deprecated, use unified platform system');
  return '';
};

// Legacy share-utils.ts compatibility
export { type ShareData as LegacyShareData } from './sharing-service';
export { type UtmParameters as UTMParams } from './analytics-service';

// Property sharing compatibility
export const shareProperty = SharingServiceClass.shareProperty;

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * 🚀 Migration Utilities
 *
 * Helpers για migrating από old scattered systems
 * προς το unified system
 */
export const MigrationHelpers = {
  /**
   * Map legacy platform IDs προς unified system
   */
  mapLegacyPlatformId: (legacyId: string): string | null => {
    const mapping: Record<string, string> = {
      'fb': 'facebook',
      'tw': 'twitter',
      'li': 'linkedin',
      'ig': 'instagram',
      'yt': 'youtube',
      'gh': 'github',
      'tt': 'tiktok',
      'wa': 'whatsapp',
      'tg': 'telegram'
    };

    return mapping[legacyId] || legacyId;
  },

  /**
   * Convert legacy share options προς unified format
   */
  convertLegacyShareOptions: (legacyOptions: { source?: string; medium?: string; campaign?: string }) => {
    return {
      utm: {
        source: legacyOptions.source || 'legacy',
        medium: legacyOptions.medium || 'social',
        campaign: legacyOptions.campaign || 'migration'
      }
    };
  },

  /**
   * Validate migration readiness
   */
  validateMigrationReadiness: (): boolean => {
    try {
      // Check core services
      const sharing = SharingServiceClass;
      const profiles = ProfileServiceClass;
      const analytics = AnalyticsServiceClass;

      // Verify essential methods exist
      return (
        typeof sharing.buildPlatformShareUrl === 'function' &&
        typeof profiles.generateProfileUrl === 'function' &&
        typeof analytics.trackShareEvent === 'function'
      );
    } catch (error) {
      logger.error('Migration validation failed', { error });
      return false;
    }
  }
};

// ============================================================================
// DEFAULT EXPORT - MAIN API
// ============================================================================

/**
 * 🏢 Default Export - Enterprise Social Platform System
 *
 * Main entry point για το unified social platform system
 */
const SocialPlatformSystem = {
  // Core services
  Sharing: SharingServiceClass,
  Profiles: ProfileServiceClass,
  Analytics: AnalyticsServiceClass,

  // High-level API
  ...SocialPlatforms,

  // Migration tools
  Migration: MigrationHelpers,

  // System info
  version: '1.0.0',
  description: 'Enterprise Social Platform System - Unified social media management'
};

export default SocialPlatformSystem;

// ============================================================================
// TYPE EXPORTS - CLEAN TYPE API
// ============================================================================

// ✅ FIXED: All types εξάγονται ήδη στα προηγούμενα export blocks
// Δεν χρειάζεται duplicate export block εδώ

// ============================================================================
// DOCUMENTATION EXPORTS
// ============================================================================

/**
 * 📚 System Documentation
 *
 * Inline documentation για development
 */
export const SYSTEM_DOCUMENTATION = {
  overview: `Enterprise Social Platform System - Unified social media management for ${PRODUCT_NAME}`,

  features: [
    'Unified platform definitions and configurations',
    'External content sharing (properties, photos, articles)',
    'Social media profile management για contacts',
    'Advanced analytics and UTM tracking',
    'Backwards compatibility με existing code',
    'Enterprise-grade TypeScript support'
  ],

  architecture: {
    'platform-config.ts': 'Core platform definitions, icons, και configurations',
    'sharing-service.ts': 'External sharing functionality και URL building',
    'profile-service.ts': 'Contact social media profile management',
    'analytics-service.ts': 'UTM tracking, analytics, και campaign management',
    'index.ts': 'Unified exports και high-level API'
  },

  migration: {
    from: [
      'src/lib/social-sharing/SocialSharingPlatforms.tsx',
      'src/components/contacts/dynamic/communication/utils/socialUrlGenerator.ts',
      'src/lib/share-utils.ts (partial)',
      'src/components/ui/ShareButton.tsx (business logic)'
    ],
    to: 'src/lib/social-platform-system/',
    benefits: [
      'Single source of truth',
      'Eliminated code duplication',
      'Better TypeScript support',
      'Centralized analytics',
      'Easier maintenance',
      'Enterprise architecture'
    ]
  }
};

