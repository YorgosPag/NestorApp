/**
 * =============================================================================
 * BUILDING SHOWCASE — Wire-format Types SSoT (ADR-320)
 * =============================================================================
 *
 * Canonical TypeScript contracts for the building showcase feature.
 * Used by: snapshot-builder, PDF service, public API route, viewer client.
 *
 * Mirrors the project showcase type pattern (ADR-316) applied to buildings.
 *
 * @module types/building-showcase
 * @see ADR-320
 */

import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

// Re-export for downstream consumers
export type { ShowcaseCompanyBranding };

// ============================================================================
// SNAPSHOT — server-side wire format (snapshot-builder → PDF + public API)
// ============================================================================

export interface BuildingShowcaseInfo {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  typeLabel?: string | null;
  statusLabel?: string | null;
  energyClassLabel?: string | null;
  renovationLabel?: string | null;
  progress: number;
  totalValue?: number | null;
  totalArea?: number | null;
  builtArea?: number | null;
  floors?: number | null;
  units?: number | null;
  constructionYear?: number | null;
  startDate?: string | null;
  completionDate?: string | null;
  address?: string | null;
  city?: string | null;
  location?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  linkedCompanyName?: string | null;
}

export interface BuildingShowcaseSnapshot {
  building: BuildingShowcaseInfo;
  company: ShowcaseCompanyBranding;
}

// ============================================================================
// MEDIA — shared shape with property / project showcases
// ============================================================================

export interface BuildingShowcaseMedia {
  id: string;
  url: string;
  displayName?: string | null;
  contentType?: string | null;
}

// ============================================================================
// PAYLOAD — public API response (GET /api/building-showcase/[token])
// ============================================================================

export interface BuildingShowcasePayload {
  building: BuildingShowcaseInfo;
  company: ShowcaseCompanyBranding;
  photos: BuildingShowcaseMedia[];
  floorplans: BuildingShowcaseMedia[];
  videoUrl?: string | null;
  pdfUrl?: string | null;
  expiresAt: string;
}
