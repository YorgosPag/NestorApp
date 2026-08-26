/**
 * @fileoverview Types and constants for UC-011 Admin Project Status (ADR-145)
 */

import { projectStatusTexts } from '@/constants/project-status-text';
import type { ProjectStatus } from '@/constants/project-statuses';

// ============================================================================
// STATUS LABELS
// ============================================================================

/**
 * ADR-812 — ΠΑΡΑΓΟΜΕΝΟ ΑΠΟ ΤΟ ΛΕΞΙΛΟΓΙΟ, όχι χειρόγραφο.
 *
 * Εδώ ζούσε πίνακας με **σκληρά ελληνικά** και πέντε καταστάσεις. Ήταν
 * μονόγλωσσος: κάθε χρήστης έπαιρνε ελληνικά στο Telegram, ανεξάρτητα από τη
 * γλώσσα του. Και του έλειπε ο κάδος, οπότε διαγραμμένο έργο απαντούσε με ωμό
 * αναγνωριστικό (`deleted`) μέσα σε ελληνική πρόταση.
 *
 * ⚠️ ΤΟ `el` ΕΙΝΑΙ ΠΑΓΩΜΕΝΟ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΟΡΙΟ, ΟΧΙ ΛΥΣΗ: ο agent
 * του AI pipeline δεν κουβαλά ακόμη γλώσσα χρήστη στο context του. Η διαφορά
 * με πριν είναι ότι η αγγλική εκδοχή **υπάρχει και είναι μία κλήση μακριά**
 * (`projectStatusText(status, locale)`), αντί να χρειάζεται νέος πίνακας.
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = projectStatusTexts('el');

// ============================================================================
// TYPES
// ============================================================================

/** Lookup mode: single project vs multi-project search */
export type LookupMode = 'single' | 'list' | 'search';

export interface ProjectInfo {
  projectId: string;
  name: string;
  status: string | null;
  statusLabel: string | null;
  address: string | null;
  description: string | null;
  progress: number;
  updatedAt: string | null;
}

export interface PropertyStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

export interface GanttBuildingDetail {
  buildingName: string;
  phaseCount: number;
}

export interface ProjectWithDetails {
  project: ProjectInfo;
  propertyStats: PropertyStats;
  hasGantt: boolean;
  buildingCount: number;
  ganttDetails: GanttBuildingDetail[];
}

export interface ProjectLookupData {
  mode: LookupMode;
  searchTerm: string;
  searchCriteria: string | null;
  companyId: string;
  singleProject: ProjectWithDetails | null;
  projects: ProjectWithDetails[];
}

export const EMPTY_STATS: PropertyStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
