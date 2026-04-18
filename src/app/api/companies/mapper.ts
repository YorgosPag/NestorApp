/**
 * =============================================================================
 * 🏢 COMPANIES — Firestore Data Mapper (ADR-312 Phase 3.6)
 * =============================================================================
 *
 * Data Mapper pattern (SAP / Salesforce / Microsoft Dynamics convention):
 * separates the raw persistence model from the domain model, with type-safe
 * transformation and boundary validation.
 *
 * Extracted from `route.ts` to keep the route file under the 300-LOC budget
 * for API routes (CLAUDE.md N.7.1). The route file imports this module and
 * delegates all Firestore→CompanyContact shape work.
 *
 * @module app/api/companies/mapper
 */

import type { CompanyContact, ContactStatus } from '@/types/contacts';
import { normalizeToDate } from '@/lib/date-local';
import { resolveCompanyDisplayName } from '@/services/company/company-name-resolver';

/**
 * 🏢 Enterprise: Raw Firestore document data interface
 * Represents the actual data structure stored in Firestore
 */
export interface FirestoreCompanyData {
  companyName?: string;
  legalName?: string;
  tradeName?: string;
  vatNumber?: string;
  companyVatNumber?: string; // Legacy field
  status?: string;
  type?: string;
  industry?: string;
  sector?: string;
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
  logoURL?: string;
  emails?: unknown[];
  phones?: unknown[];
  addresses?: unknown[];
  websites?: unknown[];
  socialMedia?: unknown[];
  contactPersons?: unknown[];
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  lastModifiedBy?: string;
  [key: string]: unknown; // Allow additional fields
}

/**
 * 🏢 Enterprise Data Mapper: Firestore → CompanyContact
 *
 * Transforms raw Firestore data to type-safe CompanyContact.
 *
 * @param docId - Firestore document ID
 * @param data - Raw Firestore document data
 * @returns Type-safe CompanyContact object
 */
export function mapFirestoreToCompanyContact(
  docId: string,
  data: FirestoreCompanyData,
): CompanyContact {
  // Company name via SSoT resolver (ADR-312 Phase 3.6)
  const companyName = resolveCompanyDisplayName({
    id: docId,
    companyName: data.companyName,
    tradeName: data.tradeName,
    legalName: data.legalName,
  });

  // Extract VAT number (handle legacy field)
  const vatNumber = data.vatNumber || data.companyVatNumber || '';

  // Validate and cast status
  const rawStatus = data.status || 'active';
  const status: ContactStatus = isValidContactStatus(rawStatus) ? rawStatus : 'active';

  // Convert timestamp to Date if needed
  const now = new Date();
  const createdAt = normalizeToDate(data.createdAt) || now;
  const updatedAt = normalizeToDate(data.updatedAt) || now;

  return {
    // Required fields from BaseContact
    id: docId,
    type: 'company',
    status,
    isFavorite: data.isFavorite ?? false,
    createdAt,
    updatedAt,

    // Required field from CompanyContact
    companyName,
    vatNumber,

    // Optional fields
    legalName: data.legalName,
    tradeName: data.tradeName,
    industry: data.industry,
    sector: data.sector,
    notes: data.notes,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    logoURL: data.logoURL,
    createdBy: data.createdBy,
    lastModifiedBy: data.lastModifiedBy,

    // Arrays - only include if they are valid arrays
    emails: Array.isArray(data.emails) ? (data.emails as CompanyContact['emails']) : undefined,
    phones: Array.isArray(data.phones) ? (data.phones as CompanyContact['phones']) : undefined,
    addresses: Array.isArray(data.addresses) ? (data.addresses as CompanyContact['addresses']) : undefined,
    websites: Array.isArray(data.websites) ? (data.websites as CompanyContact['websites']) : undefined,
    socialMedia: Array.isArray(data.socialMedia) ? (data.socialMedia as CompanyContact['socialMedia']) : undefined,
    contactPersons: Array.isArray(data.contactPersons)
      ? (data.contactPersons as CompanyContact['contactPersons'])
      : undefined,
  };
}

/**
 * 🔧 Helper: Validate ContactStatus
 */
export function isValidContactStatus(status: string): status is ContactStatus {
  return ['active', 'inactive', 'archived'].includes(status);
}
