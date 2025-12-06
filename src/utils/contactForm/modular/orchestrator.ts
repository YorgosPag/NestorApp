// ============================================================================
// FORM DATA MAPPING ORCHESTRATOR - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Main orchestration logic for form data mapping
// Coordinates between different mappers and handles the main mapping flow
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapIndividualFormData } from '../mappers/individual';
import { mapCompanyFormData } from '../mappers/company';
import { mapServiceFormData } from '../mappers/service';
import { cleanUndefinedValues } from '../utils/data-cleaning';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FormDataMappingResult {
  contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
  multiplePhotoURLs: string[];
  photoURL: string;
  logoURL: string;
  warnings: string[];
}

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Map ContactFormData to Contact object (main function)
 *
 * Enterprise-class mapping από form data στο Contact model.
 * Επιλέγει το σωστό mapper βάσει contact type.
 *
 * @param formData - Contact form data
 * @returns FormDataMappingResult with contact data and extracted URLs
 */
export function mapFormDataToContact(formData: ContactFormData): FormDataMappingResult {
  const warnings: string[] = [];
  let contactData: any;
  let photoURL = '';
  let logoURL = '';
  let multiplePhotoURLs: string[] = [];

  try {
    switch (formData.type) {
      case 'individual':
        contactData = mapIndividualFormData(formData);
        photoURL = contactData.photoURL;
        multiplePhotoURLs = contactData.multiplePhotoURLs;
        break;

      case 'company':
        contactData = mapCompanyFormData(formData);
        logoURL = contactData.logoURL;
        photoURL = contactData.photoURL; // 🔧 FIX: Προσθήκη φωτογραφίας εκπροσώπου για εταιρείες
        multiplePhotoURLs = contactData.multiplePhotoURLs; // 🔧 FIX: Προσθήκη multiple photos για εταιρείες
        break;

      case 'service':
        contactData = mapServiceFormData(formData);
        logoURL = contactData.logoURL;
        photoURL = contactData.photoURL;
        multiplePhotoURLs = contactData.multiplePhotoURLs; // 🔧 FIX: Προσθήκη multiple photos για υπηρεσίες
        break;

      default:
        throw new Error(`Unknown contact type: ${formData.type}`);
    }

    // Clean undefined values
    const cleanedData = cleanUndefinedValues(contactData);

    return {
      contactData: cleanedData,
      multiplePhotoURLs,
      photoURL,
      logoURL,
      warnings
    };

  } catch (error) {
    return {
      contactData: {} as any,
      multiplePhotoURLs: [],
      photoURL: '',
      logoURL: '',
      warnings: [`Mapping failed: ${error}`]
    };
  }
}