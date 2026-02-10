/**
 * 📁 ENTERPRISE FILE SYSTEM SERVICE
 *
 * Database-driven file system configuration για internationalization και customization.
 * Replaces hardcoded file size units με configurable, locale-specific solutions.
 *
 * Features:
 * - Database-driven file system settings (Firestore)
 * - Multi-locale file size units
 * - Tenant-specific file handling rules
 * - Customizable validation messages
 * - Performance-optimized caching
 * - File type restrictions per tenant
 * - Upload limits configuration
 * - Fallback system για offline mode
 *
 * @version 1.0.0
 * @enterprise-ready true
 */

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * File size unit configuration
 */
export interface FileSizeUnit {
  key: string;
  label: string;
  labelShort: string;
  factor: number;
  order: number;
}

/**
 * File type validation configuration
 */
export interface FileTypeValidation {
  fileType: string;
  maxSize: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  errorMessage: string;
  isEnabled: boolean;
}

/**
 * File upload settings
 */
export interface FileUploadSettings {
  maxConcurrentUploads: number;
  chunkSize: number;
  retryAttempts: number;
  timeoutSeconds: number;
  enableProgressTracking: boolean;
  enableThumbnailGeneration: boolean;
  thumbnailSizes: number[];
  compressionEnabled: boolean;
  compressionQuality: number;
}

/**
 * Security settings για file handling
 */
export interface FileSecuritySettings {
  enableVirusScanning: boolean;
  quarantineDirectory: string;
  allowExecutableFiles: boolean;
  blockSuspiciousExtensions: boolean;
  enableContentTypeValidation: boolean;
  maxFileNameLength: number;
  allowSpecialCharacters: boolean;
}

/**
 * Complete file system configuration
 */
export interface FileSystemConfiguration {
  sizeUnits: FileSizeUnit[];
  fileTypeValidations: FileTypeValidation[];
  uploadSettings: FileUploadSettings;
  securitySettings: FileSecuritySettings;
  validationMessages: Record<string, string>;
  customSettings: Record<string, unknown>;
}

/**
 * File system configuration για Firebase
 */
export interface EnterpriseFileSystemConfig {
  id: string;
  tenantId?: string;
  locale: string;
  environment?: string;
  configuration: FileSystemConfiguration;
  isEnabled: boolean;
  priority: number;
  metadata: {
    displayName?: string;
    description?: string;
    version?: string;
    lastSyncedAt?: Date;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

// ============================================================================
// ENTERPRISE FILE SYSTEM SERVICE
// ============================================================================

class EnterpriseFileSystemService {
  private readonly CONFIG_COLLECTION = COLLECTIONS.CONFIG;
  private readonly configCache = new Map<string, FileSystemConfiguration>();
  private readonly cacheTTL = 15 * 60 * 1000; // 15 minutes για system settings
  private cacheTimestamps = new Map<string, number>();

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * Check if cache is valid για specific key
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Set cache με timestamp
   */
  private setCache(cacheKey: string, data: FileSystemConfiguration): void {
    this.configCache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Invalidate all caches
   */
  invalidateCache(): void {
    this.configCache.clear();
    this.cacheTimestamps.clear();
    console.log('🗑️ File system configuration caches invalidated');
  }

  /**
   * Clear cache για specific tenant
   */
  clearCacheForTenant(tenantId: string): void {
    const keysToDelete: string[] = [];

    // Find all cache keys που περιέχουν το tenantId
    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(tenantId)) {
        keysToDelete.push(key);
      }
    }

    // Delete matching entries
    keysToDelete.forEach(key => {
      this.configCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    console.log(`🗑️ Cleared file system cache for tenant: ${tenantId}`);
  }

  // ========================================================================
  // CONFIGURATION LOADING - CORE FUNCTIONALITY
  // ========================================================================

  /**
   * 📁 Load file system configuration για specific locale/tenant
   */
  async loadFileSystemConfiguration(
    locale: string = 'en',
    tenantId?: string,
    environment?: string
  ): Promise<FileSystemConfiguration> {
    const cacheKey = `fs_config_${locale}_${tenantId || 'default'}_${environment || 'production'}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (cached) {
        console.log('✅ File system configuration loaded from cache:', cacheKey);
        return cached;
      }
    }

    try {
      console.log('🔄 Loading file system configuration from Firebase:', { locale, tenantId, environment });

      // Build query constraints
      const constraints = [
        where('type', '==', 'file-system-config'),
        where('locale', '==', locale),
        where('isEnabled', '==', true)
      ];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      if (environment) {
        constraints.push(where('environment', '==', environment));
      }

      // Query Firestore
      const q = query(collection(db, this.CONFIG_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(q);

      let configuration: FileSystemConfiguration | null = null;

      if (!querySnapshot.empty) {
        // Use the first configuration found (highest priority)
        const configDoc = querySnapshot.docs[0];
        const configData = configDoc.data() as EnterpriseFileSystemConfig;
        configuration = configData.configuration;
      }

      // Fallback to default configuration if not found
      if (!configuration) {
        console.log('🔄 Using fallback file system configuration για locale:', locale);
        configuration = this.getFallbackConfiguration(locale);
      }

      // Ensure complete configuration
      const completeConfiguration = this.ensureCompleteConfiguration(configuration);

      // Cache the results
      this.setCache(cacheKey, completeConfiguration);

      console.log('✅ File system configuration loaded successfully:', {
        locale,
        tenantId,
        sizeUnitsCount: completeConfiguration.sizeUnits.length,
        fileTypesCount: completeConfiguration.fileTypeValidations.length
      });

      return completeConfiguration;

    } catch (error) {
      console.error('❌ Error loading file system configuration:', error);

      // Return fallback configuration
      console.log('🔄 Using fallback file system configuration:', locale);
      return this.getFallbackConfiguration(locale);
    }
  }

  /**
   * 📏 Get file size units για specific locale
   */
  async getFileSizeUnits(
    locale: string = 'en',
    tenantId?: string
  ): Promise<FileSizeUnit[]> {
    const config = await this.loadFileSystemConfiguration(locale, tenantId);
    return config.sizeUnits;
  }

  /**
   * 📋 Get file type validations για specific tenant
   */
  async getFileTypeValidations(
    tenantId?: string,
    environment?: string
  ): Promise<FileTypeValidation[]> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.fileTypeValidations;
  }

  /**
   * ⚙️ Get upload settings για specific tenant
   */
  async getUploadSettings(
    tenantId?: string,
    environment?: string
  ): Promise<FileUploadSettings> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.uploadSettings;
  }

  /**
   * 🔒 Get security settings για specific tenant
   */
  async getSecuritySettings(
    tenantId?: string,
    environment?: string
  ): Promise<FileSecuritySettings> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.securitySettings;
  }

  // ========================================================================
  // SPECIALIZED UTILITIES
  // ========================================================================

  /**
   * 📏 Format file size με locale-specific units
   */
  async formatFileSize(
    bytes: number,
    locale: string = 'en',
    tenantId?: string,
    decimals: number = 2
  ): Promise<string> {
    if (bytes === 0) return '0 Bytes';

    try {
      const sizeUnits = await this.getFileSizeUnits(locale, tenantId);
      const k = 1024;
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      if (i >= sizeUnits.length) {
        // Use the largest available unit
        const largestUnit = sizeUnits[sizeUnits.length - 1];
        const size = bytes / Math.pow(k, sizeUnits.length - 1);
        return parseFloat(size.toFixed(decimals)) + ' ' + largestUnit.labelShort;
      }

      const unit = sizeUnits[i];
      const size = bytes / Math.pow(k, i);
      return parseFloat(size.toFixed(decimals)) + ' ' + unit.labelShort;

    } catch (error) {
      console.error('Error formatting file size:', error);
      // Fallback to English units
      return this.formatFileSizeFallback(bytes, decimals);
    }
  }

  /**
   * 🔍 Validate file extension against tenant rules
   */
  async validateFileForTenant(
    file: File,
    fileType: string,
    tenantId?: string,
    environment?: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const validations = await this.getFileTypeValidations(tenantId, environment);
      const validation = validations.find(v => v.fileType === fileType);

      if (!validation || !validation.isEnabled) {
        return { isValid: false, error: `File type ${fileType} not allowed` };
      }

      // Check file size
      if (file.size > validation.maxSize) {
        const formattedSize = await this.formatFileSize(validation.maxSize, 'en', tenantId);
        return {
          isValid: false,
          error: `File size exceeds maximum allowed size of ${formattedSize}`
        };
      }

      // Check extension
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validation.allowedExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          error: validation.errorMessage || `File extension ${fileExtension} not allowed`
        };
      }

      // Check MIME type
      if (!validation.allowedMimeTypes.includes(file.type)) {
        return {
          isValid: false,
          error: validation.errorMessage || `File type ${file.type} not allowed`
        };
      }

      return { isValid: true };

    } catch (error) {
      console.error('Error validating file for tenant:', error);
      return { isValid: false, error: 'Validation error occurred' };
    }
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /**
   * 💾 Save file system configuration
   */
  async saveFileSystemConfiguration(
    locale: string,
    configuration: FileSystemConfiguration,
    tenantId?: string,
    environment?: string
  ): Promise<void> {
    try {
      const configId = `fs-config-${locale}-${tenantId || 'default'}-${environment || 'production'}`;

      const config: EnterpriseFileSystemConfig = {
        id: configId,
        tenantId,
        locale,
        environment,
        configuration,
        isEnabled: true,
        priority: 1,
        type: 'file-system-config',
        metadata: {
          displayName: `File system config για ${locale} locale`,
          description: `File system configuration για locale ${locale}`,
          version: '1.0.0',
          lastSyncedAt: new Date(),
          createdBy: 'enterprise-file-system-service',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as EnterpriseFileSystemConfig & { type: string };

      await setDoc(doc(db, this.CONFIG_COLLECTION, configId), config, { merge: true });

      // Invalidate relevant caches
      this.clearCacheForTenant(tenantId || 'default');

      console.log('✅ File system configuration saved:', configId);
    } catch (error) {
      console.error('❌ Error saving file system configuration:', error);
      throw error;
    }
  }

  // ========================================================================
  // FALLBACK SYSTEMS
  // ========================================================================

  /**
   * 🛡️ Get fallback configuration για specific locale
   */
  getFallbackConfiguration(locale: string): FileSystemConfiguration {
    const baseConfig: FileSystemConfiguration = {
      sizeUnits: this.getFallbackSizeUnits(locale),
      fileTypeValidations: this.getFallbackFileTypeValidations(),
      uploadSettings: this.getFallbackUploadSettings(),
      securitySettings: this.getFallbackSecuritySettings(),
      validationMessages: this.getFallbackValidationMessages(locale),
      customSettings: {}
    };

    return baseConfig;
  }

  /**
   * 📏 Get fallback size units για specific locale
   */
  private getFallbackSizeUnits(locale: string): FileSizeUnit[] {
    const unitsMap: Record<string, FileSizeUnit[]> = {
      en: [
        { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
        { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
        { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
        { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
        { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
      ],
      el: [
        { key: 'bytes', label: 'Ψηφιολέξεις', labelShort: 'Bytes', factor: 1, order: 0 },
        { key: 'kb', label: 'Κιλοψηφιολέξεις', labelShort: 'KB', factor: 1024, order: 1 },
        { key: 'mb', label: 'Μεγαψηφιολέξεις', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
        { key: 'gb', label: 'Γιγαψηφιολέξεις', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
        { key: 'tb', label: 'Τεραψηφιολέξεις', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
      ],
      de: [
        { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
        { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
        { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
        { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
        { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
      ],
      fr: [
        { key: 'bytes', label: 'Octets', labelShort: 'octets', factor: 1, order: 0 },
        { key: 'kb', label: 'Kilooctets', labelShort: 'Ko', factor: 1024, order: 1 },
        { key: 'mb', label: 'Mégaoctets', labelShort: 'Mo', factor: 1024 * 1024, order: 2 },
        { key: 'gb', label: 'Gigaoctets', labelShort: 'Go', factor: 1024 * 1024 * 1024, order: 3 },
        { key: 'tb', label: 'Téraoctets', labelShort: 'To', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
      ]
    };

    return unitsMap[locale] || unitsMap['en'];
  }

  /**
   * 📋 Get fallback file type validations
   */
  private getFallbackFileTypeValidations(): FileTypeValidation[] {
    return [
      {
        fileType: 'image',
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        errorMessage: 'Please select a valid image file (JPG, PNG, GIF, WebP)',
        isEnabled: true
      },
      {
        fileType: 'document',
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
        allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/rtf'],
        errorMessage: 'Please select a valid document file (PDF, DOC, DOCX, TXT, RTF)',
        isEnabled: true
      },
      {
        fileType: 'video',
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
        allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
        errorMessage: 'Please select a valid video file (MP4, MOV, AVI, MKV, WebM)',
        isEnabled: true
      },
      {
        fileType: 'any',
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: [],
        allowedMimeTypes: [],
        errorMessage: 'File too large or invalid format',
        isEnabled: true
      }
    ];
  }

  /**
   * ⚙️ Get fallback upload settings
   */
  private getFallbackUploadSettings(): FileUploadSettings {
    return {
      maxConcurrentUploads: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS || '3'),
      chunkSize: parseInt(process.env.NEXT_PUBLIC_UPLOAD_CHUNK_SIZE || '1048576'), // 1MB
      retryAttempts: parseInt(process.env.NEXT_PUBLIC_UPLOAD_RETRY_ATTEMPTS || '3'),
      timeoutSeconds: parseInt(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT || '300'), // 5 minutes
      enableProgressTracking: process.env.NEXT_PUBLIC_ENABLE_PROGRESS_TRACKING !== 'false',
      enableThumbnailGeneration: process.env.NEXT_PUBLIC_ENABLE_THUMBNAIL_GENERATION !== 'false',
      thumbnailSizes: [150, 300, 500],
      compressionEnabled: process.env.NEXT_PUBLIC_ENABLE_COMPRESSION !== 'false',
      compressionQuality: parseFloat(process.env.NEXT_PUBLIC_COMPRESSION_QUALITY || '0.8')
    };
  }

  /**
   * 🔒 Get fallback security settings
   */
  private getFallbackSecuritySettings(): FileSecuritySettings {
    return {
      enableVirusScanning: process.env.NEXT_PUBLIC_ENABLE_VIRUS_SCANNING === 'true',
      quarantineDirectory: process.env.NEXT_PUBLIC_QUARANTINE_DIR || '/quarantine',
      allowExecutableFiles: process.env.NEXT_PUBLIC_ALLOW_EXECUTABLES === 'true',
      blockSuspiciousExtensions: process.env.NEXT_PUBLIC_BLOCK_SUSPICIOUS !== 'false',
      enableContentTypeValidation: process.env.NEXT_PUBLIC_VALIDATE_CONTENT_TYPE !== 'false',
      maxFileNameLength: parseInt(process.env.NEXT_PUBLIC_MAX_FILENAME_LENGTH || '255'),
      allowSpecialCharacters: process.env.NEXT_PUBLIC_ALLOW_SPECIAL_CHARS === 'true'
    };
  }

  /**
   * 💬 Get fallback validation messages για specific locale
   */
  private getFallbackValidationMessages(locale: string): Record<string, string> {
    const messagesMap: Record<string, Record<string, string>> = {
      en: {
        fileTooLarge: 'File size exceeds the maximum allowed limit',
        invalidFileType: 'File type is not allowed',
        invalidExtension: 'File extension is not allowed',
        uploadFailed: 'File upload failed',
        processingFailed: 'File processing failed'
      },
      el: {
        fileTooLarge: 'Το μέγεθος του αρχείου υπερβαίνει το επιτρεπόμενο όριο',
        invalidFileType: 'Ο τύπος αρχείου δεν επιτρέπεται',
        invalidExtension: 'Η επέκταση αρχείου δεν επιτρέπεται',
        uploadFailed: 'Η μεταφόρτωση του αρχείου απέτυχε',
        processingFailed: 'Η επεξεργασία του αρχείου απέτυχε'
      }
    };

    return messagesMap[locale] || messagesMap['en'];
  }

  /**
   * 🔧 Ensure complete configuration με fallbacks
   */
  private ensureCompleteConfiguration(config: FileSystemConfiguration): FileSystemConfiguration {
    return {
      sizeUnits: config.sizeUnits || this.getFallbackSizeUnits('en'),
      fileTypeValidations: config.fileTypeValidations || this.getFallbackFileTypeValidations(),
      uploadSettings: config.uploadSettings || this.getFallbackUploadSettings(),
      securitySettings: config.securitySettings || this.getFallbackSecuritySettings(),
      validationMessages: config.validationMessages || this.getFallbackValidationMessages('en'),
      customSettings: config.customSettings || {}
    };
  }

  /**
   * 📏 Fallback file size formatting
   */
  private formatFileSizeFallback(bytes: number, decimals: number = 2): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return parseFloat(size.toFixed(decimals)) + ' ' + sizes[i];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * 🧪 Check if service is ready
   */
  isReady(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  /**
   * 📊 Get cache statistics
   */
  getCacheStats() {
    return {
      configCacheSize: this.configCache.size,
      totalCacheEntries: this.cacheTimestamps.size,
      cacheTTL: this.cacheTTL
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const fileSystemService = new EnterpriseFileSystemService();
export default fileSystemService;

// Types already exported inline above
