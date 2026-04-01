/**
 * @fileoverview Formatters and criteria matching for UC-011 (ADR-145)
 * @description Text formatting for Telegram/channel replies + search criteria matching.
 */

import type { LookupMode, ProjectWithDetails } from './project-status-types';

// ============================================================================
// CRITERIA MATCHING
// ============================================================================

/**
 * Check if a project matches the search criteria.
 * Supports: gantt, status keywords, feature keywords.
 */
export function matchesCriteria(project: ProjectWithDetails, criteria: string): boolean {
  // Gantt/timeline criteria
  if (
    criteria.includes('gantt') ||
    criteria.includes('χρονοδιάγραμμα') ||
    criteria.includes('timeline') ||
    criteria.includes('φάσεις') ||
    criteria.includes('κατασκευ')
  ) {
    return project.hasGantt;
  }

  // Status criteria
  const statusMap: Record<string, string[]> = {
    planning: ['σχεδιασμ', 'planning', 'σχέδιο'],
    in_progress: ['εξέλιξη', 'progress', 'ενεργ', 'τρέχ'],
    completed: ['ολοκληρ', 'completed', 'τελειωμ', 'finished'],
    on_hold: ['αναμονή', 'hold', 'παύση'],
    cancelled: ['ακυρ', 'cancelled'],
  };

  for (const [status, keywords] of Object.entries(statusMap)) {
    if (keywords.some((kw) => criteria.includes(kw))) {
      return project.project.status === status;
    }
  }

  // Building count criteria
  if (criteria.includes('κτήρι') || criteria.includes('κτίρι') || criteria.includes('building')) {
    return project.buildingCount > 0;
  }

  // Units criteria
  if (criteria.includes('unit') || criteria.includes('ακίνητ') || criteria.includes('μονάδ')) {
    return project.propertyStats.total > 0;
  }

  return true;
}

// ============================================================================
// REPLY FORMATTERS
// ============================================================================

export function formatSingleProjectReply(params: Record<string, unknown>): string {
  const details = params.singleProject as ProjectWithDetails | null;

  if (!details) {
    return `Δεν βρέθηκε έργο με όνομα "${(params.searchTerm as string) ?? ''}".`;
  }

  const { project, propertyStats, hasGantt, buildingCount, ganttDetails } = details;
  const lines: string[] = [`Έργο: ${project.name}`];

  if (project.statusLabel) lines.push(`Κατάσταση: ${project.statusLabel}`);
  if (project.address) lines.push(`Διεύθυνση: ${project.address}`);
  if (project.progress > 0) lines.push(`Πρόοδος: ${project.progress}%`);
  if (buildingCount > 0) lines.push(`Κτήρια: ${buildingCount}`);

  if (hasGantt && ganttDetails.length > 0) {
    const ganttLines = ganttDetails
      .map((g) => `  ${g.buildingName} (${g.phaseCount} φάσεις)`)
      .join('\n');
    lines.push(`Gantt: Ναι\n${ganttLines}`);
  } else {
    lines.push('Gantt: Όχι');
  }

  if (propertyStats.total > 0) {
    lines.push('');
    lines.push(`Units: ${propertyStats.total} σύνολο`);
    lines.push(`  Πωλημένα: ${propertyStats.sold}`);
    lines.push(`  Διαθέσιμα: ${propertyStats.available}`);
    if (propertyStats.reserved > 0) lines.push(`  Κρατημένα: ${propertyStats.reserved}`);
    if (propertyStats.other > 0) lines.push(`  Λοιπά: ${propertyStats.other}`);
  }

  if (project.updatedAt) lines.push(`\nΤελευταία ενημέρωση: ${project.updatedAt}`);
  return lines.join('\n');
}

export function formatMultiProjectReply(params: Record<string, unknown>): string {
  const projects = (params.projects as ProjectWithDetails[]) ?? [];
  const searchCriteria = (params.searchCriteria as string) ?? null;
  const mode = params.mode as LookupMode;

  if (projects.length === 0) {
    if (searchCriteria) {
      return `Δεν βρέθηκαν έργα με κριτήριο "${searchCriteria}".`;
    }
    return 'Δεν βρέθηκαν έργα.';
  }

  const lines: string[] = [];

  if (mode === 'search' && searchCriteria) {
    lines.push(`Έργα με κριτήριο "${searchCriteria}" (${projects.length}):`);
  } else {
    lines.push(`Όλα τα έργα (${projects.length}):`);
  }
  lines.push('');

  for (const { project, propertyStats, hasGantt, buildingCount, ganttDetails } of projects) {
    const statusPart = project.statusLabel ? ` [${project.statusLabel}]` : '';
    const progressPart = project.progress > 0 ? ` ${project.progress}%` : '';
    const propertiesPart = propertyStats.total > 0
      ? ` | ${propertyStats.total} units (${propertyStats.sold} πωλ./${propertyStats.available} διαθ.)`
      : '';
    const buildingsPart = buildingCount > 0 ? ` | ${buildingCount} κτήρια` : '';

    lines.push(`- ${project.name}${statusPart}${progressPart}${buildingsPart}${propertiesPart}`);

    if (hasGantt && ganttDetails.length > 0) {
      for (const g of ganttDetails) {
        lines.push(`    Gantt: ${g.buildingName} (${g.phaseCount} φάσεις)`);
      }
    }
  }

  return lines.join('\n');
}
