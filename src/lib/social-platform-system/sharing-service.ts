// ============================================================================
// 🔗 ENTERPRISE SHARING SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΕΞΩΤΕΡΙΚΗ ΚΟΙΝΟΠΟΙΗΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source για ΟΛΕΣ τις external sharing operations
// 🔗 REPLACES: share-utils.ts functions + SocialSharingPlatforms buildPlatformShareUrl
// 🏢 STANDARDS: Enterprise service layer, centralized URL building, analytics
//
// 📋 FEATURES UNIFIED:
// - External content sharing (properties, photos, articles)
// - URL building με proper encoding
// - Web Share API με fallbacks
// - Clipboard operations
// - Photo-specific sharing logic
// - UTM parameter handling (basic level)
//
// ============================================================================

import {
  getSharingPlatforms,
  getPlatformById,
  type SocialPlatformType
} from './platform-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { formatCurrency } from '@/lib/intl-utils';
const logger = createModuleLogger('sharing-service');

// ============================================================================
// SHARING SERVICE TYPE DEFINITIONS
// ============================================================================
//
// Types live in `sharing-service-types.ts` (extracted ADR-314 Phase C.5.47 to
// keep this file under the 500-line Google-SRP limit). Re-exported below to
// preserve the public barrel surface via `index.ts`.

import type {
  ShareData,
  ShareOptions,
  PropertyShareData,
  PhotoShareData,
  ShareResult,
} from './sharing-service-types';

export type {
  ShareData,
  ShareOptions,
  PropertyShareData,
  PhotoShareData,
  ShareResult,
} from './sharing-service-types';

// ============================================================================
// CORE SHARING SERVICE - ENTERPRISE CLASS
// ============================================================================

/**
 * 🏢 Enterprise Sharing Service
 *
 * Single source για όλες τις sharing operations
 * Replaces scattered functions across multiple files
 */
export class SharingService {

  /**
   * 🔗 Build Platform Share URL - CENTRAL METHOD
   *
   * REPLACES: buildPlatformShareUrl από SocialSharingPlatforms.tsx
   * REPLACES: getSocialShareUrls από share-utils.ts
   *
   * @param platformId - Target platform
   * @param url - URL to share
   * @param text - Text/title to share
   * @returns Built sharing URL ή null αν unsupported
   */
  static buildPlatformShareUrl(platformId: SocialPlatformType, url: string, text: string): string | null {
    const platform = getPlatformById(platformId);

    if (!platform || !platform.capabilities.externalSharing || !platform.urls.sharingTemplate) {
      return null;
    }

    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);

    // Use platform template με proper substitution
    return platform.urls.sharingTemplate
      .replace('{url}', encodedUrl)
      .replace('{text}', encodedText);
  }

  /**
   * 📸 Build Photo Share URLs - SPECIALIZED METHOD
   *
   * REPLACES: getPhotoSocialShareUrls από share-utils.ts
   * Enhanced logic για photo-specific sharing
   *
   * @param photoUrl - Direct photo URL
   * @param text - Caption/description
   * @param pageUrl - Optional webpage URL (για context)
   * @returns Object με URLs για κάθε platform
   */
  static buildPhotoShareUrls(photoUrl: string, text: string, pageUrl?: string): Record<string, string> {
    const encodedPhotoUrl = encodeURIComponent(photoUrl);
    const encodedText = encodeURIComponent(text);
    const encodedPageUrl = pageUrl ? encodeURIComponent(pageUrl) : encodedPhotoUrl;

    const urls: Record<string, string> = {};

    // Get sharing platforms και build URLs
    const sharingPlatforms = getSharingPlatforms();

    for (const platform of sharingPlatforms) {
      const platformId = platform.id;

      switch (platformId) {
        case 'facebook':
          // Facebook photo sharing με quote parameter
          urls[platformId] = `https://www.facebook.com/sharer/sharer.php?u=${encodedPhotoUrl}&quote=${encodedText}`;
          break;

        case 'twitter':
          // Twitter με direct photo URL
          urls[platformId] = `https://twitter.com/intent/tweet?url=${encodedPhotoUrl}&text=${encodedText}`;
          break;

        case 'linkedin':
          // LinkedIn prefers page URL over direct photo
          urls[platformId] = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedPageUrl}`;
          break;

        case 'whatsapp':
          // WhatsApp με text + photo URL
          urls[platformId] = `https://wa.me/?text=${encodedText} ${encodedPhotoUrl}`;
          break;

        case 'telegram':
          // Telegram με photo URL + text
          urls[platformId] = `https://t.me/share/url?url=${encodedPhotoUrl}&text=${encodedText}`;
          break;

        case 'email':
          // Email με photo URL στο body
          urls[platformId] = `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedPhotoUrl}`;
          break;

        default:
          // Use standard template αν available
          const standardUrl = this.buildPlatformShareUrl(platformId, photoUrl, text);
          if (standardUrl) {
            urls[platformId] = standardUrl;
          }
      }
    }

    return urls;
  }

  /**
   * 🏠 Generate Property Share Text - BUSINESS LOGIC
   *
   * REPLACES: generatePropertyShareText από ShareButton.tsx + share-utils.ts
   * Centralized property text generation
   */
  static generatePropertyShareText(property: {
    title: string;
    location?: string;
    price?: number;
    area?: number;
    description?: string;
  }): string {
    let text = `🏠 ${property.title}`;

    if (property.location) {
      text += `\n📍 ${property.location}`;
    }

    if (property.price) {
      text += `\n💰 ${formatCurrency(property.price)}`;
    }

    const shareArea = property.areas?.gross || property.areas?.net || property.area;
    if (shareArea) {
      text += `\n📐 ${shareArea} τ.μ.`;
    }

    if (property.description) {
      text += `\n\n${property.description}`;
    }

    text += '\n\nΔείτε περισσότερα στο Nestor Construct!';
    return text;
  }

  /**
   * 📤 Share Content - MASTER METHOD
   *
   * REPLACES: shareContent από share-utils.ts
   * Enhanced με platform detection και proper fallbacks
   */
  static async shareContent(data: ShareData, options?: ShareOptions): Promise<ShareResult> {
    try {
      // Try Web Share API πρώτα (mobile/modern browsers)
      if (this.isWebShareSupported() && !options?.forceCustomTemplates) {
        try {
          await navigator.share({
            title: data.title,
            text: data.text,
            url: data.url,
            files: data.files
          });

          return {
            success: true,
            method: 'native_share',
            sharedUrl: data.url
          };
        } catch (shareError) {
          // Continue to fallback αν user cancels ή error
        }
      }

      // Fallback: Copy to clipboard
      const copySuccess = await this.copyToClipboard(data.url);

      return {
        success: copySuccess,
        method: 'clipboard',
        error: copySuccess ? undefined : 'Failed to copy to clipboard',
        sharedUrl: data.url
      };

    } catch (error) {
      return {
        success: false,
        method: 'clipboard',
        error: getErrorMessage(error, 'Unknown sharing error')
      };
    }
  }

  /**
   * 🏠 Share Property - SPECIALIZED METHOD
   *
   * REPLACES: shareProperty από share-utils.ts
   * Enhanced με proper typing και UTM handling
   */
  static async shareProperty(
    property: PropertyShareData,
    options?: ShareOptions
  ): Promise<ShareResult> {
    const shareText = this.generatePropertyShareText({
      title: property.title,
      location: property.location,
      price: property.price,
      area: property.area,
      description: property.text
    });

    // Add UTM parameters αν specified
    let finalUrl = property.url;
    if (options?.utmSource || options?.utmMedium || options?.utmCampaign) {
      finalUrl = this.addUtmParameters(finalUrl, {
        source: options.utmSource || 'property_sharing',
        medium: options.utmMedium || 'social_share',
        campaign: options.utmCampaign || 'property_promotion',
        ...options.utmExtra
      });
    }

    const shareData: ShareData = {
      title: property.title,
      text: shareText,
      url: finalUrl,
      isPhoto: false
    };

    return this.shareContent(shareData, options);
  }

  /**
   * 📸 Share Photo - SPECIALIZED METHOD
   *
   * Enhanced photo sharing με optimized platform handling
   */
  static async sharePhoto(
    photo: PhotoShareData,
    options?: ShareOptions
  ): Promise<ShareResult> {
    // Special handling για direct photo URLs
    const isDirectPhotoUrl = photo.photoUrl.includes('firebasestorage.googleapis.com') ||
                             photo.photoUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);

    const shareData: ShareData = {
      title: photo.title,
      text: photo.text,
      url: isDirectPhotoUrl ? photo.photoUrl : photo.url,
      isPhoto: true
    };

    return this.shareContent(shareData, options);
  }

  /**
   * 📋 Copy to Clipboard - UTILITY METHOD
   *
   * REPLACES: copyToClipboard από share-utils.ts
   * Enhanced με modern clipboard API + fallback
   */
  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      // Modern Clipboard API (preferred)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback για older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;

    } catch (error) {
      logger.warn('Failed to copy to clipboard', { error });
      return false;
    }
  }

  /**
   * 🔍 Web Share API Support Detection
   *
   * REPLACES: isWebShareSupported από share-utils.ts
   */
  static isWebShareSupported(): boolean {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  }

  /**
   * 📊 Add UTM Parameters - UTILITY METHOD
   *
   * REPLACES: generateShareableURL από share-utils.ts (simplified)
   * Clean URL parameter handling
   */
  static addUtmParameters(
    baseUrl: string,
    utmParams: {
      source: string;
      medium: string;
      campaign: string;
      content?: string;
      term?: string;
      [key: string]: string | undefined;
    }
  ): string {
    try {
      const url = new URL(baseUrl, window.location.origin);

      // Add standard UTM parameters
      url.searchParams.set('utm_source', utmParams.source);
      url.searchParams.set('utm_medium', utmParams.medium);
      url.searchParams.set('utm_campaign', utmParams.campaign);

      if (utmParams.content) {
        url.searchParams.set('utm_content', utmParams.content);
      }

      if (utmParams.term) {
        url.searchParams.set('utm_term', utmParams.term);
      }

      // Add any additional parameters
      Object.entries(utmParams).forEach(([key, value]) => {
        if (value && !key.startsWith('utm_') && !['source', 'medium', 'campaign', 'content', 'term'].includes(key)) {
          url.searchParams.set(key, value);
        }
      });

      return url.toString();
    } catch (error) {
      logger.warn('Failed to add UTM parameters', { error });
      return baseUrl;
    }
  }

  /**
   * 🎯 Get Available Platforms για Sharing
   *
   * Returns platforms that support external sharing
   */
  static getAvailableSharingPlatforms(): SocialPlatformType[] {
    return getSharingPlatforms().map(platform => platform.id);
  }

  /**
   * 📱 Detect Mobile Environment
   *
   * Helper για mobile-specific sharing behavior
   */
  static isMobileEnvironment(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * 🔗 Build Platform Share URL - Function Export
 *
 * BACKWARDS COMPATIBLE με existing code
 */
export const buildPlatformShareUrl = SharingService.buildPlatformShareUrl;

/**
 * 📤 Share Content - Function Export
 *
 * BACKWARDS COMPATIBLE με existing code
 */
export const shareContent = SharingService.shareContent;

/**
 * 📋 Copy to Clipboard - Function Export
 *
 * BACKWARDS COMPATIBLE με existing code
 */
export const copyToClipboard = SharingService.copyToClipboard;

/**
 * 🔍 Web Share Support Check - Function Export
 *
 * BACKWARDS COMPATIBLE με existing code (canonical SSoT: @/lib/share-utils)
 */
export { isWebShareSupported } from '@/lib/share-utils';

// ============================================================================
// LEGACY COMPATIBILITY - MIGRATION HELPERS
// ============================================================================

// Canonical SSoT: @/lib/share-utils (getSocialShareUrls / getPhotoSocialShareUrls).
// The former class-backed wrappers were dead (no barrel consumers) and diverged
// from share-utils impl; redirecting to SSoT keeps the external API shape while
// collapsing CHECK 3.18 duplicate exports (ADR-314 Phase C.5.47).
export { getSocialShareUrls, getPhotoSocialShareUrls } from '@/lib/share-utils';

// ============================================================================
// EXPORTS - CLEAN ENTERPRISE API
// ============================================================================

export default SharingService;