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
import type { AddressInfo, EmailInfo, PhoneInfo, WebsiteInfo } from '@/types/contacts';
import { extractPhotoURL, extractLogoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { buildEnterpriseContactArrays } from '../extractors/arrays';

/** Mapped service contact data (partial, without timestamps) */
interface MappedServiceContactData {
  type: 'service';
  serviceName: string;
  serviceType?: string;
  shortName?: string;
  category?: string;
  supervisionMinistry?: string;
  legalStatus?: string;
  establishmentLaw?: string;
  headTitle?: string;
  headName?: string;
  logoURL?: string;
  photoURL?: string;
  multiplePhotoURLs: string[];
  fax?: string;
  websites?: WebsiteInfo[];
  addresses?: AddressInfo[];
  /** Ένθετα πεδία — αυθεντική λίστα διευθύνσεων (ADR-332 D18). */
  customFields?: Record<string, unknown>;
  mainResponsibilities?: string;
  citizenServices?: string;
  onlineServices?: string;
  serviceHours?: string;
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
}

/**
 * Map Service Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Service contact data
 */
export function mapServiceFormData(formData: ContactFormData): MappedServiceContactData {
  const logoURL = extractLogoURL(formData, 'service');
  const photoURL = extractPhotoURL(formData, 'service representative');
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για services
  const { enterpriseData, emails, phones } = buildEnterpriseContactArrays(formData, 'work');

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
    fax: formData.fax,
    websites: enterpriseData.websites,
    addresses: enterpriseData.addresses,
    // ADR-332 D18: η αυθεντική λίστα διευθύνσεων (υποκαταστήματα/παραρτήματα)
    // ζει στα `customFields` — χωρίς αυτό αποθηκευόταν μόνο η κεντρική υπηρεσία.
    ...(enterpriseData.customFields ? { customFields: enterpriseData.customFields } : {}),

    // Υπηρεσίες Φορέα (Services Section)
    mainResponsibilities: formData.mainResponsibilities,
    citizenServices: formData.citizenServices,
    onlineServices: formData.onlineServices,
    serviceHours: formData.serviceHours,

    emails,
    phones,
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
  };
}
