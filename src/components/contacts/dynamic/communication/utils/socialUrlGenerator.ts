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
import { validateSocialUrl as enterpriseValidator } from '@/lib/social-platform-system/profile-service';
import { SOCIAL_PLATFORMS, isSocialPlatform, type SocialPlatform } from '@/lib/contact/social-media-type-vocabulary';
import { buildSocialProfileUrl, type NamedSocialPlatform } from '@/lib/contact/social-platform-profiles';
const logger = createModuleLogger('socialUrlGenerator');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 🎯 Social Media Platform Types — η ΡΙΖΑ `SOCIAL_PLATFORMS` (ADR-327 §8.5.4).
 *
 * Εδώ ζούσε τοπικό ομώνυμο 7 τιμών (χωρίς whatsapp/telegram/other) — και επειδή είχε το ΙΔΙΟ όνομα με τη ρίζα, το
 * CHECK 3.73 μετρούσε τους πίνακές του «δεμένους». Τα πρότυπα URL ζουν πλέον στο `social-platform-profiles`.
 */
export type { SocialPlatform };

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

  // Το πρότυπο από το ΕΝΑ μητρώο (`social-platform-profiles`)· `other` δεν έχει πρότυπο
  const url = isSocialPlatform(platform) ? buildSocialProfileUrl(platform, cleanUsername) : undefined;

  if (!url) {
    logger.warn(`[SocialUrlGenerator] Unsupported platform: ${platform}`);
    return '';
  }

  return url;
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
  // `other` δεν έχει πρότυπο ⇒ έλεγχος χωρίς αναμενόμενη πλατφόρμα (χωρίς τυφλό `as`)
  return enterpriseValidator(url, platform === 'other' ? undefined : platform);
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
      const match = urlObj.pathname.match(/\/in\/([^/]+)/);
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
export function getSupportedSocialPlatforms(): NamedSocialPlatform[] {
  return SOCIAL_PLATFORMS.filter((p): p is NamedSocialPlatform => p !== 'other');
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