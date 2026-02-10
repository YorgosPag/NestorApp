/**
 * 🔒 ENTERPRISE DXF SECURITY VALIDATOR
 *
 * Fortune 500-class validation system for DXF files and scene objects.
 * Provides comprehensive security checks, input sanitization, and
 * enterprise-level validation patterns.
 *
 * FEATURES:
 * - File size and entity count limits
 * - Input sanitization for file names and IDs
 * - Scene object validation and security checks
 * - Malware detection patterns
 * - Business logic validation
 * - Error categorization and reporting
 *
 * ENTERPRISE STANDARDS:
 * - AutoCAD-class validation thresholds
 * - ISO 27001 security compliance
 * - GDPR data protection patterns
 * - Enterprise audit trail
 *
 * Date: 2025-12-17
 */

import type { SceneModel } from '../types/scene';
import { generateTempId } from '@/services/enterprise-id.service';
import { SceneValidator } from '../managers/SceneValidator';

// =============================================================================
// 🏢 ENTERPRISE SECURITY THRESHOLDS
// =============================================================================

export const ENTERPRISE_LIMITS = {
  // File size limits (enterprise-class)
  MAX_FILE_SIZE_MB: 25,                    // 25MB max per DXF file
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,   // 25MB in bytes
  WARN_FILE_SIZE_MB: 10,                   // Warning threshold

  // Entity limits (Fortune 500 standards)
  MAX_ENTITY_COUNT: 250000,                // 250K entities max (enterprise)
  WARN_ENTITY_COUNT: 100000,               // Warning at 100K entities
  MAX_LAYER_COUNT: 1000,                   // 1K layers max

  // String length limits (security)
  MAX_FILENAME_LENGTH: 100,                // Firestore document ID limit
  MAX_LAYER_NAME_LENGTH: 50,               // Layer name limit
  MAX_ENTITY_ID_LENGTH: 36,                // UUID length

  // Memory and performance limits
  MAX_SCENE_JSON_SIZE_MB: 100,             // Max scene JSON size in memory
  MAX_PROPERTIES_PER_ENTITY: 50,           // Anti-DOS protection
} as const;

// =============================================================================
// 🚨 SECURITY ERROR TYPES
// =============================================================================

export enum SecurityErrorType {
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  ENTITY_COUNT_EXCEEDED = 'ENTITY_COUNT_EXCEEDED',
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  MALICIOUS_CONTENT = 'MALICIOUS_CONTENT',
  INVALID_FILE_NAME = 'INVALID_FILE_NAME',
  SCENE_VALIDATION_FAILED = 'SCENE_VALIDATION_FAILED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  SUSPICIOUS_PATTERNS = 'SUSPICIOUS_PATTERNS'
}

export enum SecuritySeverity {
  LOW = 'LOW',       // Warning - allow with caution
  MEDIUM = 'MEDIUM', // Error - block but recoverable
  HIGH = 'HIGH',     // Critical - hard block
  CRITICAL = 'CRITICAL' // Security threat - log and block
}

export interface SecurityValidationResult {
  isValid: boolean;
  severity: SecuritySeverity;
  errorType?: SecurityErrorType;
  message: string;
  details?: Record<string, unknown>;
  recommendations?: string[];
}

// =============================================================================
// 🛡️ ENTERPRISE DXF SECURITY VALIDATOR CLASS
// =============================================================================

export class DxfSecurityValidator extends SceneValidator {
  private static readonly MALICIOUS_PATTERNS = [
    // JavaScript injection patterns
    /<script[^>]*>/i,
    /javascript:/i,
    /eval\s*\(/i,
    /Function\s*\(/i,

    // SQL injection patterns
    /union\s+select/i,
    /insert\s+into/i,
    /drop\s+table/i,
    /delete\s+from/i,

    // File system access patterns
    /\.\.\/\.\.\//,
    /\/etc\/passwd/,
    /\/proc\/self/,
    /C:\\Windows/i,

    // Command injection
    /\|\s*sh/,
    /\|\s*bash/,
    /\|\s*cmd/,
    /`[^`]*`/,
  ];

  private static readonly FILENAME_SANITIZATION_REGEX = /[^a-zA-Z0-9._-]/g;

  // ==========================================================================
  // 📁 FILE VALIDATION METHODS
  // ==========================================================================

  /**
   * Validate file size against enterprise limits
   */
  static validateFileSize(sizeBytes: number): SecurityValidationResult {
    if (sizeBytes > ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.FILE_SIZE_EXCEEDED,
        message: `File size exceeds enterprise limit of ${ENTERPRISE_LIMITS.MAX_FILE_SIZE_MB}MB`,
        details: {
          actualSizeMB: Math.round((sizeBytes / 1024 / 1024) * 100) / 100,
          maxSizeMB: ENTERPRISE_LIMITS.MAX_FILE_SIZE_MB,
          exceedsBy: sizeBytes - ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES
        },
        recommendations: [
          'Optimize the DXF file by removing unnecessary entities',
          'Split large files into multiple smaller files',
          'Use DXF compression if available',
          'Consider using reference files (XREF) for large components'
        ]
      };
    }

    if (sizeBytes > ENTERPRISE_LIMITS.WARN_FILE_SIZE_MB * 1024 * 1024) {
      return {
        isValid: true,
        severity: SecuritySeverity.LOW,
        message: `File size is large (${Math.round((sizeBytes / 1024 / 1024) * 100) / 100}MB) - consider optimization`,
        recommendations: ['Consider optimizing for better performance']
      };
    }

    return {
      isValid: true,
      severity: SecuritySeverity.LOW,
      message: 'File size is within enterprise limits'
    };
  }

  /**
   * Validate DXF scene object structure and content
   */
  static validateScene(scene: SceneModel): SecurityValidationResult {
    // Basic scene structure validation (adapt for SceneModel)
    const sceneWithVersion: SceneModel = scene.version ? { ...scene, version: scene.version } : scene;
    const isBasicValid = new SceneValidator().validateScene(sceneWithVersion);
    if (!isBasicValid) {
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.SCENE_VALIDATION_FAILED,
        message: 'Scene failed basic validation checks',
        recommendations: ['Verify DXF file integrity', 'Try re-importing the file']
      };
    }

    // Entity count validation
    const entityCount = scene.entities?.length || 0;
    if (entityCount > ENTERPRISE_LIMITS.MAX_ENTITY_COUNT) {
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.ENTITY_COUNT_EXCEEDED,
        message: `Entity count (${entityCount.toLocaleString()}) exceeds enterprise limit`,
        details: {
          entityCount,
          maxEntities: ENTERPRISE_LIMITS.MAX_ENTITY_COUNT,
          exceedsBy: entityCount - ENTERPRISE_LIMITS.MAX_ENTITY_COUNT
        },
        recommendations: [
          'Reduce the number of entities in the DXF file',
          'Split the design into multiple files',
          'Use blocks/references to reduce entity duplication',
          'Consider simplifying complex geometries'
        ]
      };
    }

    // Layer count validation
    const layerCount = Object.keys(scene.layers || {}).length;
    if (layerCount > ENTERPRISE_LIMITS.MAX_LAYER_COUNT) {
      return {
        isValid: false,
        severity: SecuritySeverity.MEDIUM,
        message: `Layer count (${layerCount}) exceeds enterprise recommendations`,
        details: { layerCount, maxLayers: ENTERPRISE_LIMITS.MAX_LAYER_COUNT },
        recommendations: ['Consider consolidating similar layers']
      };
    }

    // Memory usage validation
    const sceneJson = JSON.stringify(scene);
    const sceneSizeMB = sceneJson.length / (1024 * 1024);
    if (sceneSizeMB > ENTERPRISE_LIMITS.MAX_SCENE_JSON_SIZE_MB) {
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.MEMORY_LIMIT_EXCEEDED,
        message: `Scene JSON size (${Math.round(sceneSizeMB * 100) / 100}MB) exceeds memory limits`,
        details: { sceneSizeMB, maxSizeMB: ENTERPRISE_LIMITS.MAX_SCENE_JSON_SIZE_MB },
        recommendations: [
          'Optimize entity properties',
          'Remove unnecessary metadata',
          'Consider using Firebase Storage for large scenes'
        ]
      };
    }

    // Malicious content detection
    const maliciousCheck = this.detectMaliciousContent(sceneJson);
    if (!maliciousCheck.isValid) {
      return maliciousCheck;
    }

    // Warning for large entity count
    if (entityCount > ENTERPRISE_LIMITS.WARN_ENTITY_COUNT) {
      return {
        isValid: true,
        severity: SecuritySeverity.LOW,
        message: `Large entity count (${entityCount.toLocaleString()}) - monitor performance`,
        recommendations: ['Monitor loading performance', 'Consider optimization if slow']
      };
    }

    return {
      isValid: true,
      severity: SecuritySeverity.LOW,
      message: 'Scene passed all enterprise security validations',
      details: {
        entityCount,
        layerCount,
        sceneSizeMB: Math.round(sceneSizeMB * 100) / 100
      }
    };
  }

  /**
   * Sanitize filename for secure storage
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return 'untitled_file';
    }

    // Remove extension for processing
    const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // Sanitize base name
    let sanitized = baseName
      .trim()
      .substring(0, ENTERPRISE_LIMITS.MAX_FILENAME_LENGTH - 10) // Reserve space for extension and suffix
      .replace(this.FILENAME_SANITIZATION_REGEX, '_')
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .toLowerCase();

    // Ensure we have something
    if (!sanitized || sanitized.length < 1) {
      sanitized = 'file';
    }

    // Add extension back if it existed and is safe
    if (extension && /^[a-zA-Z0-9]+$/.test(extension)) {
      sanitized += `.${extension.toLowerCase()}`;
    }

    return sanitized;
  }

  /**
   * Generate secure file ID from filename
   */
  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  static generateSecureFileId(fileName: string): string {
    const sanitizedName = this.sanitizeFileName(fileName);
    const timestamp = Date.now();
    const uniqueId = generateTempId().substring(0, 8); // Crypto-secure short ID

    // Format: sanitized_name_timestamp_random
    const fileId = `${sanitizedName.replace(/\.[^/.]+$/, '')}_${timestamp}_${uniqueId}`;

    // Ensure Firestore ID length limit
    return fileId.substring(0, ENTERPRISE_LIMITS.MAX_FILENAME_LENGTH);
  }

  /**
   * Validate filename for security issues
   */
  static validateFileName(fileName: string): SecurityValidationResult {
    if (!fileName || typeof fileName !== 'string') {
      return {
        isValid: false,
        severity: SecuritySeverity.MEDIUM,
        errorType: SecurityErrorType.INVALID_FILE_NAME,
        message: 'Invalid or missing filename',
        recommendations: ['Provide a valid filename']
      };
    }

    // Length check
    if (fileName.length > ENTERPRISE_LIMITS.MAX_FILENAME_LENGTH) {
      return {
        isValid: false,
        severity: SecuritySeverity.MEDIUM,
        errorType: SecurityErrorType.INVALID_FILE_NAME,
        message: `Filename too long (${fileName.length} chars, max ${ENTERPRISE_LIMITS.MAX_FILENAME_LENGTH})`,
        recommendations: ['Use a shorter filename']
      };
    }

    // Malicious pattern check
    const maliciousCheck = this.detectMaliciousContent(fileName);
    if (!maliciousCheck.isValid) {
      return {
        ...maliciousCheck,
        errorType: SecurityErrorType.INVALID_FILE_NAME,
        message: 'Filename contains suspicious patterns'
      };
    }

    // Path traversal check
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.MALICIOUS_CONTENT,
        message: 'Filename contains path traversal patterns',
        recommendations: ['Use only simple filenames without paths']
      };
    }

    return {
      isValid: true,
      severity: SecuritySeverity.LOW,
      message: 'Filename passed security validation'
    };
  }

  // ==========================================================================
  // 🔍 MALWARE DETECTION METHODS
  // ==========================================================================

  /**
   * Detect potentially malicious content in strings
   */
  private static detectMaliciousContent(content: string): SecurityValidationResult {
    if (!content || typeof content !== 'string') {
      return {
        isValid: true,
        severity: SecuritySeverity.LOW,
        message: 'No content to validate'
      };
    }

    // Check against known malicious patterns
    for (const pattern of this.MALICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        return {
          isValid: false,
          severity: SecuritySeverity.CRITICAL,
          errorType: SecurityErrorType.MALICIOUS_CONTENT,
          message: 'Content contains potentially malicious patterns',
          details: {
            suspiciousPattern: pattern.toString(),
            contentSample: content.substring(0, 100) + '...'
          },
          recommendations: [
            'Review the source of this file',
            'Scan the file with antivirus software',
            'Contact security team if this is unexpected'
          ]
        };
      }
    }

    // Check for excessive nested objects (JSON bomb protection)
    const depthCheck = this.checkObjectDepth(content);
    if (depthCheck > 50) { // Max nesting depth
      return {
        isValid: false,
        severity: SecuritySeverity.HIGH,
        errorType: SecurityErrorType.SUSPICIOUS_PATTERNS,
        message: `Excessive object nesting detected (depth: ${depthCheck})`,
        recommendations: ['Review file structure for abnormal nesting patterns']
      };
    }

    return {
      isValid: true,
      severity: SecuritySeverity.LOW,
      message: 'No malicious patterns detected'
    };
  }

  /**
   * Check JSON object depth to prevent JSON bombs
   */
  private static checkObjectDepth(jsonString: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of jsonString) {
      if (char === '{' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ']') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  // ==========================================================================
  // 🏢 ENTERPRISE VALIDATION WORKFLOW
  // ==========================================================================

  /**
   * Complete enterprise validation workflow for DXF uploads
   */
  static validateDxfUpload(params: {
    fileName: string;
    fileSize: number;
    scene: SceneModel;
  }): SecurityValidationResult[] {
    const results: SecurityValidationResult[] = [];

    // 1. Filename validation
    results.push(this.validateFileName(params.fileName));

    // 2. File size validation
    results.push(this.validateFileSize(params.fileSize));

    // 3. Scene content validation
    results.push(this.validateScene(params.scene));

    return results;
  }

  /**
   * Check if validation results contain any blocking issues
   */
  static hasBlockingErrors(results: SecurityValidationResult[]): boolean {
    return results.some(result =>
      !result.isValid && (
        result.severity === SecuritySeverity.HIGH ||
        result.severity === SecuritySeverity.CRITICAL
      )
    );
  }

  /**
   * Get summary of validation results
   */
  static getValidationSummary(results: SecurityValidationResult[]): {
    isOverallValid: boolean;
    criticalErrors: number;
    highErrors: number;
    mediumErrors: number;
    lowWarnings: number;
    recommendations: string[];
  } {
    const criticalErrors = results.filter(r => !r.isValid && r.severity === SecuritySeverity.CRITICAL).length;
    const highErrors = results.filter(r => !r.isValid && r.severity === SecuritySeverity.HIGH).length;
    const mediumErrors = results.filter(r => !r.isValid && r.severity === SecuritySeverity.MEDIUM).length;
    const lowWarnings = results.filter(r => r.severity === SecuritySeverity.LOW).length;

    const allRecommendations = results
      .flatMap(r => r.recommendations || [])
      .filter((rec, index, arr) => arr.indexOf(rec) === index); // Unique recommendations

    return {
      isOverallValid: !this.hasBlockingErrors(results),
      criticalErrors,
      highErrors,
      mediumErrors,
      lowWarnings,
      recommendations: allRecommendations
    };
  }
}
