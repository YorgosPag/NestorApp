/**
 * @fileoverview **Η εισαγωγή όπως τη βλέπει η οθόνη** (ADR-923 §5.5.1). Μεταφορά, όχι κρίση: διαδρομή, ρήμα, σώμα.
 * @module services/catalog/catalog-import-api.client
 *
 * 🔑 Οι συλλογές εισαγωγής είναι `deny_all` (οι προτάσεις κουβαλούν τιμές): όλα περνούν από εδώ, ποτέ Firestore από τον πελάτη.
 * 🔑 `apiClient`, όχι `fetch`: `Idempotency-Key` (CHECK 3.92), χώρος, σώμα άρνησης για τα ευρήματα.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API, EXPECTED_REVISION_PARAM, LABEL_MEMORY_SUPPLIER_PARAM } from '@/subapps/catalog/catalog-routes';
import type { ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportAssetView } from '@/subapps/catalog/types/catalog-media';
import type {
  ClearLabelMemoryResult,
  CreateImportBatchRequest,
  FetchImportAssetRequest,
  ImportAssetsView,
  ImportBatchDetailView,
  ImportBatchWire,
  ImportLabelMemoryWire,
  ImportMemoryActionRequest,
  ImportMemoryActionResult,
  ImportProfileWire,
  ImportProposalWire,
  LabelMemoryListView,
  SetImportLineRequest,
  SetImportLineResult,
  SetImportPriceTargetRequest,
  SetImportSupplierRequest,
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

/** Απόφαση γραμμής πίνακα και ξαναερμηνεία χωρίς AI (§5.5.2 Β3): επιστρέφει όλη την όψη και αν αρνήθηκε, με λόγο. */
export const setImportLine = (id: string, request: SetImportLineRequest): Promise<SetImportLineResult> => apiClient.post(CATALOG_API.imports.lines(id), request);

/** Αναβάθμιση μίας σελίδας στην τρέχουσα έκδοση παραγωγής, χωρίς AI (§5.5.2 Β3.1). Ιδεμπότητο: τρέχουσα σελίδα ⇒ καμία αλλαγή. */
export const reinterpretImportPage = (id: string, page: number): Promise<ImportBatchDetailView> => apiClient.post(CATALOG_API.imports.reinterpret(id), { page });

/** Ο τιμοκατάλογος της παρτίδας ιδιοτήτων (§5.5.2 Β4): χωρίς νέα ανάγνωση· επιστρέφει όλη την όψη με τις ξανασχεδιασμένες τιμές. */
export const setImportPriceTarget = (id: string, request: SetImportPriceTargetRequest): Promise<ImportBatchDetailView> =>
  apiClient.put(CATALOG_API.imports.priceTarget(id), request);

/** Ο προμηθευτής και ο διακόπτης μάθησης της παρτίδας (§5.5.2 Β5): χωρίς νέα ανάγνωση και χωρίς εφαρμογή μνήμης (Απόφαση 4). */
export const setImportSupplier = (id: string, request: SetImportSupplierRequest): Promise<ImportBatchDetailView> =>
  apiClient.put(CATALOG_API.imports.supplier(id), request);

/** Ρητή εφαρμογή ή αναίρεση όλων της μνήμης (§5.5.2 Β5.2), χωρίς AI: επιστρέφει όλη την όψη και τι έγινε. */
export const runImportMemoryAction = (id: string, request: ImportMemoryActionRequest): Promise<ImportMemoryActionResult> =>
  apiClient.post(CATALOG_API.imports.memory(id), request);

/** Η μνήμη ετικετών ενός προμηθευτή (§5.5.2 Β5.2). */
export function fetchLabelMemory(supplierContactId: string): Promise<LabelMemoryListView> {
  const query = new URLSearchParams({ [LABEL_MEMORY_SUPPLIER_PARAM]: supplierContactId });
  return apiClient.get(`${CATALOG_API.importLabelMemory.collection}?${query.toString()}`);
}

export function deleteLabelMemory(id: string, expectedRevision: number): Promise<ImportLabelMemoryWire> {
  const query = new URLSearchParams({ [EXPECTED_REVISION_PARAM]: String(expectedRevision) });
  return apiClient.delete<ImportLabelMemoryWire>(`${CATALOG_API.importLabelMemory.item(id)}?${query.toString()}`);
}

export const clearLabelMemory = (supplierContactId: string): Promise<ClearLabelMemoryResult> =>
  apiClient.post(CATALOG_API.importLabelMemory.clear, { supplierContactId });

export const discardImportBatch = (id: string, expectedRevision: number): Promise<ImportBatchWire> =>
  apiClient.post(CATALOG_API.imports.discard(id), { expectedRevision });

/** Η ουρά μέσων της παρτίδας, με την κατάσταση κάθε διεύθυνσης (ADR-934 §5.2.2 Μ-β4). */
export const fetchImportAssets = (id: string): Promise<ImportAssetsView> => apiClient.get(CATALOG_API.imports.assets(id));

/** Κατέβασε μία διεύθυνση της παρτίδας σε καραντίνα. Ιδεμπότητο: έτοιμη ⇒ ως έχει· `retry` μόνο για ρητή «Ξαναδοκιμή». */
export const fetchImportAsset = (id: string, request: FetchImportAssetRequest): Promise<ImportAssetView> =>
  apiClient.post(CATALOG_API.imports.assets(id), request);

export const updateImportProposal = (id: string, request: UpdateImportProposalRequest): Promise<ImportProposalWire> =>
  apiClient.put(CATALOG_API.importProposals.item(id), request);

export const applyImportProposal = (id: string, expectedRevision: number): Promise<ImportProposalWire> =>
  apiClient.post(CATALOG_API.importProposals.apply(id), { expectedRevision });

export const rejectImportProposal = (id: string, expectedRevision: number): Promise<ImportProposalWire> =>
  apiClient.post(CATALOG_API.importProposals.reject(id), { expectedRevision });
