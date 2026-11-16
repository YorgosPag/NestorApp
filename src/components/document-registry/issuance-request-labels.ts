/**
 * @fileoverview ADR-942 Φ1 — **οι ετικέτες της ενότητας «Έγγραφα για την έκδοση»**: κλειστοί πίνακες κλειδιών, κοινοί
 *   για τον μηχανικό (χώρος της ανάθεσης) και το γραφείο (πάνελ της γραμμής) — ΜΙΑ λέξη ανά είδος.
 * @related config/document-requests/issuance-request-catalog.ts · config/audit-value-catalogs.ts (ίδιος κατάλογος)
 * @module components/document-registry/issuance-request-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 * 🔑 **Ολικοί** πάνω στο κλειστό σύνολο του καταλόγου: νέο είδος ή βαθμίδα **δεν μεταγλωττίζεται** χωρίς λέξη. Το
 *    ιστορικό (ADR-195) διαβάζει την ΙΔΙΑ διαδρομή (`issuance.documentRequest.items`).
 */

import type { IssuanceRequestItemId, IssuanceRequestTier } from '@/config/document-requests/issuance-request-catalog';

export const ISSUANCE_REQUEST_ITEM_KEYS: Readonly<Record<IssuanceRequestItemId, string>> = {
  'study-admin-title-deed': 'document-registry:issuance.documentRequest.items.studyAdminTitleDeed',
  'study-admin-cadastre': 'document-registry:issuance.documentRequest.items.studyAdminCadastre',
  'study-admin-topographic': 'document-registry:issuance.documentRequest.items.studyAdminTopographic',
  'unit-floor-plan': 'document-registry:issuance.documentRequest.items.unitFloorPlan',
  'unit-section-drawing': 'document-registry:issuance.documentRequest.items.unitSectionDrawing',
  'unit-permit': 'document-registry:issuance.documentRequest.items.unitPermit',
  'study-energy-insulation': 'document-registry:issuance.documentRequest.items.studyEnergyInsulation',
  'study-mep-hvac': 'document-registry:issuance.documentRequest.items.studyMepHvac',
  'unit-electrical-plan': 'document-registry:issuance.documentRequest.items.unitElectricalPlan',
  'study-energy-certificate': 'document-registry:issuance.documentRequest.items.studyEnergyCertificate',
};

export const ISSUANCE_REQUEST_TIER_KEYS: Readonly<Record<IssuanceRequestTier, { readonly title: string; readonly ifMissing: string }>> = {
  A: { title: 'document-registry:issuance.documentRequest.tiers.a.title', ifMissing: 'document-registry:issuance.documentRequest.tiers.a.ifMissing' },
  B: { title: 'document-registry:issuance.documentRequest.tiers.b.title', ifMissing: 'document-registry:issuance.documentRequest.tiers.b.ifMissing' },
  C: { title: 'document-registry:issuance.documentRequest.tiers.c.title', ifMissing: 'document-registry:issuance.documentRequest.tiers.c.ifMissing' },
};

export const ISSUANCE_REQUEST_KEYS = {
  title: 'document-registry:issuance.documentRequest.title',
  leadEngaged: 'document-registry:issuance.documentRequest.leadEngaged',
  leadOffice: 'document-registry:issuance.documentRequest.leadOffice',
  tiersUnverified: 'document-registry:issuance.documentRequest.tiersUnverified',
  provided: 'document-registry:issuance.documentRequest.provided',
  providedUndated: 'document-registry:issuance.documentRequest.providedUndated',
  pendingFromOffice: 'document-registry:issuance.documentRequest.pendingFromOffice',
  askedOfOffice: 'document-registry:issuance.documentRequest.askedOfOffice',
  request: 'document-registry:issuance.documentRequest.request',
  requesting: 'document-registry:issuance.documentRequest.requesting',
  requestedToday: 'document-registry:issuance.documentRequest.requestedToday',
  requestAll: 'document-registry:issuance.documentRequest.requestAll',
  requestAllTitle: 'document-registry:issuance.documentRequest.requestAllConfirm.title',
  requestAllDescription: 'document-registry:issuance.documentRequest.requestAllConfirm.description',
  requestAllConfirm: 'document-registry:issuance.documentRequest.requestAllConfirm.confirm',
  requestAllCancel: 'document-registry:issuance.documentRequest.requestAllConfirm.cancel',
  noRecipient: 'document-registry:issuance.documentRequest.noRecipient',
  closed: 'document-registry:issuance.documentRequest.closed',
  unknown: 'document-registry:issuance.documentRequest.unknown',
  noneRequested: 'document-registry:issuance.documentRequest.noneRequested',
  upload: 'document-registry:issuance.documentRequest.upload',
  uploading: 'document-registry:issuance.documentRequest.uploading',
  uploaded: 'document-registry:issuance.documentRequest.uploaded',
  uploadFailed: 'document-registry:issuance.documentRequest.uploadFailed',
} as const;
