/**
 * @module config/report-builder/domain-defs-contacts
 * @enterprise ADR-268 Phase 4a — B1 Individuals + B2 Companies & Services
 *
 * Field schemas for contact-based domains.
 * Enums match actual Firestore data (SSoT = code).
 * Nested array fields (emails.0.email) use dot-path with numeric index.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data)
// ============================================================================

const CONTACT_STATUSES = ['active', 'inactive', 'archived'] as const;

const CONTACT_TYPES = ['individual', 'company', 'service'] as const;

const GENDER_VALUES = ['male', 'female', 'other'] as const;

/* eslint-disable custom/no-hardcoded-strings -- Firestore enum values (SSoT), not UI labels */
const LEGAL_FORMS = [
  'ΑΕ', 'ΕΠΕ', 'ΟΕ', 'ΕΕ', 'ΙΚΕ', 'ΚΟΙΝΣΕΠ', 'OTHER',
] as const;
/* eslint-enable custom/no-hardcoded-strings */

const SERVICE_TYPES = [
  'ministry', 'tax_office', 'municipality', 'public_organization', 'other',
] as const;

// ============================================================================
// B1 — Individuals (Φυσικά Πρόσωπα)
// ============================================================================

export const INDIVIDUALS_DEFINITION: DomainDefinition = {
  id: 'individuals',
  collection: COLLECTIONS.CONTACTS,
  group: 'people',
  labelKey: 'domains.individuals.label',
  descriptionKey: 'domains.individuals.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
  ],
  fields: [
    // --- Default Visible (~10) ---
    {
      key: 'firstName',
      labelKey: 'domains.individuals.fields.firstName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'lastName',
      labelKey: 'domains.individuals.fields.lastName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'vatNumber',
      labelKey: 'domains.individuals.fields.vatNumber',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'emails.0.email',
      labelKey: 'domains.individuals.fields.primaryEmail',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'phones.0.number',
      labelKey: 'domains.individuals.fields.primaryPhone',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'addresses.0.city',
      labelKey: 'domains.individuals.fields.city',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'status',
      labelKey: 'domains.individuals.fields.status',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: CONTACT_STATUSES,
      enumLabelPrefix: 'domains.individuals.enums.status',
    },
    {
      key: 'profession',
      labelKey: 'domains.individuals.fields.profession',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'employer',
      labelKey: 'domains.individuals.fields.employer',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'completenessRate',
      labelKey: 'domains.individuals.fields.completenessRate',
      type: 'percentage',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'percentage',
    },
    // --- Selectable (not default visible) ---
    {
      key: 'specialty',
      labelKey: 'domains.individuals.fields.specialty',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      key: 'birthDate',
      labelKey: 'domains.individuals.fields.birthDate',
      type: 'date',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'date',
    },
    {
      key: 'gender',
      labelKey: 'domains.individuals.fields.gender',
      type: 'enum',
      filterable: true,
      sortable: false,
      defaultVisible: false,
      enumValues: GENDER_VALUES,
      enumLabelPrefix: 'domains.individuals.enums.gender',
    },
    {
      key: 'taxOffice',
      labelKey: 'domains.individuals.fields.taxOffice',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      key: 'fatherName',
      labelKey: 'domains.individuals.fields.fatherName',
      type: 'text',
      filterable: false,
      sortable: true,
      defaultVisible: false,
    },
    {
      key: 'amka',
      labelKey: 'domains.individuals.fields.amka',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'createdAt',
      labelKey: 'domains.individuals.fields.createdAt',
      type: 'date',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'date',
    },
  ],
};

// ============================================================================
// B2 — Companies & Services (Εταιρείες & Υπηρεσίες)
// ============================================================================

export const COMPANIES_DEFINITION: DomainDefinition = {
  id: 'companies',
  collection: COLLECTIONS.CONTACTS,
  group: 'people',
  labelKey: 'domains.companies.label',
  descriptionKey: 'domains.companies.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'companyName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: 'in', value: ['company', 'service'] },
  ],
  fields: [
    {
      key: 'companyName',
      labelKey: 'domains.companies.fields.companyName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'type', value: 'company' },
    },
    {
      key: 'serviceName',
      labelKey: 'domains.companies.fields.serviceName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'type', value: 'service' },
    },
    {
      key: 'type',
      labelKey: 'domains.companies.fields.type',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: CONTACT_TYPES,
      enumLabelPrefix: 'domains.companies.enums.type',
    },
    {
      key: 'legalForm',
      labelKey: 'domains.companies.fields.legalForm',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: LEGAL_FORMS,
      enumLabelPrefix: 'domains.companies.enums.legalForm',
      conditionalOn: { field: 'type', value: 'company' },
    },
    {
      key: 'serviceType',
      labelKey: 'domains.companies.fields.serviceType',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: SERVICE_TYPES,
      enumLabelPrefix: 'domains.companies.enums.serviceType',
      conditionalOn: { field: 'type', value: 'service' },
    },
    {
      key: 'vatNumber',
      labelKey: 'domains.companies.fields.vatNumber',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'registrationNumber',
      labelKey: 'domains.companies.fields.registrationNumber',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'taxOffice',
      labelKey: 'domains.companies.fields.taxOffice',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      key: 'industry',
      labelKey: 'domains.companies.fields.industry',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'numberOfEmployees',
      labelKey: 'domains.companies.fields.numberOfEmployees',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
    },
    {
      key: 'annualRevenue',
      labelKey: 'domains.companies.fields.annualRevenue',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
    },
    {
      key: 'emails.0.email',
      labelKey: 'domains.companies.fields.primaryEmail',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'phones.0.number',
      labelKey: 'domains.companies.fields.primaryPhone',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'addresses.0.city',
      labelKey: 'domains.companies.fields.city',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'status',
      labelKey: 'domains.companies.fields.status',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: CONTACT_STATUSES,
      enumLabelPrefix: 'domains.companies.enums.status',
    },
    {
      key: 'createdAt',
      labelKey: 'domains.companies.fields.createdAt',
      type: 'date',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'date',
    },
  ],
};
