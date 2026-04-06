/**
 * 📁 ENTERPRISE FILE SYSTEM SERVICE
 *
 * Database-driven file system configuration για internationalization και customization.
 *
 * Split (ADR-065 Phase 5):
 * - filesystem-types.ts           → Type definitions
 * - filesystem-fallback-config.ts → Fallback data & defaults
 * - EnterpriseFileSystemService.ts (this) → Core service
 *
 * @enterprise-ready true
 */

import { db } from '@/lib/firebase';
import { doc, setDoc, where } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EnterpriseFileSystemService');

// Re-export all types for backward compatibility
export type {
  FileSizeUnit,
  FileTypeValidation,
  FileUploadSettings,
  FileSecuritySettings,
  FileSystemConfiguration,
  EnterpriseFileSystemConfig,
} from './filesystem-types';

import type {
  FileSizeUnit,
  FileTypeValidation,
  FileUploadSettings,
  FileSecuritySettings,
  FileSystemConfiguration,
  EnterpriseFileSystemConfig,
} from './filesystem-types';

import {
  getFallbackConfiguration,
  ensureCompleteConfiguration,
  formatFileSizeFallback,
} from './filesystem-fallback-config';

// ============================================================================
// ENTERPRISE FILE SYSTEM SERVICE
// ============================================================================

class EnterpriseFileSystemService {
  private readonly CONFIG_COLLECTION = COLLECTIONS.CONFIG;
  private readonly configCache = new Map<string, FileSystemConfiguration>();
  private readonly cacheTTL = 15 * 60 * 1000; // 15 minutes
  private cacheTimestamps = new Map<string, number>();

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  private setCache(cacheKey: string, data: FileSystemConfiguration): void {
    this.configCache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /** Invalidate all caches */
  invalidateCache(): void {
    this.configCache.clear();
    this.cacheTimestamps.clear();
    logger.info('🗑️ File system configuration caches invalidated');
  }

  /** Clear cache for specific tenant */
  clearCacheForTenant(tenantId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(tenantId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.configCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.info(`🗑️ Cleared file system cache for tenant: ${tenantId}`);
  }

  // ========================================================================
  // CONFIGURATION LOADING
  // ========================================================================

  /** Load file system configuration for specific locale/tenant */
  async loadFileSystemConfiguration(
    locale: string = 'en',
    tenantId?: string,
    environment?: string
  ): Promise<FileSystemConfiguration> {
    const cacheKey = `fs_config_${locale}_${tenantId || 'default'}_${environment || 'production'}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (cached) {
        logger.info('✅ File system configuration loaded from cache:', cacheKey);
        return cached;
      }
    }

    try {
      logger.info('🔄 Loading file system configuration from Firebase:', { locale, tenantId, environment });

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

      const result = await firestoreQueryService.getAll<EnterpriseFileSystemConfig>(
        'CONFIG', { constraints, tenantOverride: 'skip' }
      );

      let configuration: FileSystemConfiguration | null = null;

      if (!result.isEmpty && result.documents.length > 0) {
        configuration = result.documents[0].configuration;
      }

      if (!configuration) {
        logger.info('🔄 Using fallback file system configuration for locale:', locale);
        configuration = getFallbackConfiguration(locale);
      }

      const completeConfiguration = ensureCompleteConfiguration(configuration);
      this.setCache(cacheKey, completeConfiguration);

      logger.info('✅ File system configuration loaded successfully:', {
        locale,
        tenantId,
        sizeUnitsCount: completeConfiguration.sizeUnits.length,
        fileTypesCount: completeConfiguration.fileTypeValidations.length
      });

      return completeConfiguration;
    } catch (error) {
      logger.error('❌ Error loading file system configuration:', error);
      return getFallbackConfiguration(locale);
    }
  }

  /** Get file size units for specific locale */
  async getFileSizeUnits(locale: string = 'en', tenantId?: string): Promise<FileSizeUnit[]> {
    const config = await this.loadFileSystemConfiguration(locale, tenantId);
    return config.sizeUnits;
  }

  /** Get file type validations for specific tenant */
  async getFileTypeValidations(tenantId?: string, environment?: string): Promise<FileTypeValidation[]> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.fileTypeValidations;
  }

  /** Get upload settings for specific tenant */
  async getUploadSettings(tenantId?: string, environment?: string): Promise<FileUploadSettings> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.uploadSettings;
  }

  /** Get security settings for specific tenant */
  async getSecuritySettings(tenantId?: string, environment?: string): Promise<FileSecuritySettings> {
    const config = await this.loadFileSystemConfiguration('en', tenantId, environment);
    return config.securitySettings;
  }

  // ========================================================================
  // SPECIALIZED UTILITIES
  // ========================================================================

  /** Format file size with locale-specific units */
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
        const largestUnit = sizeUnits[sizeUnits.length - 1];
        const size = bytes / Math.pow(k, sizeUnits.length - 1);
        return parseFloat(size.toFixed(decimals)) + ' ' + largestUnit.labelShort;
      }

      const unit = sizeUnits[i];
      const size = bytes / Math.pow(k, i);
      return parseFloat(size.toFixed(decimals)) + ' ' + unit.labelShort;
    } catch (error) {
      logger.error('Error formatting file size:', error);
      return formatFileSizeFallback(bytes, decimals);
    }
  }

  /** Validate file against tenant rules */
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

      if (file.size > validation.maxSize) {
        const formattedSize = await this.formatFileSize(validation.maxSize, 'en', tenantId);
        return {
          isValid: false,
          error: `File size exceeds maximum allowed size of ${formattedSize}`
        };
      }

      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validation.allowedExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          error: validation.errorMessage || `File extension ${fileExtension} not allowed`
        };
      }

      if (!validation.allowedMimeTypes.includes(file.type)) {
        return {
          isValid: false,
          error: validation.errorMessage || `File type ${file.type} not allowed`
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating file for tenant:', error);
      return { isValid: false, error: 'Validation error occurred' };
    }
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /** Save file system configuration */
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
          displayName: `File system config for ${locale} locale`,
          description: `File system configuration for locale ${locale}`,
          version: '1.0.0',
          lastSyncedAt: new Date(),
          createdBy: 'enterprise-file-system-service',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as EnterpriseFileSystemConfig & { type: string };

      await setDoc(doc(db, this.CONFIG_COLLECTION, configId), config, { merge: true });
      this.clearCacheForTenant(tenantId || 'default');

      logger.info('✅ File system configuration saved:', configId);
    } catch (error) {
      logger.error('❌ Error saving file system configuration:', error);
      throw error;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /** Check if service is ready */
  isReady(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  /** Get cache statistics */
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
