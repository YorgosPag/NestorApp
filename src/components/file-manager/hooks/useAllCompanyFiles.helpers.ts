/**
 * =============================================================================
 * 🏢 ENTERPRISE: useAllCompanyFiles Helpers
 * =============================================================================
 *
 * Types and helper functions extracted from useAllCompanyFiles.ts
 * for SRP compliance (ADR-261).
 *
 * @module components/file-manager/hooks/useAllCompanyFiles.helpers
 * @enterprise ADR-031 - Canonical File Storage System
 */

import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported entity types for file stats
 */
export type FileEntityType = 'project' | 'building' | 'property' | 'contact' | 'company';

/**
 * Common file categories for grouping
 */
export type FileGroupCategory = 'photos' | 'videos' | 'documents' | 'contracts' | 'floorplans' | 'other';

/**
 * Files grouped by entity type and ID
 */
export interface FilesByEntity {
  projects: Record<string, FileRecord[]>;
  buildings: Record<string, FileRecord[]>;
  properties: Record<string, FileRecord[]>;
  contacts: Record<string, FileRecord[]>;
  companies: Record<string, FileRecord[]>;
}

/**
 * Files grouped by category
 */
export interface FilesByCategory {
  photos: FileRecord[];
  videos: FileRecord[];
  documents: FileRecord[];
  contracts: FileRecord[];
  floorplans: FileRecord[];
  other: FileRecord[];
}

/**
 * File statistics
 */
export interface FileStats {
  totalFiles: number;
  totalSizeBytes: number;
  byEntityType: Record<FileEntityType, number>;
  byCategory: Record<FileGroupCategory, number>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Group files by entity type and ID
 */
export function groupFilesByEntity(files: FileRecord[]): FilesByEntity {
  const grouped: FilesByEntity = {
    projects: {},
    buildings: {},
    properties: {},
    contacts: {},
    companies: {},
  };

  for (const file of files) {
    const entityType = file.entityType as string;
    const entityId = file.entityId;

    // Map entity types to our structure
    let targetGroup: Record<string, FileRecord[]> | undefined;
    switch (entityType) {
      case 'project':
        targetGroup = grouped.projects;
        break;
      case 'building':
        targetGroup = grouped.buildings;
        break;
      case 'property':
        targetGroup = grouped.properties;
        break;
      case 'contact':
        targetGroup = grouped.contacts;
        break;
      case 'company':
        targetGroup = grouped.companies;
        break;
      default:
        // Skip unknown entity types
        continue;
    }

    if (!targetGroup) continue;

    if (!targetGroup[entityId]) {
      targetGroup[entityId] = [];
    }
    targetGroup[entityId].push(file);
  }

  return grouped;
}

/**
 * Group files by category
 */
export function groupFilesByCategory(files: FileRecord[]): FilesByCategory {
  const grouped: FilesByCategory = {
    photos: [],
    videos: [],
    documents: [],
    contracts: [],
    floorplans: [],
    other: [],
  };

  for (const file of files) {
    const category = file.category as string;

    switch (category) {
      case 'photos':
        grouped.photos.push(file);
        break;
      case 'videos':
        grouped.videos.push(file);
        break;
      case 'documents':
        grouped.documents.push(file);
        break;
      case 'contracts':
        grouped.contracts.push(file);
        break;
      case 'floorplans':
        grouped.floorplans.push(file);
        break;
      default:
        grouped.other.push(file);
    }
  }

  return grouped;
}

/**
 * Calculate file statistics
 */
export function calculateStats(files: FileRecord[]): FileStats {
  const stats: FileStats = {
    totalFiles: files.length,
    totalSizeBytes: 0,
    byEntityType: {
      project: 0,
      building: 0,
      property: 0,
      contact: 0,
      company: 0,
    },
    byCategory: {
      photos: 0,
      videos: 0,
      documents: 0,
      contracts: 0,
      floorplans: 0,
      other: 0,
    },
  };

  const supportedEntityTypes: FileEntityType[] = ['project', 'building', 'property', 'contact', 'company'];
  const supportedCategories: FileGroupCategory[] = ['photos', 'videos', 'documents', 'contracts', 'floorplans'];

  for (const file of files) {
    stats.totalSizeBytes += file.sizeBytes || 0;

    // Count by entity type
    const entityType = file.entityType as string;
    if (supportedEntityTypes.includes(entityType as FileEntityType)) {
      stats.byEntityType[entityType as FileEntityType]++;
    }

    // Count by category
    const category = file.category as string;
    if (supportedCategories.includes(category as FileGroupCategory)) {
      stats.byCategory[category as FileGroupCategory]++;
    } else {
      stats.byCategory.other++;
    }
  }

  return stats;
}
