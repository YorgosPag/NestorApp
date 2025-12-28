/**
 * COMPANY GEMI FIELD UTILITIES
 *
 * Enterprise utility functions για field management
 * ENTERPRISE: Type-safe field operations με centralized data
 *
 * @version 1.0.0 - ENTERPRISE UTILITIES
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { FieldConfig, SectionConfig } from '../core/field-types';
import { COMPANY_GEMI_SECTIONS } from '../core/section-registry';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Αποκτά όλα τα πεδία από όλες τις ενότητες
 * ENTERPRISE: Centralized field aggregation
 */
export function getAllCompanyFields(): FieldConfig[] {
  return COMPANY_GEMI_SECTIONS.flatMap(section => section.fields);
}

/**
 * Αποκτά μια συγκεκριμένη ενότητα πεδίων
 * ENTERPRISE: Type-safe section lookup
 */
export function getCompanySection(sectionId: string): SectionConfig | undefined {
  return COMPANY_GEMI_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Αποκτά ένα συγκεκριμένο πεδίο από όλες τις ενότητες
 * ENTERPRISE: Cross-section field lookup
 */
export function getCompanyField(fieldId: string): FieldConfig | undefined {
  return getAllCompanyFields().find(field => field.id === fieldId);
}

/**
 * Δημιουργεί mapping από field ID σε FieldConfig για γρήγορη αναζήτηση
 * ENTERPRISE: Performance optimization για field access
 */
export function createFieldsMap(): Map<string, FieldConfig> {
  const map = new Map<string, FieldConfig>();
  getAllCompanyFields().forEach(field => {
    map.set(field.id, field);
  });
  return map;
}

/**
 * Ελέγχει αν ένα πεδίο είναι required
 * ENTERPRISE: Validation helper function
 */
export function isFieldRequired(fieldId: string): boolean {
  const field = getCompanyField(fieldId);
  return field?.required ?? false;
}

/**
 * Αποκτά τις ενότητες ταξινομημένες κατά σειρά priority
 * ENTERPRISE: Sorted sections για UI rendering
 */
export function getSortedSections(): SectionConfig[] {
  return [...COMPANY_GEMI_SECTIONS].sort((a, b) => a.order - b.order);
}

/**
 * Αποκτά fields από συγκεκριμένη ενότητα
 * ENTERPRISE: Section-specific field access
 */
export function getFieldsBySection(sectionId: string): FieldConfig[] {
  const section = getCompanySection(sectionId);
  return section?.fields ?? [];
}

/**
 * Αποκτά required fields από όλες τις ενότητες
 * ENTERPRISE: Validation helper για required fields
 */
export function getRequiredFields(): FieldConfig[] {
  return getAllCompanyFields().filter(field => field.required);
}

/**
 * Αποκτά sections που περιέχουν required fields
 * ENTERPRISE: Critical sections identification
 */
export function getSectionsWithRequiredFields(): SectionConfig[] {
  return COMPANY_GEMI_SECTIONS.filter(section =>
    section.fields.some(field => field.required)
  );
}