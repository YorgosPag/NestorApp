/**
 * 📄 READ-ONLY MEDIA TYPES — Types, constants, and shared utilities
 *
 * Extracted from ReadOnlyMediaViewer (Google SRP).
 * @enterprise ADR-031 - Canonical File Storage System
 */

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { nowISO } from '@/lib/date-local';

// ── Types ──

export interface ReadOnlyMediaViewerProps {
  propertyId: string | null;
  propertyName?: string;
  floorId?: string | null;
  floorName?: string;
  buildingId?: string | null;
  floorNumber?: number | null;
  companyId?: string | null;
  levels?: Array<{ floorId: string; floorNumber: number; name: string }>;
  onHoverOverlay?: (propertyId: string | null) => void;
  onClickOverlay?: (propertyId: string) => void;
  highlightedOverlayUnitId?: string | null;
  /** Pre-formatted in-polygon hover labels keyed by propertyId (ADR-340 §3.6). */
  propertyLabels?: ReadonlyMap<string, import('@/components/shared/files/media/overlay-polygon-renderer').OverlayLabel>;
  className?: string;
}

/**
 * Media Tab Type — exported for parent components (e.g., ListLayout) to read from URL.
 * URL Query Param: ?mediaTab=floorplans|floorplan-floor|floorplan-floor-{id}|photos|videos
 */
export type MediaTab = string;

/** URL Query Param key */
export const MEDIA_TAB_PARAM = 'mediaTab' as const;

/** Default tab when no URL param */
export const DEFAULT_MEDIA_TAB: MediaTab = 'floorplans';

/** Base valid media tabs for URL validation */
const BASE_VALID_TABS = ['floorplans', 'floorplan-floor', 'photos', 'videos'] as const;

/**
 * Type-safe URL param parser.
 * Accepts base tabs + dynamic floorplan-floor-{floorId} and unit-floorplan-{floorId} tabs (ADR-236 Phase 3).
 */
export function parseMediaTabParam(value: string | null): MediaTab {
  if (!value) return DEFAULT_MEDIA_TAB;
  if ((BASE_VALID_TABS as readonly string[]).includes(value)) return value;
  if (value.startsWith('floorplan-floor-')) return value;
  if (value.startsWith('unit-floorplan-')) return value;
  return DEFAULT_MEDIA_TAB;
}

// ── FloorFloorplan → FileRecord Adapter (shared, eliminates duplication) ──

interface FloorFloorplanLike {
  fileRecordId?: string;
  buildingId: string;
  floorId: string;
  fileName?: string;
  fileType?: string;
  pdfImageUrl?: string;
  timestamp?: number;
  processedDataPath?: string;
  scene?: object | null;
}

/**
 * Converts a FloorFloorplanData to a FileRecord for FloorplanGallery consumption.
 * Used by both single-floor and multi-floor tab content components.
 */
export function adaptFloorFloorplanToFileRecord(
  floorplan: FloorFloorplanLike,
  companyId: string,
): FileRecord {
  const ext = floorplan.fileType === 'pdf' ? 'pdf'
    : floorplan.fileType === 'image' ? (floorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')
    : 'dxf';

  const contentType = floorplan.fileType === 'pdf' ? 'application/pdf'
    : floorplan.fileType === 'image' ? `image/${floorplan.fileName?.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpeg' : (floorplan.fileName?.split('.').pop()?.toLowerCase() || 'png')}`
    : 'application/dxf';

  const processedData = floorplan.processedDataPath
    ? {
        fileType: 'dxf' as const,
        processedDataPath: floorplan.processedDataPath,
        processedAt: Date.now(),
      }
    : floorplan.scene
      ? {
          fileType: 'dxf' as const,
          scene: floorplan.scene as unknown as import('@/types/file-record').DxfSceneData,
          processedAt: Date.now(),
          sceneStats: {
            entityCount: ((floorplan.scene as Record<string, unknown>).entities as unknown[] | undefined)?.length || 0,
            layerCount: Object.keys(((floorplan.scene as Record<string, unknown>).layers as Record<string, unknown>) || {}).length,
            parseTimeMs: 0,
          },
        }
      : undefined;

  return {
    id: floorplan.fileRecordId || `floor_floorplan_${floorplan.buildingId}_${floorplan.floorId}`,
    originalFilename: floorplan.fileName || 'floor_floorplan',
    displayName: floorplan.fileName || 'Κάτοψη Ορόφου',
    ext,
    contentType,
    sizeBytes: 0,
    storagePath: '',
    downloadUrl: floorplan.pdfImageUrl || '',
    status: 'ready',
    lifecycleState: 'active',
    companyId,
    entityType: 'floor',
    entityId: floorplan.floorId,
    domain: 'construction',
    category: 'floorplans',
    createdBy: SYSTEM_IDENTITY.ID,
    createdAt: floorplan.timestamp ? new Date(floorplan.timestamp).toISOString() : nowISO(),
    processedData,
  };
}
