/**
 * 📁 ENTERPRISE FILE SYSTEM — TYPES
 *
 * Extracted from EnterpriseFileSystemService.ts (ADR-065 Phase 5)
 * Type definitions for file system configuration
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** File size unit configuration */
export interface FileSizeUnit {
  key: string;
  label: string;
  labelShort: string;
  factor: number;
  order: number;
}

/** File type validation configuration */
export interface FileTypeValidation {
  fileType: string;
  maxSize: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  errorMessage: string;
  isEnabled: boolean;
}

/** File upload settings */
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

/** Security settings για file handling */
export interface FileSecuritySettings {
  enableVirusScanning: boolean;
  quarantineDirectory: string;
  allowExecutableFiles: boolean;
  blockSuspiciousExtensions: boolean;
  enableContentTypeValidation: boolean;
  maxFileNameLength: number;
  allowSpecialCharacters: boolean;
}

/** Complete file system configuration */
export interface FileSystemConfiguration {
  sizeUnits: FileSizeUnit[];
  fileTypeValidations: FileTypeValidation[];
  uploadSettings: FileUploadSettings;
  securitySettings: FileSecuritySettings;
  validationMessages: Record<string, string>;
  customSettings: Record<string, unknown>;
}

/** File system configuration για Firebase */
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
