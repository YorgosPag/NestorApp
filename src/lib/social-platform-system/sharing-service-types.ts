// ============================================================================
// 🔗 SHARING SERVICE — TYPE DEFINITIONS
// ============================================================================
//
// Extracted from `sharing-service.ts` (ADR-314 Phase C.5.47) to keep the
// service file under the 500-line Google-SRP limit. Types only, no runtime.
//
// ============================================================================

import type { SocialPlatformType } from './platform-config';

/**
 * 📤 Share Data Interface - Unified
 *
 * Standard interface για όλα τα sharing scenarios
 */
export interface ShareData {
  /** Main title/subject */
  title: string;
  /** Description/text content */
  text?: string;
  /** URL to share */
  url: string;
  /** File attachments (για Web Share API) */
  files?: File[];
  /** Indicates if this is photo sharing */
  isPhoto?: boolean;
}

/**
 * 🎯 Share Options - Advanced Configuration
 *
 * Options για customization του sharing behavior
 */
export interface ShareOptions {
  /** Preferred platforms (filter list) */
  platforms?: SocialPlatformType[];
  /** UTM source για tracking */
  utmSource?: string;
  /** UTM medium για tracking */
  utmMedium?: string;
  /** UTM campaign για tracking */
  utmCampaign?: string;
  /** Additional UTM parameters */
  utmExtra?: Record<string, string>;
  /** Force use of custom URL templates */
  forceCustomTemplates?: boolean;
}

/**
 * 🏠 Property Share Data - Specialized
 *
 * Extended interface για property sharing
 */
export interface PropertyShareData extends ShareData {
  propertyId: string;
  price?: number;
  area?: number;
  location?: string;
  imageUrl?: string;
  propertyType?: string;
}

/**
 * 📸 Photo Share Data - Specialized
 *
 * Extended interface για photo sharing
 */
export interface PhotoShareData extends ShareData {
  photoUrl: string;
  photoType?: 'property' | 'contact' | 'document' | 'general';
  associatedEntityId?: string;
}

/**
 * 📊 Share Result - Return Value
 *
 * Standardized result από sharing operations
 */
export interface ShareResult {
  success: boolean;
  platform?: SocialPlatformType;
  method: 'native_share' | 'external_url' | 'clipboard' | 'email';
  error?: string;
  sharedUrl?: string;
}
