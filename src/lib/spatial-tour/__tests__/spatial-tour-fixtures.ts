/**
 * Κοινά δεδομένα για τα tests της χωρικής περιήγησης (ADR-884 Κ1) — ένα **έγκυρο** έγγραφο ανά είδος,
 * ώστε κάθε test να αλλάζει ΕΝΑ πεδίο και να ξέρει ότι μόνο αυτό έφερε την άρνηση.
 */

import type { MediaRights } from '@/types/media-rights';
import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

export const RIGHTS: MediaRights = {
  creator: { name: 'Νίκος Φωτογράφος', userId: null, url: null },
  licensors: [],
  copyrightNotice: '© 2026 Νίκος Φωτογράφος',
  webStatementOfRights: null,
  license: { purpose: 'listing-marketing', term: { kind: 'mandate', mandateId: 'mand_1' } },
};

export const TOUR_DOC = {
  companyId: 'comp_1',
  subject: { kind: 'company-property', id: 'prop_1' },
  visibility: 'public',
  lifecycle: 'published',
  levels: [
    {
      key: { kind: 'floor', floorId: 'flr_1' },
      floorPlans: [{ source: 'engineer', state: 'active', fileId: 'file_plan', approvedBy: 'usr_1', approvedAt: '2026-09-01T00:00:00.000Z' }],
    },
  ],
  nodes: [
    { id: 'tnod_a', levelKey: { kind: 'floor', floorId: 'flr_1' }, position: { x: 1, y: 2, z: 1.6 }, links: [{ toNodeId: 'tnod_b', via: 'bim-opening' }] },
    { id: 'tnod_b', levelKey: { kind: 'floor', floorId: 'flr_1' }, position: { x: 4, y: 2, z: 1.6 }, links: [{ toNodeId: 'tnod_a', via: 'manual' }] },
  ],
  revision: 3,
  createdAt: '2026-09-01T10:00:00.000Z',
  createdBy: 'usr_1',
  updatedAt: '2026-09-02T10:00:00.000Z',
  updatedBy: 'usr_1',
};

export const CAPTURE_DOC = {
  tourId: 'stour_1',
  nodeId: 'tnod_a',
  capturedAt: '2026-09-01T09:00:00.000Z',
  headingRad: 1.2,
  source: 'camera-360',
  provenance: 'as-built',
  baseCaptureId: null,
  signatory: null,
  audience: 'public-listing',
  milestone: null,
  originalFileId: 'file_pano',
  rights: RIGHTS,
  tileset: { state: 'ready', contentHash: 'abc' },
  uploadedBy: 'usr_photo',
  createdAt: '2026-09-01T09:05:00.000Z',
};

/** Έτοιμο `SpatialTour` για τα tests αναλλοίωτων (όχι έγγραφο). */
export const TOUR: SpatialTour = {
  id: 'stour_1',
  custody: { companyId: 'comp_1' },
  subject: { kind: 'company-property', id: 'prop_1' },
  visibility: 'public',
  lifecycle: 'published',
  levels: [
    {
      key: { kind: 'floor', floorId: 'flr_1' },
      floorPlans: [{ source: 'engineer', state: 'active', fileId: 'file_plan', approvedBy: null, approvedAt: null }],
    },
  ],
  nodes: [
    { id: 'tnod_a', levelKey: { kind: 'floor', floorId: 'flr_1' }, position: { x: 1, y: 2, z: 1.6 }, links: [{ toNodeId: 'tnod_b', via: 'manual' }] },
    { id: 'tnod_b', levelKey: { kind: 'floor', floorId: 'flr_1' }, position: null, links: [{ toNodeId: 'tnod_a', via: 'manual' }] },
  ],
  revision: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  createdBy: 'usr_1',
  updatedAt: '2026-09-01T10:00:00.000Z',
  updatedBy: 'usr_1',
};

export const CAPTURE: TourCapture = {
  id: 'tcap_1',
  tourId: 'stour_1',
  nodeId: 'tnod_a',
  capturedAt: '2026-09-01T09:00:00.000Z',
  headingRad: 0,
  source: 'camera-360',
  provenance: 'as-built',
  baseCaptureId: null,
  signatory: null,
  audience: 'public-listing',
  milestone: null,
  originalFileId: 'file_pano',
  rights: RIGHTS,
  tileset: { state: 'ready', contentHash: 'abc' },
  uploadedBy: 'usr_photo',
  createdAt: '2026-09-01T09:05:00.000Z',
};
