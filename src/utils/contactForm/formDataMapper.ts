// ============================================================================
// ⚠️ DEPRECATED - ENTERPRISE FORM DATA MAPPER REDIRECT
// ============================================================================
//
// 🚨 This monolithic file has been REPLACED with modular Enterprise architecture
//
// OLD STRUCTURE (❌ Deprecated):
// - 643 lines of mixed mapping logic in single file
// - Poor maintainability and reusability
// - Monolithic "God Object" anti-pattern
// - Mixed concerns (validation, extraction, mapping, cleaning)
//
// NEW STRUCTURE (✅ Enterprise):
// - Modular architecture with focused modules
// - Clean separation of concerns
// - Better tree-shaking and performance
// - Enhanced developer experience
//
// ============================================================================

// ============================================================================
// 🔄 MIGRATION GUIDE
// ============================================================================

/*

BEFORE (Old imports):
import { mapFormDataToContact, cleanUndefinedValues } from './formDataMapper';

AFTER (New imports):
import { mapFormDataToContact, cleanUndefinedValues } from './formDataMapper';

No import changes needed! Backward compatibility maintained.

ADVANCED IMPORTS (for better tree-shaking):
import { mapFormDataToContact } from './modular/orchestrator';
import { mapIndividualFormData } from './modular/mappers';
import { extractPhotoURL } from './modular/extractors';
import { cleanUndefinedValues } from './modular/utils';

*/

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// All exports from the new modular structure
export * from './modular';
export { mapFormDataToContact } from './modular/orchestrator';
export type { FormDataMappingResult } from './modular/orchestrator';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('formDataMapper-legacy');

// ============================================================================
// DEPRECATION WARNING
// ============================================================================

logger.warn('DEPRECATION WARNING: Direct import from formDataMapper.ts - use modular structure instead');

// Note: This file provides full backward compatibility while encouraging migration to the new modular structure

// ============================================================================
// LEGACY FUNCTION EXPORTS (Backward Compatibility)
// ============================================================================

// Import from new modular structure for backward compatibility
const {
  isFirebaseStorageURL: _isFirebaseStorageURL,
  requiresSpecialDeletion: _requiresSpecialDeletion,
  cleanUndefinedValues: _cleanUndefinedValues,
  extractMultiplePhotoURLs: _extractMultiplePhotoURLs,
  extractPhotoURL: _extractPhotoURL,
  extractLogoURL: _extractLogoURL,
  validateUploadState: _validateUploadState,
  createEmailsArray: _createEmailsArray,
  createPhonesArray: _createPhonesArray,
  mapIndividualFormData: _mapIndividualFormData,
  mapCompanyFormData: _mapCompanyFormData,
  mapServiceFormData: _mapServiceFormData
} = require('./modular');

// Legacy function exports για backward compatibility
export function isFirebaseStorageURL(url: string | undefined | null): boolean {
  logger.warn(' isFirebaseStorageURL is deprecated. Use utils from modular structure instead.');
  return _isFirebaseStorageURL(url);
}

export function requiresSpecialDeletion(key: string, value: unknown): boolean {
  logger.warn(' requiresSpecialDeletion is deprecated. Use utils from modular structure instead.');
  return _requiresSpecialDeletion(key, value);
}

export function cleanUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
  logger.warn(' cleanUndefinedValues is deprecated. Use utils from modular structure instead.');
  return _cleanUndefinedValues(obj);
}

export function extractMultiplePhotoURLs(formData: Record<string, unknown>): string[] {
  logger.warn(' extractMultiplePhotoURLs is deprecated. Use extractors from modular structure instead.');
  return _extractMultiplePhotoURLs(formData);
}

// 🏢 ENTERPRISE: Import UploadValidationResult type for proper return typing
import type { UploadValidationResult } from './validators/upload-state';

export function validateUploadState(formData: Record<string, unknown>): UploadValidationResult {
  logger.warn(' validateUploadState is deprecated. Use validators from modular structure instead.');
  return _validateUploadState(formData);
}

export function extractPhotoURL(formData: Record<string, unknown>, contactType: string): string {
  logger.warn(' extractPhotoURL is deprecated. Use extractors from modular structure instead.');
  return _extractPhotoURL(formData, contactType);
}

export function extractLogoURL(formData: Record<string, unknown>, contactType: string): string {
  logger.warn(' extractLogoURL is deprecated. Use extractors from modular structure instead.');
  return _extractLogoURL(formData, contactType);
}

export function createEmailsArray(email: string): Array<{ email: string; type: string }> {
  logger.warn(' createEmailsArray is deprecated. Use extractors from modular structure instead.');
  return _createEmailsArray(email);
}

export function createPhonesArray(phone: string, phoneType: 'mobile' | 'work' = 'mobile'): Array<{ phone: string; type: string }> {
  logger.warn(' createPhonesArray is deprecated. Use extractors from modular structure instead.');
  return _createPhonesArray(phone, phoneType);
}

export function mapIndividualFormData(formData: Record<string, unknown>): Record<string, unknown> {
  logger.warn(' mapIndividualFormData is deprecated. Use mappers from modular structure instead.');
  return _mapIndividualFormData(formData);
}

export function mapCompanyFormData(formData: Record<string, unknown>): Record<string, unknown> {
  logger.warn(' mapCompanyFormData is deprecated. Use mappers from modular structure instead.');
  return _mapCompanyFormData(formData);
}

export function mapServiceFormData(formData: Record<string, unknown>): Record<string, unknown> {
  logger.warn(' mapServiceFormData is deprecated. Use mappers from modular structure instead.');
  return _mapServiceFormData(formData);
}

// ============================================================================
// LEGACY DEFAULT EXPORT για backward compatibility
// ============================================================================

export default {
  // Legacy export structure - importing from new modular system
  ...require('./modular'),

  // Legacy functions για backward compatibility
  isFirebaseStorageURL,
  requiresSpecialDeletion,
  cleanUndefinedValues,
  extractMultiplePhotoURLs,
  extractPhotoURL,
  extractLogoURL,
  validateUploadState,
  createEmailsArray,
  createPhonesArray,
  mapIndividualFormData,
  mapCompanyFormData,
  mapServiceFormData
};

// ============================================================================
// END OF LEGACY FILE
// ============================================================================
//
// This file now serves as a backward compatibility layer.
// All new code should import from the modular structure.
//
// 🎯 ENTERPRISE MIGRATION PATH:
// 1. Existing imports continue to work (100% backward compatible)
// 2. New code uses modular imports για better tree-shaking
// 3. Gradual migration as files are touched
// 4. Eventually this file can be removed when all imports are updated
//
// ============================================================================