'use client';

/**
 * @fileoverview **Τα αρχεία ενός ακινήτου του γραφείου, μιας κατηγορίας** — η ΜΙΑ ανάγνωση που μοιράζονται οι
 * φωτογραφίες (`usePropertyPhotos`) και οι κατόψεις (`usePropertyFloorplanSpots`) της κεφαλίδας (ADR-899 §4).
 * @module features/property-grid/hooks/usePropertyFileRecords
 * @related hooks/useAsyncData (ADR-223 — σειρά απαντήσεων, unmount) · services/file-record.service
 *
 * 🔑 **Εξαγωγή, όχι δίδυμο** (N.18): οι δύο καταναλωτές διαφέρουν **μόνο** στην κατηγορία· ο φύλακας (`custody`), η
 *   ενεργοποίηση και το log αποτυχίας είναι ένα.
 */

import { useAsyncData, type UseAsyncDataReturn } from '@/hooks/useAsyncData';
import { useCompanyId } from '@/hooks/useCompanyId';
import { ENTITY_TYPES, type FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('usePropertyFileRecords');

export interface PropertyFileRecordsQuery {
  readonly propertyId: string;
  readonly category: FileCategory;
  /** `false` ⇒ καμία ανάγνωση (π.χ. οι κατόψεις μέχρι να ανοίξει το lightbox). */
  readonly enabled?: boolean;
}

export function usePropertyFileRecords({
  propertyId,
  category,
  enabled = true,
}: PropertyFileRecordsQuery): UseAsyncDataReturn<readonly FileRecord[]> {
  const { companyId } = useCompanyId() ?? {};

  return useAsyncData<readonly FileRecord[]>({
    fetcher: () =>
      FileRecordService.getFilesByEntity(ENTITY_TYPES.PROPERTY, propertyId, {
        custody: { companyId: companyId ?? '' },
        category,
      }),
    deps: [propertyId, companyId, category],
    enabled: enabled && typeof companyId === 'string' && companyId.length > 0 && propertyId.length > 0,
    onError: (message) => logger.warn('Τα αρχεία του ακινήτου δεν διαβάστηκαν', { propertyId, category, message }),
  });
}
