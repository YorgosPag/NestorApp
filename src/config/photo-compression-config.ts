/**
 * 🗜️ PHOTO COMPRESSION CONFIGURATION
 *
 * Centralized configuration για photo compression settings.
 * Χρησιμοποιείται από PhotoUploadService και ImageParser για consistent compression settings.
 *
 * @location src/config/photo-compression-config.ts
 * @uses EnterprisePhotoUpload, Base64 conversion
 */

// ============================================================================
// COMPRESSION PROFILES
// ============================================================================

export interface CompressionProfile {
  /** Maximum dimension (width or height) in pixels */
  maxDimension: number;
  /** JPEG quality (0.0 - 1.0) */
  quality: number;
  /** Maximum file size before compression is triggered (KB) */
  maxSizeKB: number;
  /** Description για documentation */
  description: string;
}

export const COMPRESSION_PROFILES: Record<string, CompressionProfile> = {
  // Contact & Profile Photos
  avatar: {
    maxDimension: 150,
    quality: 0.75,
    maxSizeKB: 200,
    description: 'Tiny avatars για lists και compact UI elements'
  },
  thumbnail: {
    maxDimension: 300,
    quality: 0.80,
    maxSizeKB: 300,
    description: 'List thumbnails και small previews'
  },
  profile: {
    maxDimension: 800,
    quality: 0.85,
    maxSizeKB: 500,
    description: 'Full profile photos για modals και detailed views'
  },

  // Company & Business
  companyLogo: {
    maxDimension: 600,
    quality: 0.88,
    maxSizeKB: 800,
    description: 'Company logos (higher quality για branding)'
  },
  businessCard: {
    maxDimension: 1000,
    quality: 0.90,
    maxSizeKB: 1000,
    description: 'Business cards και marketing materials'
  },

  // Documents & Technical
  document: {
    maxDimension: 1200,
    quality: 0.92,
    maxSizeKB: 1500,
    description: 'Document scans που χρειάζονται readability'
  },
  technical: {
    maxDimension: 1600,
    quality: 0.95,
    maxSizeKB: 2000,
    description: 'Technical drawings και detailed schematics'
  },

  // Special Cases
  print: {
    maxDimension: 2000,
    quality: 0.95,
    maxSizeKB: 3000,
    description: 'High quality για printing purposes'
  },
  uncompressed: {
    maxDimension: 4096,
    quality: 0.98,
    maxSizeKB: Number.MAX_SAFE_INTEGER,
    description: 'Minimal compression για critical images'
  }
};

// ============================================================================
// USAGE CONTEXT MAPPING
// ============================================================================

export type UsageContext =
  | 'avatar'
  | 'list-item'
  | 'profile-modal'
  | 'company-logo'
  | 'business-card'
  | 'document-scan'
  | 'technical-drawing'
  | 'print'
  | 'archive';

export const USAGE_TO_PROFILE_MAP: Record<UsageContext, keyof typeof COMPRESSION_PROFILES> = {
  'avatar': 'avatar',
  'list-item': 'thumbnail',
  'profile-modal': 'profile',
  'company-logo': 'companyLogo',
  'business-card': 'businessCard',
  'document-scan': 'document',
  'technical-drawing': 'technical',
  'print': 'print',
  'archive': 'uncompressed'
};

// ============================================================================
// SMART COMPRESSION SETTINGS
// ============================================================================

export interface SmartCompressionConfig {
  /** Enable automatic smart compression based on file size */
  enableSmartCompression: boolean;
  /** File size thresholds για different compression strategies */
  sizeThresholds: {
    tiny: number;      // < 100KB - no compression needed
    small: number;     // < 500KB - light compression
    medium: number;    // < 2MB - moderate compression
    large: number;     // < 5MB - aggressive compression
    huge: number;      // > 5MB - very aggressive compression
  };
  /** Default fallback profile if smart detection fails */
  defaultProfile: keyof typeof COMPRESSION_PROFILES;
}

export const SMART_COMPRESSION_CONFIG: SmartCompressionConfig = {
  enableSmartCompression: true,
  sizeThresholds: {
    tiny: 100,      // 100KB
    small: 500,     // 500KB
    medium: 2048,   // 2MB
    large: 5120,    // 5MB
    huge: 10240     // 10MB
  },
  defaultProfile: 'profile'
};

// ============================================================================
// COMPRESSION STRATEGIES
// ============================================================================

export interface CompressionStrategy {
  name: string;
  profile: keyof typeof COMPRESSION_PROFILES;
  reason: string;
}

/**
 * Determine optimal compression strategy based on file size και usage context
 */
export function getCompressionStrategy(
  fileSizeBytes: number,
  usageContext: UsageContext = 'profile-modal'
): CompressionStrategy {
  const fileSizeKB = fileSizeBytes / 1024;
  const config = SMART_COMPRESSION_CONFIG;

  // First check usage context
  const contextProfile = USAGE_TO_PROFILE_MAP[usageContext];
  const targetProfile = COMPRESSION_PROFILES[contextProfile];

  // If file is already smaller than target, minimal compression
  if (fileSizeKB <= targetProfile.maxSizeKB) {
    return {
      name: 'no-compression',
      profile: contextProfile,
      reason: `File size (${Math.round(fileSizeKB)}KB) είναι ήδη εντός ορίων για ${usageContext}`
    };
  }

  // Smart compression based on file size
  if (fileSizeKB <= config.sizeThresholds.tiny) {
    return {
      name: 'no-compression',
      profile: 'uncompressed',
      reason: 'File είναι πολύ μικρό για compression'
    };
  } else if (fileSizeKB <= config.sizeThresholds.small) {
    return {
      name: 'light-compression',
      profile: contextProfile,
      reason: `Light compression για ${usageContext} context`
    };
  } else if (fileSizeKB <= config.sizeThresholds.medium) {
    return {
      name: 'moderate-compression',
      profile: contextProfile === 'uncompressed' ? 'profile' : contextProfile,
      reason: 'Moderate compression για balanced size και quality'
    };
  } else if (fileSizeKB <= config.sizeThresholds.large) {
    return {
      name: 'aggressive-compression',
      profile: usageContext.includes('logo') ? 'companyLogo' : 'profile',
      reason: 'Aggressive compression για large files'
    };
  } else {
    return {
      name: 'very-aggressive-compression',
      profile: usageContext === 'avatar' ? 'avatar' : 'thumbnail',
      reason: 'Very aggressive compression για huge files'
    };
  }
}

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

/**
 * Check if compression is recommended for a file
 */
export function shouldCompressFile(
  fileSizeBytes: number,
  usageContext: UsageContext = 'profile-modal'
): {
  shouldCompress: boolean;
  strategy: CompressionStrategy;
  estimatedSavings?: string;
} {
  const strategy = getCompressionStrategy(fileSizeBytes, usageContext);
  const shouldCompress = strategy.name !== 'no-compression';

  let estimatedSavings: string | undefined;
  if (shouldCompress) {
    const profile = COMPRESSION_PROFILES[strategy.profile];
    const currentKB = fileSizeBytes / 1024;
    const estimatedKB = Math.min(currentKB * profile.quality, profile.maxSizeKB);
    const savings = Math.round(((currentKB - estimatedKB) / currentKB) * 100);
    estimatedSavings = `~${savings}% (${Math.round(estimatedKB)}KB estimated)`;
  }

  return {
    shouldCompress,
    strategy,
    estimatedSavings
  };
}

/**
 * Get compression profile by name
 */
export function getCompressionProfile(profileName: keyof typeof COMPRESSION_PROFILES): CompressionProfile {
  return COMPRESSION_PROFILES[profileName];
}

/**
 * Get all available profiles for UI display
 */
export function getAllCompressionProfiles(): Array<{
  name: keyof typeof COMPRESSION_PROFILES;
  profile: CompressionProfile;
}> {
  return Object.entries(COMPRESSION_PROFILES).map(([name, profile]) => ({
    name: name as keyof typeof COMPRESSION_PROFILES,
    profile
  }));
}

// ============================================================================
// PERFORMANCE SETTINGS
// ============================================================================

export const COMPRESSION_PERFORMANCE_CONFIG = {
  /** Maximum concurrent compression operations */
  maxConcurrentCompressions: 3,
  /** Canvas scaling quality για compression */
  canvasScalingQuality: 'high' as ImageSmoothingQuality,
  /** Timeout για compression operations (ms) */
  compressionTimeoutMs: 30000,
  /** Enable progressive JPEG για better perceived loading */
  enableProgressiveJPEG: true,
  /** Batch size για batch compression operations */
  batchSize: 5
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  profiles: COMPRESSION_PROFILES,
  usageMap: USAGE_TO_PROFILE_MAP,
  smartConfig: SMART_COMPRESSION_CONFIG,
  performance: COMPRESSION_PERFORMANCE_CONFIG,
  getStrategy: getCompressionStrategy,
  shouldCompress: shouldCompressFile,
  getProfile: getCompressionProfile,
  getAllProfiles: getAllCompressionProfiles
};