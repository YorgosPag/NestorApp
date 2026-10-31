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

// The ONE platform detection lives with the platform identity registry (ADR-327 §8.5.4): registered hosts,
// exact-or-subdomain match. A local substring copy here matched `wix.com` as Twitter.
export { detectPlatformFromUrl } from '@/lib/contact/social-platform-profiles';
