/**
 * ADR-375 Phase B.3 — BIM View Template types.
 *
 * Stored in `dxf_viewer_view_templates/{templateId}` (Firestore). Each template
 * is a reusable preset of `BimRenderSettings` (drawingScale + viewRange +
 * objectStyles), tenant-scoped via `companyId`. Levels reference templates
 * via `Level.appliedViewTemplateId`; on apply, the template's settings are
 * copied into `Level.bimRenderSettings` (snapshot pattern) and the FK is set.
 *
 * Decisions locked (handoff 2026-05-25):
 *   1. Separate collection (not nested under levels).
 *   2. Apply = copy settings + set FK.
 *   3. Edit propagation = client-side fan-out to all linked levels.
 *   4. Detach = null FK, keep bimRenderSettings as final snapshot.
 *   5. Enterprise ID prefix: `vtmpl_`.
 */

import type { BimRenderSettings } from './bim-render-settings-types';

/** Firestore document for a reusable BIM View Template. */
export interface ViewTemplate {
  /** Enterprise ID — prefix `vtmpl_` (ADR-017, N.6). */
  id: string;
  /** Tenant scope — mandatory for tenant isolation (Firestore rules). */
  companyId: string;
  /** Human-readable name (e.g. "Standard 1:100", "Site Plan 1:500"). */
  name: string;
  /** Optional description / usage note. Stored as `null` when absent (Firestore rejects undefined). */
  description?: string | null;
  /** Snapshot of the render settings that this template applies. */
  settings: BimRenderSettings;
  /** UID of the user who created the template. */
  createdBy: string;
  /** ISO timestamp — set server-side at creation. */
  createdAt: string;
  /** ISO timestamp — bumped on each update. */
  updatedAt: string;
}

/** Wire payload for `POST /api/dxf-view-templates`. */
export interface CreateViewTemplateInput {
  name: string;
  description?: string;
  settings: BimRenderSettings;
}

/** Wire payload for `PATCH /api/dxf-view-templates`. */
export interface UpdateViewTemplateInput {
  templateId: string;
  name?: string;
  description?: string;
  settings?: BimRenderSettings;
  _v?: number;
}

/** Apply the template to a level: copies `settings` and sets the FK. */
export interface ApplyViewTemplateInput {
  templateId: string;
  levelId: string;
}

/** Detach a level from any applied template: nulls FK, keeps `bimRenderSettings`. */
export interface DetachViewTemplateInput {
  levelId: string;
}
