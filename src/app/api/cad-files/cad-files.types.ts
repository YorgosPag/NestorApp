/**
 * 📐 CAD FILES API — Response Types (ADR-288)
 *
 * Data payloads carried inside the canonical ApiSuccessResponse envelope.
 * The enterprise-api-client unwraps `{ success, data }` so gateway callers
 * receive these payloads directly.
 */

export interface CadFileDocument {
  id: string;
  fileName: string;
  storageUrl: string;
  storagePath: string;
  sizeBytes: number;
  entityCount: number;
  checksum?: string;
  version: number;
  companyId: string;
  createdBy: string;
  [key: string]: unknown;
}

/** POST /api/cad-files — upsert result payload */
export interface CadFileUpsertResponse {
  fileId: string;
  version: number;
  created: boolean;
}

/** GET /api/cad-files?fileId=... — result payload */
export type CadFileGetResponse =
  | { success: true; metadata: CadFileDocument; message?: string }
  | { success: false; error: string; details?: string };

/** DELETE /api/cad-files?fileId=... — result payload */
export type CadFileDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };
