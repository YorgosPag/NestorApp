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
import type { ShowcaseMediaItem } from '@/services/showcase-core/public-media';

export type { ShowcaseCompanyBranding, ShowcaseMediaItem };

/**
 * @deprecated Name kept for consumers; the shape is
 * {@link ShowcaseMediaItem} — declared once in showcase-core (ADR-698). This
 * interface, its sibling twins and the four `loadXMedia` helpers that filled
 * them were byte-identical.
 */
export type ParkingShowcaseMedia = ShowcaseMediaItem;

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
