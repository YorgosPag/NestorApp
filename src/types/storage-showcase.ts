/**
 * =============================================================================
 * STORAGE SHOWCASE — Wire-format Types SSoT (ADR-315)
 * =============================================================================
 *
 * Canonical TypeScript contracts for the storage showcase feature.
 * Used by: snapshot-builder, public API route, viewer client.
 *
 * Mirrors the building showcase type pattern (ADR-320) applied to storage units.
 *
 * @module types/storage-showcase
 */

import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

export type { ShowcaseCompanyBranding };

export interface StorageShowcaseMedia {
  id: string;
  url: string;
  displayName?: string | null;
  contentType?: string | null;
}

export interface StorageShowcasePayload {
  storage: {
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    typeLabel: string | null;
    statusLabel: string | null;
    area: number | null;
    price: number | null;
    floor: string | null;
    buildingName: string | null;
  };
  company: ShowcaseCompanyBranding;
  photos: StorageShowcaseMedia[];
  floorplans: StorageShowcaseMedia[];
  pdfUrl?: string | null;
  expiresAt: string;
}
