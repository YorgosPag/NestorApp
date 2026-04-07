/**
 * Platform config types — extracted from platform-config.tsx (ADR-065 SRP).
 * @module lib/social-platform-system/platform-config-types
 */

/**
 * Social Platform Types - Unified Definition
 * COMBINES: Sharing platforms + Profile platforms
 */
export type SocialPlatformType =
  | 'whatsapp'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'telegram'
  | 'instagram'
  | 'youtube'
  | 'github'
  | 'tiktok'
  | 'email';

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
