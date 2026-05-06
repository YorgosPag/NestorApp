/**
 * =============================================================================
 * PARKING SHOWCASE — Wire-format Types SSoT (ADR-315)
 * =============================================================================
 *
 * Canonical TypeScript contracts for the parking showcase feature.
 * Used by: snapshot-builder, public API route, viewer client.
 *
 * Mirrors the building showcase type pattern (ADR-320) applied to parking spots.
 *
 * @module types/parking-showcase
 */

import type { ShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';

export type { ShowcaseCompanyBranding };

export interface ParkingShowcaseMedia {
  id: string;
  url: string;
  displayName?: string | null;
  contentType?: string | null;
}

export interface ParkingShowcasePayload {
  parking: {
    id: string;
    number: string;
    code: string | null;
    description: string | null;
    typeLabel: string | null;
    statusLabel: string | null;
    locationZoneLabel: string | null;
    area: number | null;
    price: number | null;
    floor: string | null;
    buildingName: string | null;
  };
  company: ShowcaseCompanyBranding;
  photos: ParkingShowcaseMedia[];
  floorplans: ParkingShowcaseMedia[];
  pdfUrl?: string | null;
  expiresAt: string;
}
