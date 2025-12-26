// ============================================================================
// 🏢 ENTERPRISE SOCIAL PLATFORM SYSTEM - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΔΙΑΧΕΙΡΙΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source of truth για ΟΛΑ τα social platform features
// 🔗 REPLACES: SocialSharingPlatforms.tsx + socialUrlGenerator.ts (partial)
// 🏢 STANDARDS: Enterprise unified architecture, centralized configuration
//
// 📋 FEATURES UNIFIED:
// - Social platform definitions & configurations
// - Platform icons (SVG components)
// - Platform styling & colors με design system
// - Profile URL templates & sharing URLs
// - Platform detection & validation
//
// ============================================================================

import React from 'react';
import { Mail } from 'lucide-react';
import { designSystem } from '@/lib/design-system';
import { SOCIAL_HOVER_EFFECTS, HOVER_SHADOWS } from '@/components/ui/effects';

// ============================================================================
// UNIFIED TYPE DEFINITIONS
// ============================================================================

/**
 * 🎯 Social Platform Types - Unified Definition
 *
 * COMBINES: Sharing platforms + Profile platforms
 * COVERS: External sharing, contact profiles, communication
 */
export type SocialPlatformType =
  | 'whatsapp'      // ✅ Sharing + Communication
  | 'facebook'      // ✅ Sharing + Profile
  | 'twitter'       // ✅ Sharing + Profile
  | 'linkedin'      // ✅ Sharing + Profile
  | 'telegram'      // ✅ Sharing + Communication
  | 'instagram'     // ✅ Profile only
  | 'youtube'       // ✅ Profile only
  | 'github'        // ✅ Profile only
  | 'tiktok'        // ✅ Profile only
  | 'email';        // ✅ Sharing + Communication

/**
 * 🏢 Platform Capability Matrix
 *
 * Defines what each platform can do - enterprise feature mapping
 */
export interface PlatformCapabilities {
  /** External content sharing (properties, photos, etc.) */
  externalSharing: boolean;
  /** Contact profile URLs (social media profiles) */
  contactProfiles: boolean;
  /** Direct communication (messages, calls) */
  directCommunication: boolean;
  /** Media support (images, videos) */
  mediaSupport: boolean;
  /** Mobile optimized */
  mobileOptimized: boolean;
  /** Requires email input */
  requiresEmail: boolean;
}

/**
 * 🎨 Platform UI Configuration
 *
 * Enterprise-grade styling with design system integration
 */
export interface PlatformUIConfig {
  /** Display name */
  name: string;
  /** SVG Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Enterprise color scheme */
  colors: {
    /** Primary brand color using design system */
    primary: string;
    /** Background gradient using design system */
    gradient: string;
    /** Hover state using design system */
    hover: string;
    /** Text color using design system */
    text: string;
  };
  /** Sort order for display */
  displayOrder: number;
}

/**
 * 🔗 Platform URL Configuration
 *
 * Templates για URL generation - both sharing & profile URLs
 */
export interface PlatformUrlConfig {
  /** Sharing URL template (external content sharing) */
  sharingTemplate?: string;
  /** Profile URL template (contact social media profiles) */
  profileTemplate?: string;
  /** Username placeholder για profiles */
  usernamePlaceholder?: string;
  /** URL validation regex */
  validation?: RegExp;
}

/**
 * 🏢 UNIFIED PLATFORM DEFINITION
 *
 * Complete platform definition - enterprise single source
 */
export interface UnifiedSocialPlatform {
  /** Platform identifier */
  id: SocialPlatformType;
  /** Platform capabilities */
  capabilities: PlatformCapabilities;
  /** UI configuration */
  ui: PlatformUIConfig;
  /** URL configuration */
  urls: PlatformUrlConfig;
}

// ============================================================================
// ENTERPRISE SVG ICONS - CENTRALIZED & OPTIMIZED
// ============================================================================

/**
 * 💬 WhatsApp Icon - Enterprise Version
 */
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="WhatsApp">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.690"/>
  </svg>
);

/**
 * 📘 Facebook Icon - Enterprise Version
 */
export const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Facebook">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073"/>
  </svg>
);

/**
 * 🐦 Twitter/X Icon - Enterprise Version
 */
export const TwitterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Twitter/X">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

/**
 * 💼 LinkedIn Icon - Enterprise Version
 */
export const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="LinkedIn">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

/**
 * ✈️ Telegram Icon - Enterprise Version
 */
export const TelegramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Telegram">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

/**
 * 📸 Instagram Icon - Enterprise Version
 */
export const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Instagram">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

/**
 * 📺 YouTube Icon - Enterprise Version
 */
export const YouTubeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="YouTube">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

/**
 * 💻 GitHub Icon - Enterprise Version
 */
export const GitHubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

/**
 * 🎵 TikTok Icon - Enterprise Version
 */
export const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

// ============================================================================
// ENTERPRISE PLATFORM CONFIGURATIONS - UNIFIED SINGLE SOURCE
// ============================================================================

/**
 * 🏢 UNIFIED SOCIAL PLATFORM DEFINITIONS
 *
 * Single source of truth για ΟΛΑ τα social platform features
 * Replaces & unifies all scattered systems
 */
export const UNIFIED_SOCIAL_PLATFORMS: Record<SocialPlatformType, UnifiedSocialPlatform> = {
  whatsapp: {
    id: 'whatsapp',
    capabilities: {
      externalSharing: true,
      contactProfiles: false,
      directCommunication: true,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      colors: {
        primary: designSystem.getStatusColor('success', 'bg'), // Green για WhatsApp
        gradient: 'from-green-400 via-green-500 to-green-600',
        hover: designSystem.cn(
          designSystem.getStatusColor('success', 'bg'),
          SOCIAL_HOVER_EFFECTS.WHATSAPP
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 1,
    },
    urls: {
      sharingTemplate: 'https://wa.me/?text={text} {url}',
    },
  },

  facebook: {
    id: 'facebook',
    capabilities: {
      externalSharing: true,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'Facebook',
      icon: FacebookIcon,
      colors: {
        primary: designSystem.getStatusColor('info', 'bg'), // Blue για Facebook
        gradient: 'from-blue-500 via-blue-600 to-blue-700',
        hover: designSystem.cn(
          designSystem.getStatusColor('info', 'bg'),
          SOCIAL_HOVER_EFFECTS.FACEBOOK
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 2,
    },
    urls: {
      sharingTemplate: 'https://www.facebook.com/sharer/sharer.php?u={url}',
      profileTemplate: 'https://facebook.com/{username}',
      usernamePlaceholder: 'john.doe',
    },
  },

  twitter: {
    id: 'twitter',
    capabilities: {
      externalSharing: true,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'Twitter',
      icon: TwitterIcon,
      colors: {
        primary: designSystem.getStatusColor('dark', 'bg'), // Dark για Twitter/X
        gradient: 'from-gray-700 via-gray-800 to-gray-900',
        hover: designSystem.cn(
          designSystem.getStatusColor('dark', 'bg'),
          HOVER_SHADOWS.COLORED.GRAY
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 3,
    },
    urls: {
      sharingTemplate: 'https://twitter.com/intent/tweet?url={url}&text={text}',
      profileTemplate: 'https://x.com/{username}',
      usernamePlaceholder: 'johndoe',
    },
  },

  linkedin: {
    id: 'linkedin',
    capabilities: {
      externalSharing: true,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'LinkedIn',
      icon: LinkedInIcon,
      colors: {
        primary: designSystem.getStatusColor('info', 'bg'), // LinkedIn blue
        gradient: 'from-blue-600 via-blue-700 to-blue-800',
        hover: designSystem.cn(
          designSystem.getStatusColor('info', 'bg'),
          HOVER_SHADOWS.COLORED.BLUE
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 4,
    },
    urls: {
      sharingTemplate: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
      profileTemplate: 'https://linkedin.com/in/{username}',
      usernamePlaceholder: 'john-doe',
    },
  },

  telegram: {
    id: 'telegram',
    capabilities: {
      externalSharing: true,
      contactProfiles: false,
      directCommunication: true,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'Telegram',
      icon: TelegramIcon,
      colors: {
        primary: designSystem.getStatusColor('info', 'bg'), // Telegram sky blue
        gradient: 'from-sky-400 via-sky-500 to-sky-600',
        hover: designSystem.cn(
          designSystem.getStatusColor('info', 'bg'),
          HOVER_SHADOWS.COLORED.BLUE
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 5,
    },
    urls: {
      sharingTemplate: 'https://t.me/share/url?url={url}&text={text}',
    },
  },

  instagram: {
    id: 'instagram',
    capabilities: {
      externalSharing: false, // Instagram doesn't support external URL sharing
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'Instagram',
      icon: InstagramIcon,
      colors: {
        primary: designSystem.getStatusColor('warning', 'bg'), // Instagram pink
        gradient: 'from-pink-400 via-red-500 to-yellow-500', // Instagram gradient
        hover: designSystem.cn(
          designSystem.getStatusColor('warning', 'bg'),
          HOVER_SHADOWS.COLORED.PINK
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 6,
    },
    urls: {
      profileTemplate: 'https://instagram.com/{username}',
      usernamePlaceholder: 'johndoe',
    },
  },

  youtube: {
    id: 'youtube',
    capabilities: {
      externalSharing: false,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'YouTube',
      icon: YouTubeIcon,
      colors: {
        primary: designSystem.getStatusColor('error', 'bg'), // YouTube red
        gradient: 'from-red-500 via-red-600 to-red-700',
        hover: designSystem.cn(
          designSystem.getStatusColor('error', 'bg'),
          HOVER_SHADOWS.COLORED.RED
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 7,
    },
    urls: {
      profileTemplate: 'https://youtube.com/@{username}',
      usernamePlaceholder: 'johndoe',
    },
  },

  github: {
    id: 'github',
    capabilities: {
      externalSharing: false,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: false,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'GitHub',
      icon: GitHubIcon,
      colors: {
        primary: designSystem.getStatusColor('muted', 'bg'), // GitHub dark
        gradient: 'from-gray-700 via-gray-800 to-gray-900',
        hover: designSystem.cn(
          designSystem.getStatusColor('muted', 'bg'),
          HOVER_SHADOWS.COLORED.GRAY
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 8,
    },
    urls: {
      profileTemplate: 'https://github.com/{username}',
      usernamePlaceholder: 'johndoe',
    },
  },

  tiktok: {
    id: 'tiktok',
    capabilities: {
      externalSharing: false,
      contactProfiles: true,
      directCommunication: false,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: false,
    },
    ui: {
      name: 'TikTok',
      icon: TikTokIcon,
      colors: {
        primary: designSystem.getStatusColor('dark', 'bg'), // TikTok black
        gradient: 'from-gray-900 via-black to-gray-900',
        hover: designSystem.cn(
          designSystem.getStatusColor('dark', 'bg'),
          HOVER_SHADOWS.COLORED.GRAY
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 9,
    },
    urls: {
      profileTemplate: 'https://tiktok.com/@{username}',
      usernamePlaceholder: 'johndoe',
    },
  },

  email: {
    id: 'email',
    capabilities: {
      externalSharing: true,
      contactProfiles: false,
      directCommunication: true,
      mediaSupport: true,
      mobileOptimized: true,
      requiresEmail: true,
    },
    ui: {
      name: 'Email',
      icon: Mail,
      colors: {
        primary: designSystem.getStatusColor('muted', 'bg'), // Neutral για email
        gradient: 'from-gray-500 via-gray-600 to-gray-700',
        hover: designSystem.cn(
          designSystem.getStatusColor('muted', 'bg'),
          HOVER_SHADOWS.COLORED.GRAY
        ),
        text: designSystem.getStatusColor('foreground', 'text')
      },
      displayOrder: 10,
    },
    urls: {
      sharingTemplate: 'mailto:?subject={text}&body={text}%0A%0A{url}',
    },
  },
};

// ============================================================================
// ENTERPRISE UTILITY FUNCTIONS - CENTRALIZED ACCESS
// ============================================================================

/**
 * 🔍 Get Platform by ID
 */
export const getPlatformById = (platformId: SocialPlatformType): UnifiedSocialPlatform | undefined => {
  return UNIFIED_SOCIAL_PLATFORMS[platformId];
};

/**
 * 📋 Get All Platforms
 */
export const getAllPlatforms = (): UnifiedSocialPlatform[] => {
  return Object.values(UNIFIED_SOCIAL_PLATFORMS);
};

/**
 * 🔗 Get Platforms with External Sharing
 */
export const getSharingPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.externalSharing);
};

/**
 * 👤 Get Platforms with Contact Profiles
 */
export const getProfilePlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.contactProfiles);
};

/**
 * 📱 Get Mobile-Optimized Platforms
 */
export const getMobilePlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.mobileOptimized);
};

/**
 * 🖼️ Get Media-Supporting Platforms
 */
export const getMediaSupportingPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.mediaSupport);
};

/**
 * 📧 Get Email-Required Platforms
 */
export const getEmailRequiredPlatforms = (): UnifiedSocialPlatform[] => {
  return getAllPlatforms().filter(platform => platform.capabilities.requiresEmail);
};

/**
 * 🎯 Validate Platform Type
 */
export const isValidPlatform = (platformId: string): platformId is SocialPlatformType => {
  return platformId in UNIFIED_SOCIAL_PLATFORMS;
};

/**
 * 🔗 Detect Platform από URL
 */
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

// ============================================================================
// EXPORTS - CLEAN BARREL PATTERN
// ============================================================================

export default {
  platforms: UNIFIED_SOCIAL_PLATFORMS,
  utils: {
    getPlatformById,
    getAllPlatforms,
    getSharingPlatforms,
    getProfilePlatforms,
    getMobilePlatforms,
    getMediaSupportingPlatforms,
    getEmailRequiredPlatforms,
    isValidPlatform,
    detectPlatformFromUrl,
  },
  icons: {
    WhatsAppIcon,
    FacebookIcon,
    TwitterIcon,
    LinkedInIcon,
    TelegramIcon,
    InstagramIcon,
    YouTubeIcon,
    GitHubIcon,
    TikTokIcon,
  }
};