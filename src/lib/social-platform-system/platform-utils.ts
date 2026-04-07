/**
 * Social Platform Utility Functions
 *
 * Extracted from platform-config.tsx (ADR-065 Phase 6).
 *
 * @module lib/social-platform-system/platform-utils
 */

import type { SocialPlatformType, UnifiedSocialPlatform } from './platform-config';
import { UNIFIED_SOCIAL_PLATFORMS } from './platform-config';

export const getPlatformById = (platformId: SocialPlatformType): UnifiedSocialPlatform | undefined => {
  return UNIFIED_SOCIAL_PLATFORMS[platformId];
};

export const getAllPlatforms = (): UnifiedSocialPlatform[] => {
  return Object.values(UNIFIED_SOCIAL_PLATFORMS);
};

export const getSharingPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.externalSharing);
};

export const getProfilePlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.contactProfiles);
};

export const getMobilePlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.mobileOptimized);
};

export const getMediaSupportingPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.mediaSupport);
};

export const getEmailRequiredPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.requiresEmail);
};

export const isValidPlatform = (platformId: string): platformId is SocialPlatformType => {
  return platformId in UNIFIED_SOCIAL_PLATFORMS;
};

export const detectPlatformFromUrl = (url: string): SocialPlatformType | null => {
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
    if (hostname.includes('wa.me') || hostname.includes('whatsapp.com')) return 'whatsapp';
    if (hostname.includes('t.me') || hostname.includes('telegram.org')) return 'telegram';

    return null;
  } catch {
    return null;
  }
};
