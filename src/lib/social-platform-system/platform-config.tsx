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

// SVG Icons extracted to platform-icons.tsx (ADR-065 Phase 6)
export {
  WhatsAppIcon,
  FacebookIcon,
  TwitterIcon,
  LinkedInIcon,
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  GitHubIcon,
  TikTokIcon,
} from './platform-icons';

import {
  WhatsAppIcon,
  FacebookIcon,
  TwitterIcon,
  LinkedInIcon,
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  GitHubIcon,
  TikTokIcon,
} from './platform-icons';

// Types extracted to platform-config-types.ts (ADR-065)
export type {
  SocialPlatformType,
  PlatformCapabilities,
  PlatformUIConfig,
  PlatformUrlConfig,
  UnifiedSocialPlatform,
} from './platform-config-types';
import type { SocialPlatformType, UnifiedSocialPlatform } from './platform-config-types';

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
          HOVER_SHADOWS.COLORED.PURPLE
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
// UTILITY FUNCTIONS — Re-exported from platform-utils.ts (ADR-065 Phase 6)
// ============================================================================

export {
  getPlatformById,
  getAllPlatforms,
  getSharingPlatforms,
  getProfilePlatforms,
  getMobilePlatforms,
  getMediaSupportingPlatforms,
  getEmailRequiredPlatforms,
  isValidPlatform,
  detectPlatformFromUrl,
} from './platform-utils';
