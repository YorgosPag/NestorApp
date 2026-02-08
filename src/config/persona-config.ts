/**
 * ============================================================================
 * 🎭 PERSONA SECTIONS CONFIGURATION
 * ============================================================================
 *
 * Single Source of Truth για τα conditional fields ανά persona type.
 * Config-driven approach, ίδιο pattern με individual-config.ts.
 *
 * @see ADR-121 Contact Persona System
 * @see src/config/individual-config.ts (base pattern)
 */

import type { PersonaType } from '@/types/contacts/personas';
import type { IndividualSectionConfig, IndividualFieldConfig } from './individual-config';
import {
  PERSONA_FIELD_LABELS,
  PERSONA_SECTION_LABELS,
  PERSONA_TYPE_LABELS,
  PERSONA_TYPE_ICONS,
} from '@/constants/property-statuses-enterprise';
import { getIndividualSortedSections } from './individual-config';

// ============================================================================
// PERSONA SECTION CONFIG TYPE
// ============================================================================

/** Extended section config with persona metadata */
export interface PersonaSectionConfig extends IndividualSectionConfig {
  /** Which persona this section belongs to */
  personaType: PersonaType;
  /** Whether the section is collapsible (default: true) */
  collapsible?: boolean;
}

// ============================================================================
// PERSONA METADATA — Icons, Labels, Order
// ============================================================================

/** Metadata per persona type for UI rendering */
export interface PersonaMetadata {
  type: PersonaType;
  label: string;      // i18n key
  icon: string;       // Lucide icon name
  order: number;      // Display order in selector
}

/**
 * Persona metadata registry — used by PersonaSelector component
 */
export const PERSONA_METADATA: readonly PersonaMetadata[] = [
  { type: 'construction_worker', label: PERSONA_TYPE_LABELS.CONSTRUCTION_WORKER, icon: PERSONA_TYPE_ICONS.CONSTRUCTION_WORKER, order: 1 },
  { type: 'engineer',            label: PERSONA_TYPE_LABELS.ENGINEER,            icon: PERSONA_TYPE_ICONS.ENGINEER,            order: 2 },
  { type: 'accountant',          label: PERSONA_TYPE_LABELS.ACCOUNTANT,          icon: PERSONA_TYPE_ICONS.ACCOUNTANT,          order: 3 },
  { type: 'lawyer',              label: PERSONA_TYPE_LABELS.LAWYER,              icon: PERSONA_TYPE_ICONS.LAWYER,              order: 4 },
  { type: 'property_owner',      label: PERSONA_TYPE_LABELS.PROPERTY_OWNER,      icon: PERSONA_TYPE_ICONS.PROPERTY_OWNER,      order: 5 },
  { type: 'client',              label: PERSONA_TYPE_LABELS.CLIENT,              icon: PERSONA_TYPE_ICONS.CLIENT,              order: 6 },
  { type: 'supplier',            label: PERSONA_TYPE_LABELS.SUPPLIER,            icon: PERSONA_TYPE_ICONS.SUPPLIER,            order: 7 },
  { type: 'notary',              label: PERSONA_TYPE_LABELS.NOTARY,              icon: PERSONA_TYPE_ICONS.NOTARY,              order: 8 },
  { type: 'real_estate_agent',   label: PERSONA_TYPE_LABELS.REAL_ESTATE_AGENT,   icon: PERSONA_TYPE_ICONS.REAL_ESTATE_AGENT,   order: 9 },
] as const;

// ============================================================================
// SELECT OPTIONS FOR PERSONA FIELDS
// ============================================================================

const ENGINEER_SPECIALTY_OPTIONS = [
  { value: 'civil',       label: 'persona.options.engineerSpecialty.civil' },
  { value: 'architect',   label: 'persona.options.engineerSpecialty.architect' },
  { value: 'mechanical',  label: 'persona.options.engineerSpecialty.mechanical' },
  { value: 'electrical',  label: 'persona.options.engineerSpecialty.electrical' },
  { value: 'surveyor',    label: 'persona.options.engineerSpecialty.surveyor' },
  { value: 'chemical',    label: 'persona.options.engineerSpecialty.chemical' },
  { value: 'mining',      label: 'persona.options.engineerSpecialty.mining' },
];

const ENGINEER_LICENSE_OPTIONS = [
  { value: 'A', label: 'persona.options.licenseClass.A' },
  { value: 'B', label: 'persona.options.licenseClass.B' },
  { value: 'C', label: 'persona.options.licenseClass.C' },
  { value: 'D', label: 'persona.options.licenseClass.D' },
];

const CLIENT_CATEGORY_OPTIONS = [
  { value: 'residential',    label: 'persona.options.clientCategory.residential' },
  { value: 'commercial',     label: 'persona.options.clientCategory.commercial' },
  { value: 'industrial',     label: 'persona.options.clientCategory.industrial' },
  { value: 'public_sector',  label: 'persona.options.clientCategory.publicSector' },
  { value: 'other',          label: 'persona.options.clientCategory.other' },
];

const PREFERRED_CONTACT_OPTIONS = [
  { value: 'phone',      label: 'persona.options.contactMethod.phone' },
  { value: 'email',      label: 'persona.options.contactMethod.email' },
  { value: 'in_person',  label: 'persona.options.contactMethod.inPerson' },
  { value: 'messaging',  label: 'persona.options.contactMethod.messaging' },
];

const SUPPLIER_CATEGORY_OPTIONS = [
  { value: 'materials',      label: 'persona.options.supplierCategory.materials' },
  { value: 'equipment',      label: 'persona.options.supplierCategory.equipment' },
  { value: 'subcontractor',  label: 'persona.options.supplierCategory.subcontractor' },
  { value: 'services',       label: 'persona.options.supplierCategory.services' },
  { value: 'other',          label: 'persona.options.supplierCategory.other' },
];

// ============================================================================
// PERSONA SECTIONS REGISTRY — Single Source of Truth
// ============================================================================

/**
 * Persona-specific sections with their fields.
 * Each persona type maps to 1+ sections that appear as conditional tabs.
 * Order starts at 100 to appear after standard sections (1-9).
 */
export const PERSONA_SECTIONS: Record<PersonaType, PersonaSectionConfig[]> = {
  // ─────────────────────────────────────────────────────────────────────────
  // 🏗️ ΕΡΓΑΤΗΣ ΟΙΚΟΔΟΜΗΣ — ΕΦΚΑ/ΙΚΑ fields
  // ─────────────────────────────────────────────────────────────────────────
  construction_worker: [
    {
      id: 'persona_construction_worker',
      personaType: 'construction_worker',
      title: PERSONA_SECTION_LABELS.CONSTRUCTION_WORKER_TITLE,
      icon: PERSONA_TYPE_ICONS.CONSTRUCTION_WORKER,
      description: PERSONA_SECTION_LABELS.CONSTRUCTION_WORKER_DESCRIPTION,
      order: 100,
      collapsible: true,
      fields: [
        {
          id: 'ikaNumber',
          label: PERSONA_FIELD_LABELS.IKA_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.ikaNumber',
          helpText: 'persona.helpTexts.ikaNumber',
          icon: 'badge',
        },
        {
          id: 'insuranceClassId',
          label: PERSONA_FIELD_LABELS.INSURANCE_CLASS,
          type: 'number',
          placeholder: '1-28',
          helpText: 'persona.helpTexts.insuranceClass',
          icon: 'shield',
        },
        {
          id: 'triennia',
          label: PERSONA_FIELD_LABELS.TRIENNIA,
          type: 'number',
          placeholder: '0',
          helpText: 'persona.helpTexts.triennia',
          icon: 'calendar',
        },
        {
          id: 'dailyWage',
          label: PERSONA_FIELD_LABELS.DAILY_WAGE,
          type: 'number',
          placeholder: '0.00',
          helpText: 'persona.helpTexts.dailyWage',
          icon: 'euro',
        },
        {
          id: 'specialtyCode',
          label: PERSONA_FIELD_LABELS.SPECIALTY_CODE,
          type: 'input',
          placeholder: 'persona.placeholders.specialtyCode',
          helpText: 'persona.helpTexts.specialtyCode',
          icon: 'wrench',
        },
        {
          id: 'efkaRegistrationDate',
          label: PERSONA_FIELD_LABELS.EFKA_REGISTRATION_DATE,
          type: 'date',
          helpText: 'persona.helpTexts.efkaRegistrationDate',
          icon: 'calendar',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 📐 ΜΗΧΑΝΙΚΟΣ — ΤΕΕ registry
  // ─────────────────────────────────────────────────────────────────────────
  engineer: [
    {
      id: 'persona_engineer',
      personaType: 'engineer',
      title: PERSONA_SECTION_LABELS.ENGINEER_TITLE,
      icon: PERSONA_TYPE_ICONS.ENGINEER,
      description: PERSONA_SECTION_LABELS.ENGINEER_DESCRIPTION,
      order: 101,
      collapsible: true,
      fields: [
        {
          id: 'teeRegistryNumber',
          label: PERSONA_FIELD_LABELS.TEE_REGISTRY_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.teeRegistryNumber',
          helpText: 'persona.helpTexts.teeRegistryNumber',
          icon: 'hash',
        },
        {
          id: 'engineerSpecialty',
          label: PERSONA_FIELD_LABELS.ENGINEER_SPECIALTY,
          type: 'select',
          options: ENGINEER_SPECIALTY_OPTIONS,
          helpText: 'persona.helpTexts.engineerSpecialty',
          icon: 'ruler',
        },
        {
          id: 'licenseClass',
          label: PERSONA_FIELD_LABELS.LICENSE_CLASS,
          type: 'select',
          options: ENGINEER_LICENSE_OPTIONS,
          helpText: 'persona.helpTexts.licenseClass',
          icon: 'award',
        },
        {
          id: 'ptdeNumber',
          label: PERSONA_FIELD_LABELS.PTDE_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.ptdeNumber',
          helpText: 'persona.helpTexts.ptdeNumber',
          icon: 'file-text',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 📊 ΛΟΓΙΣΤΗΣ — ΟΕΕ
  // ─────────────────────────────────────────────────────────────────────────
  accountant: [
    {
      id: 'persona_accountant',
      personaType: 'accountant',
      title: PERSONA_SECTION_LABELS.ACCOUNTANT_TITLE,
      icon: PERSONA_TYPE_ICONS.ACCOUNTANT,
      description: PERSONA_SECTION_LABELS.ACCOUNTANT_DESCRIPTION,
      order: 102,
      collapsible: true,
      fields: [
        {
          id: 'oeeNumber',
          label: PERSONA_FIELD_LABELS.OEE_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.oeeNumber',
          helpText: 'persona.helpTexts.oeeNumber',
          icon: 'hash',
        },
        {
          id: 'accountingClass',
          label: PERSONA_FIELD_LABELS.ACCOUNTING_CLASS,
          type: 'input',
          placeholder: 'persona.placeholders.accountingClass',
          helpText: 'persona.helpTexts.accountingClass',
          icon: 'award',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // ⚖️ ΔΙΚΗΓΟΡΟΣ — Δικηγορικός Σύλλογος
  // ─────────────────────────────────────────────────────────────────────────
  lawyer: [
    {
      id: 'persona_lawyer',
      personaType: 'lawyer',
      title: PERSONA_SECTION_LABELS.LAWYER_TITLE,
      icon: PERSONA_TYPE_ICONS.LAWYER,
      description: PERSONA_SECTION_LABELS.LAWYER_DESCRIPTION,
      order: 103,
      collapsible: true,
      fields: [
        {
          id: 'barAssociationNumber',
          label: PERSONA_FIELD_LABELS.BAR_ASSOCIATION_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.barAssociationNumber',
          helpText: 'persona.helpTexts.barAssociationNumber',
          icon: 'hash',
        },
        {
          id: 'barAssociation',
          label: PERSONA_FIELD_LABELS.BAR_ASSOCIATION,
          type: 'input',
          placeholder: 'persona.placeholders.barAssociation',
          helpText: 'persona.helpTexts.barAssociation',
          icon: 'landmark',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 🏠 ΙΔΙΟΚΤΗΤΗΣ ΑΚΙΝΗΤΩΝ
  // ─────────────────────────────────────────────────────────────────────────
  property_owner: [
    {
      id: 'persona_property_owner',
      personaType: 'property_owner',
      title: PERSONA_SECTION_LABELS.PROPERTY_OWNER_TITLE,
      icon: PERSONA_TYPE_ICONS.PROPERTY_OWNER,
      description: PERSONA_SECTION_LABELS.PROPERTY_OWNER_DESCRIPTION,
      order: 104,
      collapsible: true,
      fields: [
        {
          id: 'propertyCount',
          label: PERSONA_FIELD_LABELS.PROPERTY_COUNT,
          type: 'number',
          placeholder: '0',
          helpText: 'persona.helpTexts.propertyCount',
          icon: 'home',
        },
        {
          id: 'ownershipNotes',
          label: PERSONA_FIELD_LABELS.OWNERSHIP_NOTES,
          type: 'textarea',
          placeholder: 'persona.placeholders.ownershipNotes',
          helpText: 'persona.helpTexts.ownershipNotes',
          icon: 'file-text',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 👤 ΠΕΛΑΤΗΣ
  // ─────────────────────────────────────────────────────────────────────────
  client: [
    {
      id: 'persona_client',
      personaType: 'client',
      title: PERSONA_SECTION_LABELS.CLIENT_TITLE,
      icon: PERSONA_TYPE_ICONS.CLIENT,
      description: PERSONA_SECTION_LABELS.CLIENT_DESCRIPTION,
      order: 105,
      collapsible: true,
      fields: [
        {
          id: 'clientSince',
          label: PERSONA_FIELD_LABELS.CLIENT_SINCE,
          type: 'date',
          helpText: 'persona.helpTexts.clientSince',
          icon: 'calendar',
        },
        {
          id: 'clientCategory',
          label: PERSONA_FIELD_LABELS.CLIENT_CATEGORY,
          type: 'select',
          options: CLIENT_CATEGORY_OPTIONS,
          helpText: 'persona.helpTexts.clientCategory',
          icon: 'tag',
        },
        {
          id: 'preferredContactMethod',
          label: PERSONA_FIELD_LABELS.PREFERRED_CONTACT_METHOD,
          type: 'select',
          options: PREFERRED_CONTACT_OPTIONS,
          helpText: 'persona.helpTexts.preferredContactMethod',
          icon: 'phone',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 📦 ΠΡΟΜΗΘΕΥΤΗΣ
  // ─────────────────────────────────────────────────────────────────────────
  supplier: [
    {
      id: 'persona_supplier',
      personaType: 'supplier',
      title: PERSONA_SECTION_LABELS.SUPPLIER_TITLE,
      icon: PERSONA_TYPE_ICONS.SUPPLIER,
      description: PERSONA_SECTION_LABELS.SUPPLIER_DESCRIPTION,
      order: 106,
      collapsible: true,
      fields: [
        {
          id: 'supplierCategory',
          label: PERSONA_FIELD_LABELS.SUPPLIER_CATEGORY,
          type: 'select',
          options: SUPPLIER_CATEGORY_OPTIONS,
          helpText: 'persona.helpTexts.supplierCategory',
          icon: 'tag',
        },
        {
          id: 'paymentTermsDays',
          label: PERSONA_FIELD_LABELS.PAYMENT_TERMS_DAYS,
          type: 'number',
          placeholder: '30',
          helpText: 'persona.helpTexts.paymentTermsDays',
          icon: 'clock',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 📜 ΣΥΜΒΟΛΑΙΟΓΡΑΦΟΣ
  // ─────────────────────────────────────────────────────────────────────────
  notary: [
    {
      id: 'persona_notary',
      personaType: 'notary',
      title: PERSONA_SECTION_LABELS.NOTARY_TITLE,
      icon: PERSONA_TYPE_ICONS.NOTARY,
      description: PERSONA_SECTION_LABELS.NOTARY_DESCRIPTION,
      order: 107,
      collapsible: true,
      fields: [
        {
          id: 'notaryRegistryNumber',
          label: PERSONA_FIELD_LABELS.NOTARY_REGISTRY_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.notaryRegistryNumber',
          helpText: 'persona.helpTexts.notaryRegistryNumber',
          icon: 'hash',
        },
        {
          id: 'notaryDistrict',
          label: PERSONA_FIELD_LABELS.NOTARY_DISTRICT,
          type: 'input',
          placeholder: 'persona.placeholders.notaryDistrict',
          helpText: 'persona.helpTexts.notaryDistrict',
          icon: 'map-pin',
        },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 🏪 ΜΕΣΙΤΗΣ ΑΚΙΝΗΤΩΝ
  // ─────────────────────────────────────────────────────────────────────────
  real_estate_agent: [
    {
      id: 'persona_real_estate_agent',
      personaType: 'real_estate_agent',
      title: PERSONA_SECTION_LABELS.REAL_ESTATE_AGENT_TITLE,
      icon: PERSONA_TYPE_ICONS.REAL_ESTATE_AGENT,
      description: PERSONA_SECTION_LABELS.REAL_ESTATE_AGENT_DESCRIPTION,
      order: 108,
      collapsible: true,
      fields: [
        {
          id: 'licenseNumber',
          label: PERSONA_FIELD_LABELS.RE_LICENSE_NUMBER,
          type: 'input',
          placeholder: 'persona.placeholders.reLicenseNumber',
          helpText: 'persona.helpTexts.reLicenseNumber',
          icon: 'hash',
        },
        {
          id: 'agency',
          label: PERSONA_FIELD_LABELS.RE_AGENCY,
          type: 'input',
          placeholder: 'persona.placeholders.reAgency',
          helpText: 'persona.helpTexts.reAgency',
          icon: 'building',
        },
      ],
    },
  ],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all sections for active personas.
 */
export function getPersonaSections(
  activePersonas: PersonaType[]
): PersonaSectionConfig[] {
  return activePersonas
    .flatMap(personaType => PERSONA_SECTIONS[personaType] ?? [])
    .sort((a, b) => a.order - b.order);
}

/**
 * Merge standard individual sections with active persona sections.
 * Standard sections come first (order 1-9), persona sections after (order 100+).
 */
export function getMergedIndividualSections(
  activePersonas: PersonaType[]
): IndividualSectionConfig[] {
  const standardSections = getIndividualSortedSections();
  const personaSections = getPersonaSections(activePersonas);
  return [...standardSections, ...personaSections].sort((a, b) => a.order - b.order);
}

/**
 * Get persona metadata by type.
 */
export function getPersonaMetadata(
  personaType: PersonaType
): PersonaMetadata | undefined {
  return PERSONA_METADATA.find(m => m.type === personaType);
}

/**
 * Get all field configs for a specific persona type.
 */
export function getPersonaFields(
  personaType: PersonaType
): IndividualFieldConfig[] {
  const sections = PERSONA_SECTIONS[personaType] ?? [];
  return sections.flatMap(section => section.fields);
}

/**
 * Check if a section is a persona section.
 */
export function isPersonaSection(
  section: IndividualSectionConfig
): section is PersonaSectionConfig {
  return 'personaType' in section;
}
