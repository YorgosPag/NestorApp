/**
 * =============================================================================
 * CONTACT TAB FILTER — Server-Side Field Filtering by Tab
 * =============================================================================
 *
 * Google-level solution: Instead of asking the AI to filter fields (unreliable),
 * we filter Firestore results SERVER-SIDE before returning to the AI.
 * The AI cannot show fields it never receives.
 *
 * Reads dynamically from SSoT section configs (same source as ai-tab-mapping.ts).
 *
 * @module services/ai-pipeline/tools/contact-tab-filter
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { INDIVIDUAL_SECTIONS } from '@/config/individual-config';
import { COMPANY_GEMI_SECTIONS } from '@/config/company-gemi';
import { SERVICE_SECTIONS } from '@/config/service-config';
import {
  type SectionLike,
  extractRealFieldIds,
  ARRAY_FIELD_SECTIONS,
} from '@/config/section-field-utils';

// ============================================================================
// TYPES
// ============================================================================

type ContactType = 'individual' | 'company' | 'service';

// ============================================================================
// TAB → FIELDS MAP (built once, cached at module level)
// ============================================================================

/** Fields that are ALWAYS included regardless of tab filter (identity fields) */
const ALWAYS_INCLUDED_FIELDS = new Set([
  'id', 'type', 'contactType', 'status', 'displayName', 'companyId',
]);

/**
 * Build tab→fields lookup for a contact type.
 * Uses SSoT: section-field-utils for field extraction + array field sections.
 */
function buildTabMap(sections: ReadonlyArray<SectionLike>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const section of sections) {
    // Check if section has hardcoded array fields (e.g. communication → phones, emails...)
    const arrayFields = ARRAY_FIELD_SECTIONS[section.id];
    if (arrayFields) {
      map.set(section.id, new Set(arrayFields));
      continue;
    }

    const fieldIds = extractRealFieldIds(section);
    if (fieldIds.length > 0) {
      map.set(section.id, new Set(fieldIds));
    }
  }
  return map;
}

/** Module-level cache — configs are static at build time */
const TAB_MAPS: Record<ContactType, Map<string, Set<string>>> = {
  individual: buildTabMap(INDIVIDUAL_SECTIONS),
  company: buildTabMap(COMPANY_GEMI_SECTIONS),
  service: buildTabMap(SERVICE_SECTIONS),
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get valid tab IDs for a contact type (for AI prompt / validation).
 */
export function getValidTabIds(contactType: ContactType): string[] {
  return [...TAB_MAPS[contactType].keys()];
}

/**
 * Filter a contact document to only include fields from a specific tab.
 *
 * @param data - Raw contact document (after redaction/flatten)
 * @param contactType - 'individual' | 'company' | 'service'
 * @param tabId - Tab identifier (e.g. 'basicInfo', 'identity', 'communication')
 * @returns Filtered document with only tab fields + identity fields, or original if tab not found
 */
export function filterContactByTab(
  data: Record<string, unknown>,
  contactType: ContactType,
  tabId: string
): Record<string, unknown> {
  const tabMap = TAB_MAPS[contactType];
  if (!tabMap) return data; // Unknown contact type → no filtering

  const allowedFields = tabMap.get(tabId);
  if (!allowedFields) return data; // Unknown tab → no filtering (safe fallback)

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALWAYS_INCLUDED_FIELDS.has(key) || allowedFields.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Resolve contact type from document data.
 * Returns 'individual' as default if type/contactType is missing.
 */
export function resolveContactType(data: Record<string, unknown>): ContactType {
  const raw = (data.type ?? data.contactType ?? 'individual') as string;
  if (raw === 'company') return 'company';
  if (raw === 'service') return 'service';
  return 'individual';
}
