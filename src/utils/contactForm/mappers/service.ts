// ============================================================================
// SERVICE CONTACT MAPPER - ENTERPRISE MODULE
// ============================================================================
//
// 🏛️ Service contact form data mapping utilities
// Transforms service contact form data to Contact model structure
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import { extractPhotoURL, extractLogoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { createEmailsArray, createPhonesArray } from '../extractors/arrays';

/**
 * Map Service Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Service contact data
 */
export function mapServiceFormData(formData: ContactFormData): any {
  const logoURL = extractLogoURL(formData, 'service');
  const photoURL = extractPhotoURL(formData, 'service representative');
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για services

  // 🔧 FIX: Support both serviceName (old) and name (service-config) fields
  const serviceName = formData.serviceName || formData.name || '';

  return {
    type: 'service',
    serviceName,
    serviceType: formData.serviceType,
    // Βασικά Στοιχεία Δημόσιας Υπηρεσίας (Service Config)
    shortName: formData.shortName,
    category: formData.category,
    supervisionMinistry: formData.supervisionMinistry,
    // Διοικητικά Στοιχεία (Service Config)
    legalStatus: formData.legalStatus,
    establishmentLaw: formData.establishmentLaw,
    headTitle: formData.headTitle,
    headName: formData.headName,
    logoURL, // 🏛️ Enterprise service logo URL
    photoURL, // 🏛️ Enterprise service representative photo URL
    multiplePhotoURLs, // 📸 Multiple photos array για service photos

    // Επικοινωνία Υπηρεσίας (Contact Section)
    address: formData.address,
    postalCode: formData.postalCode,
    city: formData.city,
    fax: formData.fax,
    website: formData.website,

    // Υπηρεσίες Φορέα (Services Section)
    mainResponsibilities: formData.mainResponsibilities,
    citizenServices: formData.citizenServices,
    onlineServices: formData.onlineServices,
    serviceHours: formData.serviceHours,

    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'work'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
  };
}