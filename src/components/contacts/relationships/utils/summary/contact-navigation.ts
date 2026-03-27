// ============================================================================
// CONTACT NAVIGATION UTILITY - ENTERPRISE MODULE
// ============================================================================
//
// 🔗 Navigation logic για contact relationships
// Handles filtering and routing to contacts page
//
// ============================================================================

import type { ContactRelationship } from '@/types/contacts/relationships';
import { ENTITY_ROUTES } from '@/lib/routes';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { createModuleLogger } from '@/lib/telemetry';
import i18next from 'i18next';
const logger = createModuleLogger('contact-navigation');

// 🌐 i18n helper — resolves translated stat titles to canonical keys
const t = (key: string) => i18next.t(key, { ns: 'contacts' });

// ============================================================================
// TYPES
// ============================================================================

export interface ContactNamesMap {
  [contactId: string]: string;
}

export type NavigationFilters = Record<string, string>;

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
  logger.info('DASHBOARD CLICK: Relationship filtering for card:', { data: cardTitle });

  const relatedContactNames = getContactNamesForFilter(
    cardTitle,
    relationships,
    contactNames,
    contactId
  );

  if (relatedContactNames.length > 0) {
    // Use the first contact name for filtering
    const searchTerm = relatedContactNames[0];
    router.push(ENTITY_ROUTES.contacts.withFilter(searchTerm));
    logger.info('NAVIGATION: Navigated to contacts with filter:', { searchTerm, relatedCount: relatedContactNames.length });
  } else {
    // Fallback to type-based search
    const fallbackTerm = getFallbackSearchTerm(cardTitle);
    router.push(ENTITY_ROUTES.contacts.withFilter(fallbackTerm));
    logger.info('NAVIGATION: Fallback to generic filter:', { data: fallbackTerm });
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

  // 🌐 i18n: Compare against translated stat titles
  const employeesTitle = t('relationships.stats.employees');
  const shareholdersTitle = t('relationships.stats.shareholders');
  const consultantsTitle = t('relationships.stats.consultants');
  const managementTitle = t('relationships.stats.management');

  if (cardTitle === employeesTitle) {
    return relationships
      .filter(rel => rel.relationshipType === 'employee')
      .map(getContactName)
      .filter(Boolean);
  }

  if (cardTitle === shareholdersTitle) {
    return relationships
      .filter(rel => rel.relationshipType === 'shareholder')
      .map(getContactName)
      .filter(Boolean);
  }

  if (cardTitle === consultantsTitle) {
    return relationships
      .filter(rel => rel.relationshipType === 'consultant')
      .map(getContactName)
      .filter(Boolean);
  }

  if (cardTitle === managementTitle) {
    return getManagementContactNames(relationships, contactNames, contactId);
  }

  // For other cards, return all contact names
  return relationships
    .map(getContactName)
    .filter(Boolean);
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

  // 🌐 i18n: Position keywords resolved from locale
  const directorKeyword = t('navigation.positionKeywords.director');
  const generalDirectorKeyword = t('navigation.positionKeywords.generalDirector');
  const seniorExecutiveKeyword = t('navigation.positionKeywords.seniorExecutive');

  return relationships
    .filter(rel =>
      managementTypes.includes(rel.relationshipType) ||
      (rel.position && (
        rel.position.toLowerCase().includes(directorKeyword) ||
        rel.position.toLowerCase().includes('manager') ||
        rel.position.toLowerCase().includes('ceo') ||
        rel.position.toLowerCase().includes('cto') ||
        rel.position.toLowerCase().includes(generalDirectorKeyword) ||
        rel.position.toLowerCase().includes(seniorExecutiveKeyword)
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
  // 🌐 i18n: Map translated stat titles → translated fallback search terms
  const relationshipFilters: NavigationFilters = {
    [t('relationships.stats.totalRelationships')]: t('navigation.fallbackSearch.totalRelationships'),
    [t('relationships.stats.employees')]: t('navigation.fallbackSearch.employees'),
    [t('relationships.stats.shareholders')]: t('navigation.fallbackSearch.shareholders'),
    [t('relationships.stats.consultants')]: t('navigation.fallbackSearch.consultants'),
    [t('relationships.stats.management')]: t('navigation.fallbackSearch.management'),
    [t('relationships.stats.recent')]: t('navigation.fallbackSearch.recent'),
    [t('relationships.stats.key')]: t('navigation.fallbackSearch.key'),
    [t('relationships.stats.departments')]: t('navigation.fallbackSearch.departments'),
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

  logger.info('NAVIGATION: Navigating to contacts with filter:', { data: {
    targetContactId,
    contactName,
    relationshipType: relationship.relationshipType
  } });

  router.push(ENTITY_ROUTES.contacts.withFilter(contactName || targetContactId));
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  navigateToDashboardFilter,
  navigateToRelationshipContact,
  getContactNamesForFilter
};