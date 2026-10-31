/**
 * @fileoverview **Η εισαγωγή όπως τη βλέπει η οθόνη** (ADR-923 §5.5.1). Μεταφορά, όχι κρίση: διαδρομή, ρήμα, σώμα.
 * @module services/catalog/catalog-import-api.client
 *
 * 🔑 Οι συλλογές εισαγωγής είναι `deny_all` (οι προτάσεις κουβαλούν τιμές): όλα περνούν από εδώ, ποτέ Firestore από τον πελάτη.
 * 🔑 `apiClient`, όχι `fetch`: `Idempotency-Key` (CHECK 3.92), χώρος, σώμα άρνησης για τα ευρήματα.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type {
  CreateImportBatchRequest,
  ImportBatchDetailView,
  ImportBatchWire,
  ImportProfileWire,
  ImportProposalWire,
  UpdateImportProposalRequest,
} from '@/subapps/catalog/types/catalog-import-requests';

export const fetchImportBatches = (): Promise<readonly ImportBatchWire[]> => apiClient.get(CATALOG_API.imports.collection);

export const fetchImportBatch = (id: string): Promise<ImportBatchDetailView> => apiClient.get(CATALOG_API.imports.item(id));

export const fetchImportProfiles = (): Promise<readonly ImportProfileWire[]> => apiClient.get(CATALOG_API.importProfiles.collection);

export const createImportProfile = (definition: ImportProfileDefinition): Promise<ImportProfileWire> =>
  apiClient.post(CATALOG_API.importProfiles.collection, { definition });

export const updateImportProfile = (id: string, expectedRevision: number, definition: ImportProfileDefinition): Promise<ImportProfileWire> =>
  apiClient.put(CATALOG_API.importProfiles.item(id), { expectedRevision, definition });

export const createImportBatch = (request: CreateImportBatchRequest): Promise<ImportBatchWire> => apiClient.post(CATALOG_API.imports.collection, request);

export const attachImportFile = (id: string, expectedRevision: number, fileId: string): Promise<ImportBatchWire> =>
  apiClient.post(CATALOG_API.imports.file(id), { expectedRevision, fileId });

export const mapImportBatch = (id: string): Promise<readonly ImportProposalWire[]> => apiClient.post(CATALOG_API.imports.map(id), {});

export const readImportPage = (id: string, page: number): Promise<ImportBatchWire> => apiClient.post(CATALOG_API.imports.pages(id), { page });

export const discardImportBatch = (id: string, expectedRevision: number): Promise<ImportBatchWire> =>
  apiClient.post(CATALOG_API.imports.discard(id), { expectedRevision });

export const updateImportProposal = (id: string, request: UpdateImportProposalRequest): Promise<ImportProposalWire> =>
  apiClient.put(CATALOG_API.importProposals.item(id), request);

export const applyImportProposal = (id: string, expectedRevision: number): Promise<ImportProposalWire> =>
  apiClient.post(CATALOG_API.importProposals.apply(id), { expectedRevision });

export const rejectImportProposal = (id: string, expectedRevision: number): Promise<ImportProposalWire> =>
  apiClient.post(CATALOG_API.importProposals.reject(id), { expectedRevision });
