/**
 * =============================================================================
 * MIGRATION PLANNER — Backfill `code` on buildings (ADR-233 §3.4)
 * =============================================================================
 *
 * Pure planning logic (types + helpers) για τον building code backfill.
 * Ξεχωριστό αρχείο από το `route.ts` για τήρηση Single Responsibility +
 * Google's 300-line limit για API routes.
 *
 * @module api/admin/backfill-building-code/backfill-planner
 * @see ADR-233 §3.4 — Entity Coding System (building code field)
 */

import {
  GREEK_UPPERCASE_LETTERS,
  buildBuildingCode,
  BUILDING_CODE_PREFIX,
} from '@/config/entity-code-config';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildingRow {
  id: string;
  projectId: string;
  name: string;
  existingCode: string | null;
  createdAtMs: number;
}

export interface ProjectBackfillResult {
  projectId: string;
  totalBuildings: number;
  alreadyHadCode: number;
  backfilled: number;
  assignments: Array<{ id: string; name: string; newCode: string }>;
}

export interface BackfillReport {
  dryRun: boolean;
  timestamp: string;
  durationMs: number;
  projectsScanned: number;
  totalBuildings: number;
  totalBackfilled: number;
  projects: ProjectBackfillResult[];
  errors: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extracts the Greek letter suffix from a legacy building name.
 * Returns the letter (Α..Ω) if the name matches "Κτήριο X" or "Κτίριο X",
 * otherwise null.
 */
export function extractGreekLetterFromName(name: string): string | null {
  const trimmed = name.trim();
  // Match "Κτήριο Α", "Κτίριο Α", "Κτήριο  Α" etc. (case-sensitive Greek)
  const match = trimmed.match(/^Κτ[ήί]ριο\s+([Α-Ω])\s*$/);
  if (!match) return null;
  return match[1];
}

/**
 * For a single project, computes the `code` to assign to each building
 * without a code, honoring any buildings whose legacy `name` already
 * matches "Κτήριο X".
 */
export function planProjectCodes(buildings: BuildingRow[]): ProjectBackfillResult {
  const result: ProjectBackfillResult = {
    projectId: buildings[0]?.projectId ?? '(none)',
    totalBuildings: buildings.length,
    alreadyHadCode: 0,
    backfilled: 0,
    assignments: [],
  };

  // Sort by createdAt ascending (oldest first)
  const sorted = [...buildings].sort((a, b) => a.createdAtMs - b.createdAtMs);

  // Reserve letters already taken by existing `code` OR by "Κτήριο X" names
  const takenLetters = new Set<string>();
  for (const b of sorted) {
    if (b.existingCode) {
      result.alreadyHadCode++;
      const match = b.existingCode.trim().match(/\s([Α-Ω])\s*$/);
      if (match) takenLetters.add(match[1]);
      continue;
    }
    // Also honor legacy "Κτήριο X" names as reserved slots
    const letter = extractGreekLetterFromName(b.name);
    if (letter) takenLetters.add(letter);
  }

  // First pass: buildings with legacy "Κτήριο X" names keep their letter
  // Second pass: remaining buildings fill gaps in Greek alphabet order
  let cursor = 0;
  for (const b of sorted) {
    if (b.existingCode) continue; // Skip — already has code

    const legacyLetter = extractGreekLetterFromName(b.name);
    if (legacyLetter) {
      const newCode = `${BUILDING_CODE_PREFIX} ${legacyLetter}`;
      result.assignments.push({ id: b.id, name: b.name, newCode });
      result.backfilled++;
      continue;
    }

    // Find next unused Greek letter
    while (
      cursor < GREEK_UPPERCASE_LETTERS.length &&
      takenLetters.has(GREEK_UPPERCASE_LETTERS[cursor])
    ) {
      cursor++;
    }

    let newCode: string;
    if (cursor < GREEK_UPPERCASE_LETTERS.length) {
      newCode = buildBuildingCode(cursor);
      takenLetters.add(GREEK_UPPERCASE_LETTERS[cursor]);
      cursor++;
    } else {
      // Beyond Ω — numeric fallback
      newCode = buildBuildingCode(GREEK_UPPERCASE_LETTERS.length + result.backfilled);
    }

    result.assignments.push({ id: b.id, name: b.name, newCode });
    result.backfilled++;
  }

  return result;
}
