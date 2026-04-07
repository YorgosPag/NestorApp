/**
 * Types for Migration 003: Enterprise Database Architecture Consolidation
 * Extracted per Google SRP (ADR-065) — max 500 lines per file.
 */

import { Timestamp } from 'firebase/firestore';

// Enterprise Document Interfaces
export interface EnterpriseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  version: number;
  status: 'active' | 'archived' | 'deleted';
  migrationInfo: {
    migrationId: string;
    migratedAt: Timestamp;
    sourceCollection: string;
    sourceDocumentId: string;
  };
}

export interface EnterpriseFloorplan extends EnterpriseDocument {
  entityType: 'building' | 'project' | 'unit';
  entityId: string;
  entityName: string;
  floorLevel?: number;
  planType: 'architectural' | 'structural' | 'electrical' | 'mechanical';
  fileUrl?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
}

// 🏢 ENTERPRISE: Type-safe legacy scene structure for backward compatibility
export interface LegacySceneData {
  entities?: unknown[];
  layers?: unknown[];
  blocks?: unknown[];
  [key: string]: unknown;
}

export interface EnterpriseCADFile extends EnterpriseDocument {
  fileName: string;
  fileType: 'dxf' | 'dwg' | 'ifc' | 'step';
  entityId: string;
  entityType: string;
  storageUrl?: string;
  layerCount?: number;
  entityCount?: number;
  sizeBytes?: number;
  checksum?: string;
  scene?: LegacySceneData;
}

export interface EnterpriseCADLayer extends EnterpriseDocument {
  fileId: string;
  layerName: string;
  layerType: 'overlay' | 'base' | 'annotation' | 'dimension';
  visibility: boolean;
  color?: string;
  lineType?: string;
  properties?: Record<string, unknown>;
}

export interface MigrationStats {
  collectionsToMigrate: number;
  documentsAnalyzed: number;
  documentsToMigrate: number;
  documentsMigrated: number;
  errors: string[];
  collections: Record<string, {
    sourceCollection: string;
    targetCollection: string;
    documentCount: number;
    migratedCount: number;
  }>;
}
