/**
 * 📄 SEARCH BACKFILL TYPES — Interfaces for admin backfill page
 *
 * Extracted from page.tsx (Google SRP).
 * @enterprise ADR-029 - Global Search v1
 */

import type React from 'react';
import { NAVIGATION_ENTITIES, type NavigationEntityType } from '@/components/navigation/config/navigation-entities';

// ── API Response Types ──

export interface BackfillStats {
  processed: number;
  indexed: number;
  skipped: number;
  errors: number;
}

export interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  noCreator: number;
}

export interface MigrationResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: MigrationStats;
  duration: number;
  timestamp: string;
}

export interface ParkingFKMigrationStats {
  total: number;
  migrated: number;
  alreadyCorrect: number;
  errors: number;
}

export interface ParkingFKMigrationResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  message: string;
  stats: ParkingFKMigrationStats;
  details: Array<{
    id: string;
    action: string;
    changes?: Record<string, unknown>;
    error?: string;
  }>;
  executionTimeMs: number;
}

export interface BackfillResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: Record<string, BackfillStats>;
  totalStats: BackfillStats;
  duration: number;
  timestamp: string;
}

export interface IndexStatus {
  system: {
    name: string;
    version: string;
    security: string;
  };
  currentIndex: {
    collection: string;
    totalDocuments: number;
    byEntityType: Record<string, number>;
  };
  availableTypes: string[];
}

// ── Entity Icon Helper (centralized NAVIGATION_ENTITIES) ──

export function getEntityIcon(entityType: string): React.ElementType {
  if (entityType in NAVIGATION_ENTITIES) {
    return NAVIGATION_ENTITIES[entityType as NavigationEntityType].icon;
  }
  return NAVIGATION_ENTITIES.file.icon;
}
