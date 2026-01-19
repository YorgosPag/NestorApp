// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

/**
 * Enterprise File Upload Configuration
 *
 * Κεντρικοποιημένες ρυθμίσεις για file upload functionality.
 * Extracted από useEnterpriseFileUpload για reusability.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FileType = 'image' | 'pdf' | 'document' | 'any';
export type UploadPurpose = 'photo' | 'logo' | 'document' | 'floorplan' | 'avatar' | 'representative';

export interface FileTypeConfig {
  mimeTypes: string[];
  extensions: string[];
  maxSize: number;
  errorMessage: string;
}

export interface PurposeConfig {
  label: string;
  description: string;
}

// ============================================================================
// FILE TYPE CONFIGURATIONS
// ============================================================================

/**
 * Configuration για κάθε file type
 * Περιλαμβάνει MIME types, extensions, size limits και error messages
 */
export const FILE_TYPE_CONFIG: Record<FileType, FileTypeConfig> = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    errorMessage: 'Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, GIF, WebP)'
  },
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    maxSize: 20 * 1024 * 1024, // 20MB
    errorMessage: 'Επιλέξτε μόνο αρχεία PDF'
  },
  document: {
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.doc', '.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
    errorMessage: 'Επιλέξτε αρχεία PDF, DOC ή DOCX'
  },
  any: {
    mimeTypes: [],
    extensions: [],
    maxSize: 50 * 1024 * 1024, // 50MB
    errorMessage: 'Μη έγκυρος τύπος αρχείου'
  }
};

// ============================================================================
// PURPOSE CONFIGURATIONS
// ============================================================================

/**
 * Configuration για κάθε upload purpose
 * Περιλαμβάνει labels και descriptions για UI
 */
export const PURPOSE_CONFIG: Record<UploadPurpose, PurposeConfig> = {
  photo: {
    label: 'Φωτογραφία',
    description: 'Κάντε κλικ ή σύρετε φωτογραφία εδώ'
  },
  logo: {
    label: 'Λογότυπο',
    description: 'Κάντε κλικ ή σύρετε λογότυπο εδώ'
  },
  document: {
    label: 'Έγγραφο',
    description: 'Κάντε κλικ ή σύρετε έγγραφο εδώ'
  },
  floorplan: {
    label: 'Κάτοψη',
    description: 'Κάντε κλικ ή σύρετε αρχείο κάτοψης εδώ'
  },
  avatar: {
    label: 'Φωτογραφία Προφίλ',
    description: 'Κάντε κλικ ή σύρετε φωτογραφία προφίλ εδώ'
  },
  representative: {
    label: 'Φωτογραφία Εκπροσώπου',
    description: 'Κάντε κλικ ή σύρετε φωτογραφία εκπροσώπου εδώ'
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default file upload limits
 */
export const UPLOAD_LIMITS = {
  DEFAULT_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILE_SIZE: 50 * 1024 * 1024,   // 50MB
  MIN_FILE_SIZE: 1024,               // 1KB
} as const;

/**
 * Upload phases for progress tracking
 */
export const UPLOAD_PHASES = {
  VALIDATION: 'validation',
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  COMPLETE: 'complete'
} as const;

export type UploadPhase = typeof UPLOAD_PHASES[keyof typeof UPLOAD_PHASES];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Build accept string from file type configurations
 * Eliminates hardcoded accept strings in components
 *
 * @param types - Array of file types to accept
 * @returns Accept string for HTML input element (e.g., "image/*,.pdf,.doc,.docx")
 */
export function buildAcceptString(types: FileType[]): string {
  const mimeTypes = new Set<string>();
  const extensions = new Set<string>();

  types.forEach(type => {
    const config = FILE_TYPE_CONFIG[type];
    config.mimeTypes.forEach(mime => mimeTypes.add(mime));
    config.extensions.forEach(ext => extensions.add(ext));
  });

  // Combine mime types and extensions
  return [...Array.from(mimeTypes), ...Array.from(extensions)].join(',');
}

/**
 * 🏢 ENTERPRISE: Get default accept string for documents
 * Common use case: images + PDFs + Office documents
 */
export const DEFAULT_DOCUMENT_ACCEPT = buildAcceptString(['image', 'pdf', 'document']);