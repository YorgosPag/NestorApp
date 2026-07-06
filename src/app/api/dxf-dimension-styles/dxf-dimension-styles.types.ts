import type { ConflictResponseBody } from '@/types/versioning';

/**
 * 📐 DXF DIMENSION STYLES — RESPONSE TYPES (ADR-362 Phase F4)
 * Mirror of `dxf-levels.types.ts`.
 */

export interface DxfDimStyleDocument {
  /**
   * For custom styles: equals the Firestore docId (via `generateDimStyleId()`).
   * For thin built-in-ref docs: the built-in template slug (e.g. `dimstyle_iso_129`)
   * — this stored `id` field intentionally wins over the Firestore docId when the
   * subscribe layer maps `{ id: doc.id, ...doc.data() }` (data spread last), so the
   * client resolves it straight to the in-registry built-in.
   */
  id: string;
  name: string;
  isDefault: boolean;
  /** True for thin pointer docs that pin a built-in template as the company default. */
  isBuiltInRef?: boolean;
  /** Full DimStyle payload (~60 fields) — present on custom styles only. */
  style?: Record<string, unknown>;
  companyId?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export type DxfDimStylesListSuccess = {
  success: true;
  styles: DxfDimStyleDocument[];
  stats: { totalStyles: number };
  message?: string;
};

export type DxfDimStylesListError = {
  success: false;
  error: string;
  details?: string;
};

export type DxfDimStylesListResponse = DxfDimStylesListSuccess | DxfDimStylesListError;

export interface DxfDimStyleCreateResponse {
  styleId: string;
}

export type DxfDimStyleUpdateResponse =
  | { success: true; message: string; _v?: number }
  | { success: false; error: string; details?: string }
  | ConflictResponseBody;

export type DxfDimStyleDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };
