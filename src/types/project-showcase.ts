/**
 * =============================================================================
 * PROJECT SHOWCASE — Wire-format Types SSoT (ADR-316)
 * =============================================================================
 *
 * Canonical TypeScript contracts for the project showcase feature.
 * Used by: snapshot-builder, PDF service, public API route, viewer client.
 *
 * Mirrors the property showcase type pattern (ADR-312) applied to projects.
 *
 * @module types/project-showcase
 * @see ADR-316
 */

import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

// Re-export for downstream consumers
export type { ShowcaseCompanyBranding };

// ============================================================================
// SNAPSHOT — server-side wire format (snapshot-builder → PDF + public API)
// ============================================================================

export interface ProjectShowcaseInfo {
  id: string;
  projectCode?: string | null;
  name: string;
  description?: string | null;
  typeLabel?: string | null;
  statusLabel?: string | null;
  progress: number;
  totalValue?: number | null;
  totalArea?: number | null;
  startDate?: string | null;
  completionDate?: string | null;
  address?: string | null;
  city?: string | null;
  location?: string | null;
  client?: string | null;
  linkedCompanyName?: string | null;
}

export interface ProjectShowcaseSnapshot {
  project: ProjectShowcaseInfo;
  company: ShowcaseCompanyBranding;
}

// ============================================================================
// MEDIA — shared with property showcase
// ============================================================================

export interface ProjectShowcaseMedia {
  id: string;
  url: string;
  displayName?: string | null;
  contentType?: string | null;
}

// ============================================================================
// PAYLOAD — public API response (GET /api/project-showcase/[token])
// ============================================================================

export interface ProjectShowcasePayload {
  project: ProjectShowcaseInfo;
  company: ShowcaseCompanyBranding;
  photos: ProjectShowcaseMedia[];
  floorplans: ProjectShowcaseMedia[];
  videoUrl?: string | null;
  pdfUrl?: string | null;
  expiresAt: string;
}
