/**
 * Types for the floorplan processing API route.
 * @module api/floorplans/process/types
 */

import type { FloorplanProcessedData } from '@/types/file-record';

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
}

export interface FirebaseAdminError {
  message?: string;
  code?: string;
  details?: string;
}
