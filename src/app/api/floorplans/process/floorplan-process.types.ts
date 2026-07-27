/**
 * Types for the floorplan processing API route.
 * @module api/floorplans/process/types
 */

import type { FloorplanProcessedData } from '@/types/file-record';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';

export interface ProcessFloorplanRequest {
  fileId: string;
  forceReprocess?: boolean;
}

export interface ProcessFloorplanSuccessResponse {
  success: true;
  fileId: string;
  fileType: 'dxf' | 'pdf';
  processedAt: string;
  stats?: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
  /** ADR-635 Φ3 — Revit-style import warnings (skipped/failed/clamped entities). */
  warnings?: string[];
}

export interface ProcessFloorplanErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  details?: string;
}

export interface ProcessFloorplanInProgressResponse {
  success: true;
  status: 'in_progress';
  fileId: string;
}

export type ProcessFloorplanResponse =
  | ProcessFloorplanSuccessResponse
  | ProcessFloorplanInProgressResponse
  | ProcessFloorplanErrorResponse;

export interface FileRecordData {
  id: string;
  storagePath: string;
  contentType: string;
  ext: string;
  originalFilename: string;
  displayName: string;
  processedData?: FloorplanProcessedData;
  companyId?: string;
  processingStatus?: 'idle' | 'processing' | 'done' | 'error';
  /**
   * ADR-716 Φ5 — η ρητή ετυμηγορία μονάδων του μηχανικού, γραμμένη στο FileRecord τη
   * στιγμή του ανεβάσματος. Το route ήδη κατεβάζει το έγγραφο ⇒ καμία αλλαγή στο
   * request schema, καμία δεύτερη πηγή αλήθειας.
   */
  userDrawingUnits?: SceneUnits;
}

export interface FirebaseAdminError {
  message?: string;
  code?: string;
  details?: string;
}
