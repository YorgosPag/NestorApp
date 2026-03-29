/**
 * @module config/report-builder/domain-defs-persona
 * @enterprise ADR-268 Phase 4b — B4-B8 Persona-Based Domains
 *
 * All persona domains query contacts collection with personaTypes array-contains.
 * Persona-specific fields use dot-path: persona.<type>.<field> (Q93 resolver).
 * Computed fields (orderCount, projectCount, etc.) deferred to Phase 5+ (Q90).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition, FieldDefinition } from './report-builder-types';

// ============================================================================
// Shared Contact Fields (reused across B4-B8)
// ============================================================================

const CONTACT_STATUSES = ['active', 'inactive', 'archived'] as const;

function sharedContactFields(): FieldDefinition[] {
  return [
    {
      key: 'firstName',
      labelKey: 'domains._persona.fields.firstName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'lastName',
      labelKey: 'domains._persona.fields.lastName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'vatNumber',
      labelKey: 'domains._persona.fields.vatNumber',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'emails.0.email',
      labelKey: 'domains._persona.fields.primaryEmail',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'phones.0.number',
      labelKey: 'domains._persona.fields.primaryPhone',
      type: 'text',
      filterable: false,
      sortable: false,
      defaultVisible: true,
    },
    {
      key: 'status',
      labelKey: 'domains._persona.fields.status',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: CONTACT_STATUSES,
      enumLabelPrefix: 'domains._persona.enums.status',
    },
  ];
}

// ============================================================================
// Enum Constants (SSoT — match persona type definitions)
// ============================================================================

const SUPPLIER_CATEGORIES = [
  'materials', 'equipment', 'subcontractor', 'services', 'other',
] as const;

const ENGINEER_SPECIALTIES = [
  'civil', 'architect', 'mechanical', 'electrical', 'surveyor', 'chemical', 'mining',
] as const;

const ENGINEER_LICENSE_CLASSES = ['A', 'B', 'C', 'D'] as const;

const LEGAL_PERSONA_TYPES = ['lawyer', 'notary'] as const;

// ============================================================================
// B4 — Suppliers (Προμηθευτές)
// ============================================================================

export const SUPPLIERS_DEFINITION: DomainDefinition = {
  id: 'suppliers',
  collection: COLLECTIONS.CONTACTS,
  group: 'specialists',
  labelKey: 'domains.suppliers.label',
  descriptionKey: 'domains.suppliers.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
    { fieldPath: 'personaTypes', opStr: 'array-contains', value: 'supplier' },
  ],
  fields: [
    ...sharedContactFields(),
    {
      key: 'persona.supplier.supplierCategory',
      labelKey: 'domains.suppliers.fields.supplierCategory',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: SUPPLIER_CATEGORIES,
      enumLabelPrefix: 'domains.suppliers.enums.supplierCategory',
    },
    {
      key: 'persona.supplier.paymentTermsDays',
      labelKey: 'domains.suppliers.fields.paymentTermsDays',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
    },
  ],
};

// ============================================================================
// B5 — Engineers (Μηχανικοί)
// ============================================================================

export const ENGINEERS_DEFINITION: DomainDefinition = {
  id: 'engineers',
  collection: COLLECTIONS.CONTACTS,
  group: 'specialists',
  labelKey: 'domains.engineers.label',
  descriptionKey: 'domains.engineers.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
    { fieldPath: 'personaTypes', opStr: 'array-contains', value: 'engineer' },
  ],
  fields: [
    ...sharedContactFields(),
    {
      key: 'persona.engineer.teeRegistryNumber',
      labelKey: 'domains.engineers.fields.teeRegistryNumber',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'persona.engineer.engineerSpecialty',
      labelKey: 'domains.engineers.fields.engineerSpecialty',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: ENGINEER_SPECIALTIES,
      enumLabelPrefix: 'domains.engineers.enums.engineerSpecialty',
    },
    {
      key: 'persona.engineer.licenseClass',
      labelKey: 'domains.engineers.fields.licenseClass',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: ENGINEER_LICENSE_CLASSES,
      enumLabelPrefix: 'domains.engineers.enums.licenseClass',
    },
    {
      key: 'persona.engineer.ptdeNumber',
      labelKey: 'domains.engineers.fields.ptdeNumber',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
  ],
};

// ============================================================================
// B6 — Workers (Εργάτες Οικοδομής)
// ============================================================================

export const WORKERS_DEFINITION: DomainDefinition = {
  id: 'workers',
  collection: COLLECTIONS.CONTACTS,
  group: 'specialists',
  labelKey: 'domains.workers.label',
  descriptionKey: 'domains.workers.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
    { fieldPath: 'personaTypes', opStr: 'array-contains', value: 'construction_worker' },
  ],
  fields: [
    ...sharedContactFields(),
    {
      key: 'persona.construction_worker.ikaNumber',
      labelKey: 'domains.workers.fields.ikaNumber',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'persona.construction_worker.insuranceClassId',
      labelKey: 'domains.workers.fields.insuranceClassId',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
    },
    {
      key: 'persona.construction_worker.triennia',
      labelKey: 'domains.workers.fields.triennia',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
    },
    {
      key: 'persona.construction_worker.dailyWage',
      labelKey: 'domains.workers.fields.dailyWage',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'currency',
    },
    {
      key: 'persona.construction_worker.specialtyCode',
      labelKey: 'domains.workers.fields.specialtyCode',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
  ],
};

// ============================================================================
// B7 — Legal (Νομικοί — Δικηγόροι & Συμβολαιογράφοι)
// ============================================================================

export const LEGAL_DEFINITION: DomainDefinition = {
  id: 'legal',
  collection: COLLECTIONS.CONTACTS,
  group: 'specialists',
  labelKey: 'domains.legal.label',
  descriptionKey: 'domains.legal.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
    { fieldPath: 'personaTypes', opStr: 'array-contains-any', value: ['lawyer', 'notary'] },
  ],
  fields: [
    ...sharedContactFields(),
    // Persona type filter (lawyer vs notary)
    {
      key: 'persona.lawyer.personaType',
      labelKey: 'domains.legal.fields.legalPersonaType',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: LEGAL_PERSONA_TYPES,
      enumLabelPrefix: 'domains.legal.enums.legalPersonaType',
    },
    // Lawyer fields
    {
      key: 'persona.lawyer.barAssociationNumber',
      labelKey: 'domains.legal.fields.barAssociationNumber',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'persona.lawyer.personaType', value: 'lawyer' },
    },
    {
      key: 'persona.lawyer.barAssociation',
      labelKey: 'domains.legal.fields.barAssociation',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'persona.lawyer.personaType', value: 'lawyer' },
    },
    // Notary fields
    {
      key: 'persona.notary.notaryRegistryNumber',
      labelKey: 'domains.legal.fields.notaryRegistryNumber',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'persona.lawyer.personaType', value: 'notary' },
    },
    {
      key: 'persona.notary.notaryDistrict',
      labelKey: 'domains.legal.fields.notaryDistrict',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      conditionalOn: { field: 'persona.lawyer.personaType', value: 'notary' },
    },
  ],
};

// ============================================================================
// B8 — Agents (Μεσίτες Ακινήτων)
// ============================================================================

export const AGENTS_DEFINITION: DomainDefinition = {
  id: 'agents',
  collection: COLLECTIONS.CONTACTS,
  group: 'specialists',
  labelKey: 'domains.agents.label',
  descriptionKey: 'domains.agents.description',
  entityLinkPath: '/contacts/{id}',
  defaultSortField: 'lastName',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'type', opStr: '==', value: 'individual' },
    { fieldPath: 'personaTypes', opStr: 'array-contains', value: 'real_estate_agent' },
  ],
  fields: [
    ...sharedContactFields(),
    {
      key: 'persona.real_estate_agent.licenseNumber',
      labelKey: 'domains.agents.fields.licenseNumber',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'persona.real_estate_agent.agency',
      labelKey: 'domains.agents.fields.agency',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
  ],
};
