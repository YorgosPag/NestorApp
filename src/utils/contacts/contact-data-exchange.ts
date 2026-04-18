// ============================================================================
// CONTACT DATA EXCHANGE - Export & Import using centralized DataExchange services
// ============================================================================
//
// SSoT: Uses DataExportService & DataImportService (src/services/data-exchange/)
// Provides contact-specific column definitions and data mapping
//
// ============================================================================

import DataExportService from '@/services/data-exchange/DataExportService';
import type { ExportColumn, ExportRecord, ExportFormat } from '@/services/data-exchange/DataExportService';
import type { ImportColumn, ImportResult } from '@/services/data-exchange/DataImportService';
import DataImportService from '@/services/data-exchange/DataImportService';
import type { Contact, ContactType } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('contact-data-exchange');

// ============================================================================
// EXPORT COLUMN DEFINITIONS
// ============================================================================

/** Columns for contact export — covers all 3 contact types in a flat structure */
const CONTACT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'type', label: 'Type', type: 'string' },
  { key: 'displayName', label: 'Display Name', type: 'string' },
  { key: 'firstName', label: 'First Name', type: 'string' },
  { key: 'lastName', label: 'Last Name', type: 'string' },
  { key: 'companyName', label: 'Company Name', type: 'string' },
  { key: 'serviceName', label: 'Service Name', type: 'string' },
  { key: 'vatNumber', label: 'VAT Number', type: 'string' },
  { key: 'profession', label: 'Profession', type: 'string' },
  { key: 'primaryEmail', label: 'Primary Email', type: 'string' },
  { key: 'primaryPhone', label: 'Primary Phone', type: 'string' },
  { key: 'street', label: 'Street', type: 'string' },
  { key: 'city', label: 'City', type: 'string' },
  { key: 'postalCode', label: 'Postal Code', type: 'string' },
  { key: 'region', label: 'Region', type: 'string' },
  { key: 'municipality', label: 'Municipality', type: 'string' },
  { key: 'status', label: 'Status', type: 'string' },
  { key: 'tags', label: 'Tags', type: 'string' },
  { key: 'notes', label: 'Notes', type: 'string' },
];

// ============================================================================
// CONTACT → EXPORT RECORD MAPPER
// ============================================================================

/** Flatten a Contact into a flat ExportRecord for CSV/JSON export */
function contactToExportRecord(contact: Contact): ExportRecord {
  const primaryEmail = contact.emails?.find(e => e.isPrimary)?.email
    || contact.emails?.[0]?.email || '';
  const primaryPhone = contact.phones?.find(p => p.isPrimary)?.number
    || contact.phones?.[0]?.number || '';
  const primaryAddress = contact.addresses?.[0];

  return {
    type: contact.type,
    displayName: getContactDisplayName(contact),
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    companyName: contact.companyName || '',
    serviceName: contact.serviceName || '',
    vatNumber: ('vatNumber' in contact ? (contact.vatNumber as string) : '') || '',
    profession: ('profession' in contact ? (contact.profession as string) : '') || '',
    primaryEmail,
    primaryPhone,
    street: primaryAddress?.street || '',
    city: primaryAddress?.city || '',
    postalCode: primaryAddress?.postalCode || '',
    region: primaryAddress?.region || '',
    municipality: primaryAddress?.municipality || '',
    status: contact.status || 'active',
    tags: (contact.tags || []).join(', '),
    notes: contact.notes || '',
  };
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

/**
 * Export contacts using centralized DataExportService (SSoT)
 *
 * @param contacts - Array of contacts to export
 * @param format - Export format (csv | json)
 * @param filenamePrefix - Optional prefix for the filename
 */
export async function exportContacts(
  contacts: Contact[],
  format: ExportFormat = 'csv',
  filenamePrefix = 'contacts'
): Promise<void> {
  if (contacts.length === 0) {
    logger.warn('No contacts to export');
    return;
  }

  const exportService = DataExportService.getInstance();
  const data = contacts.map(contactToExportRecord);
  const timestamp = nowISO().slice(0, 10);
  const filename = `${filenamePrefix}_${timestamp}.${exportService.getFileExtension(format)}`;

  logger.info('Exporting contacts', { count: contacts.length, format, filename });

  const blob = await exportService.exportData({
    format,
    filename,
    columns: CONTACT_EXPORT_COLUMNS,
    data,
    metadata: {
      title: 'Contacts Export',
      description: `Exported ${contacts.length} contacts`,
      company: 'Nestor Construct',
    },
  });

  exportService.downloadBlob(blob, filename);
  logger.info('Export completed', { filename });
}

// ============================================================================
// IMPORT COLUMN DEFINITIONS
// ============================================================================

/** Column mapping for contact CSV/JSON import */
const CONTACT_IMPORT_COLUMNS: ImportColumn[] = [
  { sourceKey: 'Type', targetKey: 'type', label: 'Type', type: 'string', required: true,
    validator: (v) => {
      const valid: ContactType[] = ['individual', 'company', 'service'];
      return valid.includes(v as ContactType) ? null : 'Must be individual, company, or service';
    }
  },
  { sourceKey: 'Display Name', targetKey: 'displayName', label: 'Display Name', type: 'string' },
  { sourceKey: 'First Name', targetKey: 'firstName', label: 'First Name', type: 'string' },
  { sourceKey: 'Last Name', targetKey: 'lastName', label: 'Last Name', type: 'string' },
  { sourceKey: 'Company Name', targetKey: 'companyName', label: 'Company Name', type: 'string' },
  { sourceKey: 'Service Name', targetKey: 'serviceName', label: 'Service Name', type: 'string' },
  { sourceKey: 'VAT Number', targetKey: 'vatNumber', label: 'VAT Number', type: 'string' },
  { sourceKey: 'Profession', targetKey: 'profession', label: 'Profession', type: 'string' },
  { sourceKey: 'Primary Email', targetKey: 'primaryEmail', label: 'Primary Email', type: 'email' },
  { sourceKey: 'Primary Phone', targetKey: 'primaryPhone', label: 'Primary Phone', type: 'string' },
  { sourceKey: 'Street', targetKey: 'street', label: 'Street', type: 'string' },
  { sourceKey: 'City', targetKey: 'city', label: 'City', type: 'string' },
  { sourceKey: 'Postal Code', targetKey: 'postalCode', label: 'Postal Code', type: 'string' },
  { sourceKey: 'Region', targetKey: 'region', label: 'Region', type: 'string' },
  { sourceKey: 'Municipality', targetKey: 'municipality', label: 'Municipality', type: 'string' },
  { sourceKey: 'Status', targetKey: 'status', label: 'Status', type: 'string' },
  { sourceKey: 'Tags', targetKey: 'tags', label: 'Tags', type: 'string' },
  { sourceKey: 'Notes', targetKey: 'notes', label: 'Notes', type: 'string' },
];

// ============================================================================
// IMPORT FUNCTION
// ============================================================================

/** Raw record from CSV/JSON import before transformation to Contact */
export interface ContactImportRecord {
  type: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  serviceName?: string;
  vatNumber?: string;
  profession?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  region?: string;
  municipality?: string;
  status?: string;
  tags?: string;
  notes?: string;
}

/**
 * Parse an import file using centralized DataImportService (SSoT)
 *
 * Returns the parsed records — the caller decides how to save them to Firestore.
 *
 * @param file - CSV or JSON file selected by user
 * @returns ImportResult with parsed contact records
 */
export async function parseContactImportFile(
  file: File
): Promise<ImportResult<ContactImportRecord>> {
  const importService = DataImportService.getInstance();
  const format = file.name.endsWith('.json') ? 'json' as const : 'csv' as const;

  logger.info('Parsing import file', { name: file.name, format, size: file.size });

  const result = await importService.importData(file, {
    format,
    columns: CONTACT_IMPORT_COLUMNS,
    skipFirstRow: true,
    delimiter: ',',
    validateBeforeImport: true,
    errorHandling: 'collect',
    duplicateHandling: 'create',
  });

  logger.info('Import parse completed', {
    total: result.totalRecords,
    valid: result.validRecords,
    invalid: result.invalidRecords,
    errors: result.errors.length,
  });

  return result as unknown as ImportResult<ContactImportRecord>;
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export { CONTACT_EXPORT_COLUMNS, CONTACT_IMPORT_COLUMNS };
