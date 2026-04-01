/**
 * ⚠️ DEPRECATED — Legacy re-export layer for backward compatibility.
 *
 * All new code should import directly from the modular structure:
 *   import { mapFormDataToContact } from '@/utils/contactForm/modular/orchestrator';
 *   import { validateUploadState } from '@/utils/contactForm/validators';
 *   import { cleanUndefinedValues } from '@/utils/contactForm/utils';
 */

export * from './modular';
export { mapFormDataToContact } from './modular/orchestrator';
export type { FormDataMappingResult } from './modular/orchestrator';
