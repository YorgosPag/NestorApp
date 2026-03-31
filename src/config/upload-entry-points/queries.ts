/**
 * =============================================================================
 * Upload Entry Points — Assembly + Query/Utility Functions
 * =============================================================================
 *
 * Assembles the master UPLOAD_ENTRY_POINTS from 4 entity entry files
 * and provides all query/filter/utility functions.
 *
 * @module config/upload-entry-points/queries
 * @enterprise ADR-031 + ADR-121 + ADR-191
 */

import type { EntityType } from '../domain-constants';
import type { PersonaType } from '@/types/contacts/personas';
import type { ContactType } from '@/types/contacts';
import type { EntityLevel, StudyGroup } from '../study-groups-config';
import { getStudyGroupMeta } from '../study-groups-config';
import type { UploadEntryPoint, UploadEntryPointsConfig, FloorInfo } from './types';

import { CONTACT_ENTRY_POINTS } from './entries-contact';
import { BUILDING_ENTRY_POINTS } from './entries-building';
import { FLOOR_ENTRY_POINTS } from './entries-floor';
import { PROPERTY_ENTRY_POINTS } from './entries-property';
import { PROJECT_ENTRY_POINTS } from './entries-project';
import { STUDY_ENTRIES } from './entries-studies';

// ============================================================================
// Study Entry Assembly (ADR-191 — shared visibility)
// ============================================================================

/**
 * Filter study entries by entity level.
 * Resolution order:
 *   1. Entry-level override: entry.visibleIn (if defined)
 *   2. Group-level default: StudyGroupMeta.entityLevels
 */
function getStudyEntriesForEntityLevel(level: EntityLevel): UploadEntryPoint[] {
  return STUDY_ENTRIES.filter((entry) => {
    // Entry-level override takes priority
    if (entry.visibleIn) return entry.visibleIn.includes(level);
    // Fall back to group-level entityLevels
    const meta = entry.group ? getStudyGroupMeta(entry.group) : undefined;
    return meta?.entityLevels.includes(level) ?? false;
  });
}

// ============================================================================
// Master Assembly
// ============================================================================

/**
 * Centralized Upload Entry Points.
 * Non-study entries come from domain files; study entries are merged dynamically.
 */
export const UPLOAD_ENTRY_POINTS: UploadEntryPointsConfig = {
  contact: CONTACT_ENTRY_POINTS,
  building: [...BUILDING_ENTRY_POINTS, ...getStudyEntriesForEntityLevel('building')],
  floor: FLOOR_ENTRY_POINTS,
  property: PROPERTY_ENTRY_POINTS,
  project: [...PROJECT_ENTRY_POINTS, ...getStudyEntriesForEntityLevel('project')],
};

// ============================================================================
// Query Utilities
// ============================================================================

/**
 * Get entry points for specific entity type.
 */
export function getEntryPointsForEntity(
  entityType: EntityType
): UploadEntryPoint[] {
  return UPLOAD_ENTRY_POINTS[entityType] || [];
}

/**
 * Find entry point by ID.
 */
export function findEntryPoint(
  entityType: EntityType,
  entryPointId: string
): UploadEntryPoint | undefined {
  const entryPoints = getEntryPointsForEntity(entityType);
  return entryPoints.find((ep) => ep.id === entryPointId);
}

/**
 * Get entry points sorted by order.
 */
export function getSortedEntryPoints(
  entityType: EntityType
): UploadEntryPoint[] {
  const entryPoints = getEntryPointsForEntity(entityType);
  return [...entryPoints].sort((a, b) => a.order - b.order);
}

// ============================================================================
// Contact-Specific Filtering (Persona-Aware)
// ============================================================================

/**
 * Get filtered contact entry points based on contact type and active personas.
 *
 * Filtering rules:
 * 1. No contactTypes → always visible (base entry for ALL)
 * 2. contactTypes match → check personas:
 *    a. No personas → always visible for that contact type (base entry)
 *    b. personas match at least one active persona → visible
 *    c. personas don't match → hidden
 * 3. contactTypes don't match → hidden
 *
 * Dedup by ID (e.g., power-of-attorney shared between lawyer + client).
 */
export function getFilteredContactEntryPoints(
  contactType: ContactType,
  activePersonas?: PersonaType[]
): UploadEntryPoint[] {
  const allEntryPoints = getSortedEntryPoints('contact');
  const seen = new Set<string>();

  return allEntryPoints.filter((ep) => {
    // Dedup by ID
    if (seen.has(ep.id)) return false;

    // Rule 1: No contactTypes restriction → visible to ALL
    if (!ep.contactTypes || ep.contactTypes.length === 0) {
      seen.add(ep.id);
      return true;
    }

    // Rule 3: contactTypes don't match → hidden
    if (!ep.contactTypes.includes(contactType)) {
      return false;
    }

    // Rule 2a: contactTypes match + no personas restriction → base entry for type
    if (!ep.personas || ep.personas.length === 0) {
      seen.add(ep.id);
      return true;
    }

    // Rule 2b/2c: Check if any active persona matches
    const personas = activePersonas ?? [];
    const hasMatchingPersona = ep.personas.some((p) => personas.includes(p));
    if (hasMatchingPersona) {
      seen.add(ep.id);
      return true;
    }

    return false;
  });
}

// ============================================================================
// ADR-191: Hierarchical Study Entry Point Utilities
// ============================================================================

/**
 * Expand perFloor template entry points into concrete entries per floor.
 * Each template is cloned N times with floor info embedded in ID and label.
 */
export function expandFloorEntryPoints(
  templates: UploadEntryPoint[],
  floors: FloorInfo[]
): UploadEntryPoint[] {
  const result: UploadEntryPoint[] = [];

  for (const ep of templates) {
    if (!ep.perFloor) {
      result.push(ep);
      continue;
    }

    // perFloor template → expand one entry per floor
    for (const floor of floors) {
      result.push({
        ...ep,
        id: `${ep.id}__floor_${floor.id}`,
        perFloor: false, // expanded → no longer a template
        label: {
          el: `${ep.label.el} — ${floor.name}`,
          en: `${ep.label.en} — ${floor.name}`,
        },
        description: ep.description
          ? {
              el: `${ep.description.el} (${floor.name})`,
              en: `${ep.description.en} (${floor.name})`,
            }
          : undefined,
        order: ep.order + floor.number,
      });
    }
  }

  return result;
}

/**
 * Get entry points for a specific study group, with floor expansion.
 * Returns only entries matching the given group.
 */
export function getGroupedEntryPoints(
  entityType: EntityType,
  group: StudyGroup,
  floors?: FloorInfo[]
): UploadEntryPoint[] {
  const all = getSortedEntryPoints(entityType);
  const groupEntries = all.filter((ep) => ep.group === group);

  if (floors && floors.length > 0) {
    return expandFloorEntryPoints(groupEntries, floors);
  }

  // No floors provided: return templates as-is (UI will show warning)
  return groupEntries;
}

/**
 * Get available study groups for an entity type.
 * Returns only groups that have at least one entry point defined.
 */
export function getAvailableGroups(entityType: EntityType): StudyGroup[] {
  const all = getEntryPointsForEntity(entityType);
  const groups = new Set<StudyGroup>();

  for (const ep of all) {
    if (ep.group) {
      groups.add(ep.group);
    }
  }

  return Array.from(groups);
}

/**
 * Get entry points without a study group (legacy / general documents).
 * These are shown in the "Γενικά Έγγραφα" section.
 */
export function getUngroupedEntryPoints(entityType: EntityType): UploadEntryPoint[] {
  return getSortedEntryPoints(entityType).filter((ep) => !ep.group);
}

/**
 * Check if an entry type has any perFloor template entries.
 */
export function hasPerFloorEntries(entityType: EntityType): boolean {
  return getEntryPointsForEntity(entityType).some((ep) => ep.perFloor);
}
