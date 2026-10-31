// ============================================================================
// 👤 ENTERPRISE PROFILE SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΔΙΑΧΕΙΡΙΣΗ SOCIAL PROFILES
// ============================================================================
//
// 🎯 PURPOSE: Single source για ΟΛΕΣ τις social profile operations
// 🔗 REPLACES: socialUrlGenerator.ts + scattered profile logic
// 🏢 STANDARDS: Enterprise service layer, centralized profile management
//
// 📋 FEATURES UNIFIED:
// - Social media profile URL generation
// - Username validation & cleaning
// - Platform detection από existing URLs
// - Profile URL validation
// - Contact social media management
//
// ============================================================================

import {
  getProfilePlatforms,
  getPlatformById,
  detectPlatformFromUrl,
  isValidPlatform,
  type SocialPlatformType
} from './platform-config';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('profile-service');

// ============================================================================
// PROFILE SERVICE TYPE DEFINITIONS
// ============================================================================

/**
 * 👤 Social Profile Data
 *
 * Standard interface για contact social media profiles
 */
export interface SocialProfile {
  /** Platform identifier */
  platform: SocialPlatformType;
  /** Username/handle */
  username: string;
  /** Full profile URL */
  url: string;
  /** Display name (optional) */
  displayName?: string;
  /** Profile verification status */
  verified?: boolean;
  /** Last validation timestamp */
  lastValidated?: Date;
}

/**
 * 🔍 Profile Validation Result
 *
 * Result από profile validation operations
 */
export interface ProfileValidationResult {
  /** Is the profile valid */
  isValid: boolean;
  /** Detected platform */
  platform?: SocialPlatformType;
  /** Extracted username */
  username?: string;
  /** Validation error message */
  error?: string;
  /** Suggested corrections */
  suggestions?: string[];
}

/**
 * 📋 Profile Generation Options
 *
 * Options για profile URL generation
 */
export interface ProfileGenerationOptions {
  /** Clean username automatically */
  cleanUsername?: boolean;
  /** Validate platform support */
  validatePlatform?: boolean;
  /** Return validation result instead of throwing */
  returnValidation?: boolean;
  /** Custom username transformations */
  usernameTransform?: (username: string, platform: SocialPlatformType) => string;
}

/**
 * 🔄 Bulk Profile Operations
 *
 * Interface για bulk profile processing
 */
export interface BulkProfileResult {
  /** Successfully processed profiles */
  success: SocialProfile[];
  /** Failed profile attempts */
  failed: {
    platform: SocialPlatformType;
    username: string;
    error: string;
  }[];
  /** Processing summary */
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============================================================================
// ENTERPRISE PROFILE SERVICE - MAIN CLASS
// ============================================================================

/**
 * 🏢 Enterprise Profile Service
 *
 * Single source για όλες τις profile operations
 * Replaces scattered profile functions across multiple files
 */
export class ProfileService {

  /**
   * 🔗 Generate Social Profile URL - CORE METHOD
   *
   * REPLACES: generateSocialUrl από socialUrlGenerator.ts
   * Enhanced με validation και error handling
   *
   * @param platform - Target social media platform
   * @param username - Username/handle
   * @param options - Generation options
   * @returns Generated profile URL ή null αν invalid
   */
  static generateProfileUrl(
    platform: SocialPlatformType | string,
    username: string,
    options: ProfileGenerationOptions = {}
  ): string | null {
    // Validate inputs
    if (!platform || !username?.trim()) {
      return null;
    }

    // Validate platform
    if (!isValidPlatform(platform)) {
      if (options.returnValidation) return null;
      logger.warn(`[ProfileService] Unsupported platform: ${platform}`);
      return null;
    }

    const platformConfig = getPlatformById(platform);
    if (!platformConfig || !platformConfig.capabilities.contactProfiles || !platformConfig.urls.profileTemplate) {
      return null;
    }

    // Clean username αν requested
    const cleanedUsername = options.cleanUsername !== false
      ? this.cleanUsername(username, platform)
      : username.trim();

    // Apply custom transformation αν provided
    const finalUsername = options.usernameTransform
      ? options.usernameTransform(cleanedUsername, platform)
      : cleanedUsername;

    if (!finalUsername) {
      return null;
    }

    // Generate URL using platform template
    return platformConfig.urls.profileTemplate.replace('{username}', finalUsername);
  }

  /**
   * 🧹 Clean Username - UTILITY METHOD
   *
   * REPLACES: Scattered username cleaning logic
   * Standardized username cleaning για όλες τις platforms
   */
  static cleanUsername(username: string, platform: SocialPlatformType): string {
    if (!username?.trim()) return '';

    let cleaned = username.trim();

    // Remove common prefixes
    cleaned = cleaned.replace(/^[@#]/, ''); // Remove @ και # prefixes
    cleaned = cleaned.replace(/^https?:\/\//, ''); // Remove protocol
    cleaned = cleaned.replace(/^www\./, ''); // Remove www

    // Platform-specific cleaning
    switch (platform) {
      case 'linkedin':
        // LinkedIn specific cleaning
        cleaned = cleaned.replace(/linkedin\.com\/in\//, '');
        cleaned = cleaned.replace(/\/$/, ''); // Remove trailing slash
        break;

      case 'twitter':
        // Twitter/X specific cleaning
        cleaned = cleaned.replace(/(?:twitter\.com\/|x\.com\/)/, '');
        cleaned = cleaned.replace(/^@/, '');
        break;

      case 'github':
        // GitHub specific cleaning
        cleaned = cleaned.replace(/github\.com\//, '');
        break;

      case 'youtube':
        // YouTube specific cleaning
        cleaned = cleaned.replace(/youtube\.com\/@/, '');
        cleaned = cleaned.replace(/youtube\.com\/c\//, '');
        cleaned = cleaned.replace(/youtube\.com\/user\//, '');
        break;

      case 'instagram':
        // Instagram specific cleaning
        cleaned = cleaned.replace(/instagram\.com\//, '');
        cleaned = cleaned.replace(/^@/, '');
        break;

      case 'tiktok':
        // TikTok specific cleaning
        cleaned = cleaned.replace(/tiktok\.com\/@/, '');
        cleaned = cleaned.replace(/^@/, '');
        break;

      case 'facebook':
        // Facebook specific cleaning
        cleaned = cleaned.replace(/facebook\.com\//, '');
        break;
    }

    // General cleaning
    cleaned = cleaned.toLowerCase();
    cleaned = cleaned.replace(/[^a-z0-9._-]/g, ''); // Remove invalid characters
    cleaned = cleaned.replace(/^[._-]+|[._-]+$/g, ''); // Remove leading/trailing special chars

    return cleaned;
  }

  /**
   * 🔍 Validate Profile URL - VALIDATION METHOD
   *
   * REPLACES: validateSocialUrl από socialUrlGenerator.ts
   * Enhanced validation με detailed error reporting
   */
  static validateProfileUrl(url: string, expectedPlatform?: SocialPlatformType): ProfileValidationResult {
    if (!url?.trim()) {
      return {
        isValid: false,
        error: 'URL is empty'
      };
    }

    try {
      const urlObj = new URL(url);
      const detectedPlatform = detectPlatformFromUrl(url);

      if (!detectedPlatform) {
        return {
          isValid: false,
          error: 'Unknown social media platform',
          suggestions: ['Supported platforms: LinkedIn, Facebook, Instagram, Twitter, YouTube, GitHub, TikTok']
        };
      }

      // Check αν matches expected platform
      if (expectedPlatform && detectedPlatform !== expectedPlatform) {
        return {
          isValid: false,
          platform: detectedPlatform,
          error: `Expected ${expectedPlatform}, but detected ${detectedPlatform}`,
          suggestions: [`Update the platform to ${detectedPlatform} or correct the URL`]
        };
      }

      // Extract username
      const username = this.extractUsernameFromUrl(url);

      return {
        isValid: true,
        platform: detectedPlatform,
        username: username
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format',
        suggestions: ['Ensure the URL is properly formatted (e.g., https://linkedin.com/in/username)']
      };
    }
  }

  /**
   * 🔧 Extract Username από URL - REVERSE OPERATION
   *
   * REPLACES: extractUsernameFromSocialUrl από socialUrlGenerator.ts
   * Enhanced με better parsing για όλες τις platforms
   */
  static extractUsernameFromUrl(url: string): string {
    if (!url?.trim()) return '';

    try {
      const urlObj = new URL(url);
      const platform = detectPlatformFromUrl(url);

      if (!platform) return '';

      // Platform-specific extraction
      switch (platform) {
        case 'linkedin':
          // LinkedIn: /in/username
          const linkedInMatch = urlObj.pathname.match(/\/in\/([^\/]+)/);
          return linkedInMatch?.[1] || '';

        case 'youtube':
          // YouTube: /@username, /c/channel, /user/username
          if (urlObj.pathname.includes('/@')) {
            return urlObj.pathname.replace('/+', '').split('/')[1] || '';
          }
          if (urlObj.pathname.includes('/c/') || urlObj.pathname.includes('/user/')) {
            return urlObj.pathname.split('/')[2] || '';
          }
          return '';

        case 'github':
        case 'facebook':
        case 'instagram':
        case 'twitter':
        case 'tiktok':
          // Standard format: /username
          const pathSegments = urlObj.pathname.split('/').filter(Boolean);

          // Handle TikTok @username format
          if (platform === 'tiktok' && pathSegments[0]?.startsWith('@')) {
            return pathSegments[0].substring(1);
          }

          return pathSegments[0] || '';

        default:
          return '';
      }
    } catch {
      return '';
    }
  }

  /**
   * 👤 Create Social Profile - FACTORY METHOD
   *
   * Creates a complete SocialProfile object με validation
   */
  static createSocialProfile(
    platform: SocialPlatformType,
    username: string,
    options: ProfileGenerationOptions = {}
  ): SocialProfile | null {
    const url = this.generateProfileUrl(platform, username, options);

    if (!url) return null;

    const validation = this.validateProfileUrl(url, platform);

    if (!validation.isValid) return null;

    const platformConfig = getPlatformById(platform);

    return {
      platform,
      username: validation.username || this.cleanUsername(username, platform),
      url,
      displayName: platformConfig?.ui.name,
      lastValidated: new Date()
    };
  }

  /**
   * 📋 Get Supported Profile Platforms
   *
   * Returns platforms that support contact profiles
   */
  static getSupportedProfilePlatforms(): SocialPlatformType[] {
    return getProfilePlatforms().map(platform => platform.id);
  }

  /**
   * 🔄 Bulk Generate Profiles - BATCH OPERATION
   *
   * Process multiple profiles in one operation
   */
  static bulkGenerateProfiles(
    profiles: Array<{ platform: SocialPlatformType; username: string }>,
    options: ProfileGenerationOptions = {}
  ): BulkProfileResult {
    const result: BulkProfileResult = {
      success: [],
      failed: [],
      summary: { total: profiles.length, successful: 0, failed: 0 }
    };

    for (const { platform, username } of profiles) {
      const profile = this.createSocialProfile(platform, username, options);

      if (profile) {
        result.success.push(profile);
        result.summary.successful++;
      } else {
        result.failed.push({
          platform,
          username,
          error: 'Failed to generate valid profile'
        });
        result.summary.failed++;
      }
    }

    return result;
  }

  /**
   * 🔍 Find Platform από Partial URL
   *
   * Helper για auto-detection από incomplete URLs
   */
  static findPlatformFromPartialUrl(partialUrl: string): SocialPlatformType | null {
    if (!partialUrl?.trim()) return null;

    // Try to construct a full URL αν needed
    let testUrl = partialUrl;
    if (!testUrl.startsWith('http')) {
      testUrl = `https://${testUrl}`;
    }

    // Η ΜΙΑ ανίχνευση δεν πετά ποτέ (επιστρέφει `null`)· εδώ ζούσε catch με τρίτο σώμα substring — νεκρό (ADR-327 §8.5.4).
    return detectPlatformFromUrl(testUrl);
  }

  /**
   * 📊 Get Platform Statistics
   *
   * Returns usage statistics για profile platforms
   */
  static getPlatformStatistics(): Record<SocialPlatformType, {
    name: string;
    supportsProfiles: boolean;
    templatePattern: string;
  }> {
    const stats = {} as Record<SocialPlatformType, {
      name: string;
      supportsProfiles: boolean;
      templatePattern: string;
    }>;

    const profilePlatforms = getProfilePlatforms();

    for (const platform of profilePlatforms) {
      stats[platform.id] = {
        name: platform.ui.name,
        supportsProfiles: platform.capabilities.contactProfiles,
        templatePattern: platform.urls.profileTemplate || 'N/A'
      };
    }

    return stats;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * 🔗 Generate Social URL - Function Export
 *
 * BACKWARDS COMPATIBLE με existing socialUrlGenerator.ts code
 */
export const generateSocialUrl = ProfileService.generateProfileUrl;

/**
 * 🔍 Validate Social URL - Function Export
 *
 * BACKWARDS COMPATIBLE με existing socialUrlGenerator.ts code
 */
export const validateSocialUrl = (url: string, platform?: SocialPlatformType): boolean => {
  const result = ProfileService.validateProfileUrl(url, platform);
  return result.isValid;
};

/**
 * 🔧 Extract Username από Social URL - Function Export
 *
 * BACKWARDS COMPATIBLE με existing socialUrlGenerator.ts code
 */
export const extractUsernameFromSocialUrl = ProfileService.extractUsernameFromUrl;

/**
 * 📋 Get Supported Social Platforms - Function Export
 *
 * BACKWARDS COMPATIBLE με existing socialUrlGenerator.ts code
 */
export const getSupportedSocialPlatforms = ProfileService.getSupportedProfilePlatforms;

// ✅ FIXED: detectPlatformFromUrl εξάγεται ήδη από το import στο top
// Δεν χρειάζεται duplicate export εδώ

// ============================================================================
// LEGACY COMPATIBILITY - MIGRATION HELPERS
// ============================================================================

/**
 * 🔄 SOCIAL_URL_TEMPLATES - LEGACY COMPATIBILITY
 *
 * REPLACES: SOCIAL_URL_TEMPLATES από socialUrlGenerator.ts
 * Provides same interface για existing code
 */
export const SOCIAL_URL_TEMPLATES: Record<string, string> = {};
export const SOCIAL_URL_PLACEHOLDERS: Record<string, string> = {};

// Populate legacy objects από unified platforms
const profilePlatforms = getProfilePlatforms();
for (const platform of profilePlatforms) {
  if (platform.urls.profileTemplate) {
    SOCIAL_URL_TEMPLATES[platform.id] = platform.urls.profileTemplate;
    SOCIAL_URL_PLACEHOLDERS[platform.id] = platform.urls.usernamePlaceholder || 'username';
  }
}

// 🔴 Εδώ ζούσε ψευδώνυμο τύπου `SocialPlatform` → `SocialPlatformType` — ΟΜΩΝΥΜΟ της ρίζας
// (`@/lib/contact/social-media-type-vocabulary`) με ΑΛΛΟ σύνολο (`email`, όχι `other`), χωρίς καταναλωτή.
// Αφαιρέθηκε (ADR-327 §8.5.4): το κανάλι κοινοποίησης λέγεται `SocialPlatformType`, η πλατφόρμα λογαριασμού `SocialPlatform`.

// ============================================================================
// EXPORTS - CLEAN ENTERPRISE API
// ============================================================================

export default ProfileService;
