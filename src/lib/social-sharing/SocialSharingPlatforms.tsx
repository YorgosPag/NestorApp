'use client';

// ============================================================================
// 🏢 SOCIAL SHARING PLATFORMS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΔΙΑΧΕΙΡΙΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source of truth για social platforms, icons & styling
// 🔗 USED BY: ShareModal, SocialShare components, Email templates
// 🏢 STANDARDS: Enterprise design system integration, centralized configuration
//
// ============================================================================

import React from 'react';
import { Mail } from 'lucide-react';
import { designSystem } from '@/lib/design-system';
import { HOVER_SHADOWS, GROUP_HOVER_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { borders } from '@/styles/design-tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 📱 Social Platform Configuration
 */
export interface SharePlatform {
  /** Platform identifier */
  id: string;
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
  /** Special configuration options */
  config?: {
    /** Requires email input */
    needsEmail?: boolean;
    /** Mobile-optimized sharing */
    mobileOptimized?: boolean;
    /** Supports rich media */
    supportsMedia?: boolean;
  };
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
 * 📸 Instagram Icon - Enterprise Version
 */
export const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Instagram">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
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
 * 💬 Messenger Icon - Enterprise Version
 */
export const MessengerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Messenger">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.26 5.886-3.26-6.558 6.763z"/>
  </svg>
);

// ============================================================================
// ENTERPRISE PLATFORM CONFIGURATIONS με DESIGN SYSTEM
// ============================================================================

/**
 * 🏢 SOCIAL SHARING PLATFORMS - ENTERPRISE FACTORY FUNCTION
 */
export const getSocialSharingPlatforms = (): SharePlatform[] => {
  // Access semantic colors hook here would not work in non-React context
  // Using designSystem directly for consistency
  // Σειρά: Messenger → Instagram → WhatsApp → Telegram → Email
  return [
  {
    id: 'messenger',
    name: 'Messenger',
    icon: MessengerIcon,
    colors: {
      primary: 'bg-gradient-to-br from-blue-500 to-purple-600',
      gradient: 'from-blue-500 via-purple-500 to-purple-600',
      hover: designSystem.cn(
        'bg-gradient-to-br from-blue-500 to-purple-600',
        HOVER_SHADOWS.COLORED.PURPLE
      ),
      text: 'text-white'
    },
    config: {
      mobileOptimized: true,
      supportsMedia: true
    }
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: InstagramIcon,
    colors: {
      primary: 'bg-gradient-to-br from-purple-500 to-pink-500',
      gradient: 'from-purple-500 via-pink-500 to-orange-400',
      hover: designSystem.cn(
        'bg-gradient-to-br from-purple-500 to-pink-500',
        HOVER_SHADOWS.COLORED.PURPLE
      ),
      text: 'text-white'
    },
    config: {
      mobileOptimized: true,
      supportsMedia: true
    }
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: WhatsAppIcon,
    colors: {
      primary: designSystem.getStatusColor('success', 'bg'),
      gradient: 'from-green-400 via-green-500 to-green-600',
      hover: designSystem.cn(
        designSystem.getStatusColor('success', 'bg'),
        HOVER_SHADOWS.COLORED.GREEN
      ),
      text: 'text-white'
    },
    config: {
      mobileOptimized: true,
      supportsMedia: true
    }
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: TelegramIcon,
    colors: {
      primary: designSystem.getStatusColor('info', 'bg'),
      gradient: 'from-sky-400 via-sky-500 to-sky-600',
      hover: designSystem.cn(
        designSystem.getStatusColor('info', 'bg'),
        HOVER_SHADOWS.COLORED.BLUE
      ),
      text: 'text-white'
    },
    config: {
      supportsMedia: true
    }
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    colors: {
      primary: designSystem.getStatusColor('muted', 'bg'),
      gradient: 'from-gray-500 via-gray-600 to-gray-700',
      hover: designSystem.cn(
        designSystem.getStatusColor('muted', 'bg'),
        HOVER_SHADOWS.COLORED.GRAY
      ),
      text: 'text-white'
    },
    config: {
      needsEmail: true,
      supportsMedia: true
    }
  }
  ];
};

/**
 * 🔄 BACKWARD COMPATIBILITY - Legacy array export
 * @deprecated Use getSocialSharingPlatforms() instead
 */
export const SOCIAL_SHARING_PLATFORMS = getSocialSharingPlatforms();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🔍 Get Platform by ID
 */
export const getPlatformById = (platformId: string): SharePlatform | undefined => {
  return getSocialSharingPlatforms().find(platform => platform.id === platformId);
};

/**
 * 📱 Get Mobile-Optimized Platforms
 */
export const getMobileOptimizedPlatforms = (): SharePlatform[] => {
  return getSocialSharingPlatforms().filter(platform => platform.config?.mobileOptimized);
};

/**
 * 🖼️ Get Media-Supporting Platforms
 */
export const getMediaSupportingPlatforms = (): SharePlatform[] => {
  return getSocialSharingPlatforms().filter(platform => platform.config?.supportsMedia);
};

/**
 * 📧 Get Email-Required Platforms
 */
export const getEmailRequiredPlatforms = (): SharePlatform[] => {
  return getSocialSharingPlatforms().filter(platform => platform.config?.needsEmail);
};

/**
 * 🎨 Generate Enterprise Button Styles για Platform
 */
export const generatePlatformButtonStyles = (platform: SharePlatform, variant: 'default' | 'compact' | 'minimal' = 'default') => {
  const baseStyles = designSystem.cn(
    'group relative overflow-clip transition-all duration-300 transform',
    borders.variants.button.default.className,
    platform.colors.hover
  );

  const variantStyles = {
    default: designSystem.cn(
      'rounded-2xl !p-3 !h-auto aspect-square w-full',
      `bg-gradient-to-br ${platform.colors.gradient}`,
      platform.colors.text
    ),
    compact: designSystem.cn(
      'rounded-xl !p-2 !h-auto aspect-square',
      platform.colors.primary,
      platform.colors.text
    ),
    minimal: designSystem.cn(
      'rounded-lg !p-2 !h-auto aspect-square',
      'bg-transparent border',
      designSystem.getStatusColor('info', 'border'),
      HOVER_BACKGROUND_EFFECTS.LIGHT
    )
  };

  return designSystem.cn(baseStyles, variantStyles[variant]);
};

/**
 * 🌟 Generate Icon Styles για Platform
 * @deprecated Use createPlatformIconStyles instead which accepts iconSizes
 */
export const generatePlatformIconStyles = (size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return designSystem.cn(
    sizeMap[size],
    'transition-transform duration-200',
    GROUP_HOVER_PATTERNS.SCALE_ON_GROUP
  );
};

/**
 * 🏢 ENTERPRISE: Create Platform Icon Styles με centralized icon sizing
 * Replaces deprecated generatePlatformIconStyles
 */
export const createPlatformIconStyles = (
  size: 'sm' | 'md' | 'lg' = 'md',
  iconSizes: { xs: string; sm: string; md: string; lg: string; xl: string }
) => {
  const sizeMap = {
    sm: iconSizes.md,  // w-5 h-5 equivalent
    md: iconSizes.xl,  // w-8 h-8 equivalent
    lg: `w-12 h-12`    // Keep w-12 h-12 as it's beyond iconSizes range
  };

  return designSystem.cn(
    sizeMap[size],
    'transition-transform duration-200',
    GROUP_HOVER_PATTERNS.SCALE_ON_GROUP
  );
};

/**
 * 📝 Generate Platform Label Styles
 */
export const generatePlatformLabelStyles = (size: 'xs' | 'sm' | 'base' = 'xs') => {
  return designSystem.cn(
    designSystem.getTypographyClass(size, 'medium'),
    'transition-opacity duration-200',
    GROUP_HOVER_PATTERNS.FADE_ON_GROUP
  );
};

// ============================================================================
// ADVANCED UTILITIES
// ============================================================================

/**
 * 🔗 Get Platform Share URL Builder
 */
export const buildPlatformShareUrl = (platformId: string, url: string, text: string): string => {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  const urlBuilders: Record<string, string> = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    messenger: `https://www.facebook.com/dialog/send?link=${encodedUrl}&redirect_uri=${encodedUrl}`,
    instagram: `https://www.instagram.com/`, // Instagram doesn't support direct URL sharing — opens app
    whatsapp: `https://wa.me/?text=${encodedText} ${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    email: `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`
  };

  return urlBuilders[platformId] || '#';
};

/**
 * 📊 Platform Analytics Metadata
 */
export const getPlatformAnalyticsData = (platformId: string) => {
  const platform = getPlatformById(platformId);
  return {
    platform_id: platformId,
    platform_name: platform?.name,
    supports_media: platform?.config?.supportsMedia || false,
    mobile_optimized: platform?.config?.mobileOptimized || false,
    timestamp: new Date().toISOString()
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  platforms: SOCIAL_SHARING_PLATFORMS,
  icons: {
    FacebookIcon,
    MessengerIcon,
    InstagramIcon,
    WhatsAppIcon,
    TelegramIcon
  },
  utils: {
    getPlatformById,
    getMobileOptimizedPlatforms,
    getMediaSupportingPlatforms,
    getEmailRequiredPlatforms,
    generatePlatformButtonStyles,
    generatePlatformIconStyles,
    generatePlatformLabelStyles,
    buildPlatformShareUrl,
    getPlatformAnalyticsData
  }
};
