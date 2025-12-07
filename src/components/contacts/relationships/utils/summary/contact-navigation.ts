// ============================================================================
// CONTACT NAVIGATION UTILITY - ENTERPRISE MODULE
// ============================================================================
//
// 🔗 Navigation logic για contact relationships
// Handles filtering and routing to contacts page
//
// ============================================================================

import type { ContactRelationship } from '@/types/contacts/relationships';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// ============================================================================
// TYPES
// ============================================================================

export interface ContactNamesMap {
  [contactId: string]: string;
}

export interface NavigationFilters {
  'Σύνολο Σχέσεων': string;
  'Εργαζόμενοι': string;
  'Μέτοχοι/Εταίροι': string;
  'Συνεργάτες': string;
  'Διευθυντικά Στελέχη': string;
  'Πρόσφατες Σχέσεις': string;
  'Κύριες Σχέσεις': string;
  'Τμήματα': string;
  [key: string]: string;
}

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================

/**
 * 🎯 Handle dashboard card click navigation
 */
export function navigateToDashboardFilter(
  cardTitle: string,
  relationships: ContactRelationship[],
  contactNames: ContactNamesMap,
  contactId: string,
  router: AppRouterInstance
): void {
  console.log('🎯 DASHBOARD CLICK: Relationship filtering for card:', cardTitle);

  const relatedContactNames = getContactNamesForFilter(
    cardTitle,
    relationships,
    contactNames,
    contactId
  );

  if (relatedContactNames.length > 0) {
    // Use the first contact name for filtering
    const searchTerm = relatedContactNames[0];
    router.push(`/contacts?filter=${encodeURIComponent(searchTerm)}`);
    console.log('🔗 NAVIGATION: Navigated to contacts with filter:', searchTerm, 'Related contacts:', relatedContactNames.length);
  } else {
    // Fallback to type-based search
    const fallbackTerm = getFallbackSearchTerm(cardTitle);
    router.push(`/contacts?filter=${encodeURIComponent(fallbackTerm)}`);
    console.log('🔗 NAVIGATION: Fallback to generic filter:', fallbackTerm);
  }
}

/**
 * 🔍 Get contact names for specific filter types
 */
export function getContactNamesForFilter(
  cardTitle: string,
  relationships: ContactRelationship[],
  contactNames: ContactNamesMap,
  contactId: string
): string[] {
  const getTargetContactId = (rel: ContactRelationship) =>
    rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;

  const getContactName = (rel: ContactRelationship) =>
    contactNames[getTargetContactId(rel)];

  switch (cardTitle) {
    case 'Εργαζόμενοι':
      return relationships
        .filter(rel => rel.relationshipType === 'employee')
        .map(getContactName)
        .filter(Boolean);

    case 'Μέτοχοι/Εταίροι':
      return relationships
        .filter(rel => rel.relationshipType === 'shareholder')
        .map(getContactName)
        .filter(Boolean);

    case 'Σύμβουλοι':
      return relationships
        .filter(rel => rel.relationshipType === 'consultant')
        .map(getContactName)
        .filter(Boolean);

    case 'Διευθυντικά Στελέχη':
      return getManagementContactNames(relationships, contactNames, contactId);

    default:
      // For other cards, return all contact names
      return relationships
        .map(getContactName)
        .filter(Boolean);
  }
}

/**
 * 🏢 Get management-level contact names
 */
function getManagementContactNames(
  relationships: ContactRelationship[],
  contactNames: ContactNamesMap,
  contactId: string
): string[] {
  const managementTypes = ['director', 'manager', 'executive', 'ceo', 'chairman'];

  return relationships
    .filter(rel =>
      managementTypes.includes(rel.relationshipType) ||
      (rel.position && (
        rel.position.toLowerCase().includes('διευθυντής') ||
        rel.position.toLowerCase().includes('manager') ||
        rel.position.toLowerCase().includes('ceo') ||
        rel.position.toLowerCase().includes('cto') ||
        rel.position.toLowerCase().includes('γενικός διευθυντής') ||
        rel.position.toLowerCase().includes('ανώτερο στέλεχος')
      ))
    )
    .map(rel => {
      const targetContactId = rel.targetContactId === contactId ? rel.sourceContactId : rel.targetContactId;
      return contactNames[targetContactId];
    })
    .filter(Boolean);
}

/**
 * 🔄 Get fallback search term for navigation
 */
function getFallbackSearchTerm(cardTitle: string): string {
  const relationshipFilters: NavigationFilters = {
    'Σύνολο Σχέσεων': 'σχέση',
    'Εργαζόμενοι': 'εργαζόμενος',
    'Μέτοχοι/Εταίροι': 'μέτοχος',
    'Συνεργάτες': 'συνεργάτης',
    'Διευθυντικά Στελέχη': 'διευθυντής',
    'Πρόσφατες Σχέσεις': 'πρόσφατη σχέση',
    'Κύριες Σχέσεις': 'κύρια σχέση',
    'Τμήματα': 'τμήμα'
  };

  return relationshipFilters[cardTitle] || cardTitle;
}

/**
 * 🔗 Handle individual relationship click
 */
export function navigateToRelationshipContact(
  relationship: ContactRelationship,
  contactNames: ContactNamesMap,
  contactId: string,
  router: AppRouterInstance
): void {
  const targetContactId = relationship.targetContactId === contactId
    ? relationship.sourceContactId
    : relationship.targetContactId;

  const contactName = contactNames[targetContactId];

  console.log('🔗 NAVIGATION: Navigating to contacts with filter:', {
    targetContactId,
    contactName,
    relationshipType: relationship.relationshipType
  });

  router.push(`/contacts?filter=${encodeURIComponent(contactName || targetContactId)}`);
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  navigateToDashboardFilter,
  navigateToRelationshipContact,
  getContactNamesForFilter
};