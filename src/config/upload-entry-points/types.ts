/**
 * =============================================================================
 * Upload Entry Points — Type Definitions
 * =============================================================================
 *
 * @module config/upload-entry-points/types
 * @enterprise ADR-031 - Canonical File Storage System
 */

import type { EntityType, FileDomain, FileCategory } from '../domain-constants';
import type { PersonaType } from '@/types/contacts/personas';
import type { ContactType } from '@/types/contacts';
import type { StudyGroup, EntityLevel } from '../study-groups-config';

// ============================================================================
// Floor Info (ADR-191)
// ============================================================================

export interface FloorInfo {
  id: string;
  number: number;
  name: string;
}

// ============================================================================
// Capture Source Types (ADR-031 Extension)
// ============================================================================

/**
 * Allowed capture sources for Add/Capture Menu.
 * Determines what capture options appear in the menu per category.
 */
export type CaptureSource = 'upload' | 'camera' | 'video' | 'microphone' | 'text';

/**
 * Capture mode for metadata tracking.
 */
export type CaptureMode = 'file' | 'photo' | 'video' | 'audio' | 'text';

/**
 * File capture metadata (typed, no any).
 * Attached to file records for system understanding.
 */
export interface CaptureMetadata {
  /** How the file was captured */
  source: CaptureSource;
  /** Specific capture mode */
  captureMode: CaptureMode;
  /** Duration in ms for audio/video */
  durationMs?: number;
  /** Original MIME type */
  mimeType?: string;
  /** Original filename before processing */
  originalFilename?: string;
  /** Capture timestamp */
  capturedAt: string;
}

// ============================================================================
// Upload Entry Point Interface
// ============================================================================

/**
 * Upload Entry Point Definition.
 * Defines what type of document the user wants to upload.
 */
export interface UploadEntryPoint {
  /** Unique identifier for this entry point */
  id: string;
  /** Purpose/descriptor for file naming (used in FileRecordService) */
  purpose: string;
  /** Target domain (admin, construction, sales, etc.) */
  domain: FileDomain;
  /** Target category (documents, photos, contracts, etc.) */
  category: FileCategory;
  /** i18n labels */
  label: {
    /** Greek label */
    el: string;
    /** English label */
    en: string;
  };
  /** Optional description */
  description?: {
    el: string;
    en: string;
  };
  /** Icon identifier (lucide-react icon name) */
  icon?: string;
  /** Display order (lower = first) */
  order: number;
  /** Requires mandatory custom title (e.g., for "Άλλο Έγγραφο") */
  requiresCustomTitle?: boolean;
  /** Override default category capture capabilities */
  allowedSources?: CaptureSource[];
  /**
   * Restrict entry point to specific contact types.
   * If omitted → visible to ALL contact types (base entry).
   */
  contactTypes?: ContactType[];
  /**
   * Restrict entry point to specific personas (individual only).
   * If omitted → base entry, always visible for the matching contactTypes.
   * Requires contactTypes to include 'individual'.
   */
  personas?: PersonaType[];
  /**
   * ADR-191: Study group category (administrative, fiscal, architectural, etc.)
   * If omitted → entry appears in "Γενικά Έγγραφα" section (backward compatible).
   */
  group?: StudyGroup;
  /**
   * ADR-191: Template entry that expands dynamically per floor.
   * expandFloorEntryPoints() clones this entry N times (one per floor).
   */
  perFloor?: boolean;
  /**
   * Override group-level visibility for this specific entry.
   * If omitted, inherits from the group's entityLevels.
   * Example: visibleIn: ['building'] → only shown at building level,
   * even if the group targets both building + project.
   */
  visibleIn?: EntityLevel[];
}

/**
 * Entry points grouped by entity type.
 */
export type UploadEntryPointsConfig = {
  [K in EntityType]?: UploadEntryPoint[];
};
