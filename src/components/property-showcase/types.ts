/**
 * Property Showcase — Shared types (ADR-312)
 *
 * Mirror of the public API response returned from GET /api/showcase/[token].
 * Kept separate so page + sub-components can consume the same shape.
 */

export interface ShowcaseMedia {
  id: string;
  url: string;
  displayName?: string;
  /**
   * Raster preview URL for non-image originals (e.g. DXF Κατόψεις).
   * When present, the UI renders this inline; `url` still points to the
   * raw file download (DXF) for users who want the CAD original.
   */
  previewUrl?: string;
  /** Lowercased extension of the original file, used to drive rendering. */
  ext?: string;
}

export interface ShowcasePropertySnapshot {
  id: string;
  code?: string;
  name: string;
  type?: string;
  building?: string;
  floor?: number;
  description?: string;
  layout?: { bedrooms?: number; bathrooms?: number; wc?: number };
  areas?: { gross?: number; net?: number; balcony?: number; terrace?: number };
  orientations?: string[];
  energyClass?: string;
  condition?: string;
  features?: string[];
}

export interface ShowcaseCompanyBrand {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface ShowcasePayload {
  property: ShowcasePropertySnapshot;
  company: ShowcaseCompanyBrand;
  photos: ShowcaseMedia[];
  floorplans: ShowcaseMedia[];
  videoUrl?: string;
  pdfUrl?: string;
  expiresAt: string;
}
