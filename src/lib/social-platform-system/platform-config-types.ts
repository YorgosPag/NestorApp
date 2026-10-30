/**
 * Platform config types — extracted from platform-config.tsx (ADR-065 SRP).
 * @module lib/social-platform-system/platform-config-types
 */

import type { NamedSocialPlatform } from '@/lib/contact/social-platform-profiles';

/**
 * Social Platform Types - Unified Definition
 * COMBINES: Sharing platforms + Profile platforms
 *
 * 🔴 ΔΕΜΕΝΟ ΣΤΗ ΡΙΖΑ (2026-10-30, ADR-327 §8.5.4): κάθε πλατφόρμα της ρίζας `SOCIAL_PLATFORMS` εκτός του `other`,
 * ΣΥΝ το κανάλι `email` — που δεν είναι πλατφόρμα λογαριασμού, μόνο στόχος κοινοποίησης. Πριν ήταν χειρόγραφη
 * λίστα: νέα πλατφόρμα στη φόρμα επαφής δεν αποκτούσε ποτέ εικονίδιο/όνομα εδώ.
 */
export type SocialPlatformType = NamedSocialPlatform | 'email';

/** Platform Capability Matrix */
export interface PlatformCapabilities {
  externalSharing: boolean;
  contactProfiles: boolean;
  directCommunication: boolean;
  mediaSupport: boolean;
  mobileOptimized: boolean;
  requiresEmail: boolean;
}

/** Platform UI Configuration */
export interface PlatformUIConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  colors: {
    primary: string;
    gradient: string;
    hover: string;
    text: string;
  };
  displayOrder: number;
}

/** Platform URL Configuration */
export interface PlatformUrlConfig {
  sharingTemplate?: string;
  profileTemplate?: string;
  usernamePlaceholder?: string;
  validation?: RegExp;
}

/** Unified platform definition — enterprise single source */
export interface UnifiedSocialPlatform {
  id: SocialPlatformType;
  capabilities: PlatformCapabilities;
  ui: PlatformUIConfig;
  urls: PlatformUrlConfig;
}
