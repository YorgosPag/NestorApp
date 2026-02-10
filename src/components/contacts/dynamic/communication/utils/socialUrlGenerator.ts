// ============================================================================
// 🌐 ENTERPRISE SOCIAL URL GENERATOR - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ UTILITY
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized social media URL generation για consistent URL formatting
// 🔗 USED BY: Communication renderers, form components, URL validation systems
//
// ============================================================================

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('socialUrlGenerator');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 🎯 Social Media Platform Types
 *
 * Supported social media platforms για URL generation
 */
export type SocialPlatform =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'youtube'
  | 'github'
  | 'tiktok';

/**
 * 🔗 Social URL Template Configuration
 *
 * Template patterns για κάθε social media platform
 */
export interface SocialUrlTemplate {
  platform: SocialPlatform;
  template: string;
  placeholder: string;
  validation?: RegExp;
}

// ============================================================================
// ENTERPRISE URL TEMPLATES CONFIGURATION
// ============================================================================

/**
 * 🏢 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ URL TEMPLATES
 *
 * Single source of truth για όλα τα social media URL patterns
 * Μπορεί εύκολα να επεκταθεί με νέες πλατφόρμες
 */
export const SOCIAL_URL_TEMPLATES: Record<SocialPlatform, string> = {
  linkedin: 'https://linkedin.com/in/{username}',
  facebook: 'https://facebook.com/{username}',
  instagram: 'https://instagram.com/{username}',
  twitter: 'https://x.com/{username}',
  youtube: 'https://youtube.com/@{username}',
  github: 'https://github.com/{username}',
  tiktok: 'https://tiktok.com/@{username}'
} as const;

/**
 * 📝 USERNAME PLACEHOLDERS
 *
 * Placeholder text για κάθε platform
 */
export const SOCIAL_URL_PLACEHOLDERS: Record<SocialPlatform, string> = {
  linkedin: 'john-doe',
  facebook: 'john.doe',
  instagram: 'johndoe',
  twitter: 'johndoe',
  youtube: 'johndoe',
  github: 'johndoe',
  tiktok: 'johndoe'
} as const;

// ============================================================================
// ENTERPRISE UTILITY FUNCTIONS
// ============================================================================

/**
 * 🎯 Generate Social Media URL
 *
 * Enterprise-grade function για social media URL generation
 *
 * @param platform - The social media platform
 * @param username - The username to generate URL for
 * @returns Generated social media URL ή empty string αν invalid input
 *
 * @example
 * ```typescript
 * generateSocialUrl('linkedin', 'john-doe')
 * // Returns: 'https://linkedin.com/in/john-doe'
 *
 * generateSocialUrl('github', 'awesome-dev')
 * // Returns: 'https://github.com/awesome-dev'
 * ```
 */
export function generateSocialUrl(platform: string, username: string): string {
  // Input validation
  if (!platform || !username?.trim()) {
    return '';
  }

  // Clean username - remove whitespace και special characters
  const cleanUsername = username.trim().toLowerCase();

  // Get template για την πλατφόρμα
  const template = SOCIAL_URL_TEMPLATES[platform as SocialPlatform];

  if (!template) {
    logger.warn(`[SocialUrlGenerator] Unsupported platform: ${platform}`);
    return '';
  }

  // Replace placeholder με actual username
  return template.replace('{username}', cleanUsername);
}

/**
 * 🔍 Validate Social Media URL
 *
 * Enterprise validation για social media URLs
 *
 * @param url - The URL to validate
 * @param platform - Expected platform (optional)
 * @returns Boolean indicating if URL is valid
 */
export function validateSocialUrl(url: string, platform?: SocialPlatform): boolean {
  // ✅ ENTERPRISE MIGRATION: Delegating to centralized social platform system
  // BACKWARDS COMPATIBLE: Same interface, enterprise implementation
  try {
    const { validateSocialUrl: enterpriseValidator } = require('@/lib/social-platform-system');
    // 🏢 ENTERPRISE: Type mapping between legacy SocialPlatform and enterprise SocialPlatformType
    // Both types have the same string values, so casting is safe
    return enterpriseValidator(url, platform as string | undefined);
  } catch (error) {
    logger.warn('Enterprise social validator not available, using fallback');
    if (!url?.trim()) return false;

    try {
      const urlObj = new URL(url);
      if (platform) {
        const expectedTemplate = SOCIAL_URL_TEMPLATES[platform];
        const expectedDomain = new URL(expectedTemplate.replace('{username}', 'test')).hostname;
        return urlObj.hostname === expectedDomain;
      }

      const knownDomains = Object.values(SOCIAL_URL_TEMPLATES)
        .map(template => new URL(template.replace('{username}', 'test')).hostname);
      return knownDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }
}

/**
 * 🔧 Extract Username από Social URL
 *
 * Reverse operation - extract username από existing social URL
 *
 * @param url - The social media URL
 * @returns Extracted username ή empty string αν invalid
 */
export function extractUsernameFromSocialUrl(url: string): string {
  if (!url?.trim()) return '';

  try {
    const urlObj = new URL(url);

    // LinkedIn special case: /in/username
    if (urlObj.hostname.includes('linkedin.com')) {
      const match = urlObj.pathname.match(/\/in\/([^\/]+)/);
      return match?.[1] || '';
    }

    // GitHub, Instagram, etc: /username
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    // YouTube special case: /@username
    if (urlObj.hostname.includes('youtube.com') && pathSegments[0] === '@username') {
      return pathSegments[0].substring(1);
    }

    // Default: first path segment
    return pathSegments[0] || '';
  } catch {
    return '';
  }
}

/**
 * 📋 Get Supported Platforms
 *
 * Returns list των supported social media platforms
 */
export function getSupportedSocialPlatforms(): SocialPlatform[] {
  return Object.keys(SOCIAL_URL_TEMPLATES) as SocialPlatform[];
}

/**
 * 🎯 Get Platform από URL
 *
 * Detect την πλατφόρμα από URL
 */
export function detectPlatformFromUrl(url: string): SocialPlatform | null {
  if (!url?.trim()) return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'twitter';
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('github.com')) return 'github';
    if (hostname.includes('tiktok.com')) return 'tiktok';

    return null;
  } catch {
    return null;
  }
}