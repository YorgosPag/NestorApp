'use client';

/**
 * @fileoverview **Τα αρχεία ενός ακινήτου του γραφείου, μιας κατηγορίας** — η ΜΙΑ ανάγνωση που μοιράζονται οι
 * φωτογραφίες (`usePropertyPhotos`) και οι κατόψεις (`usePropertyFloorplanSpots`) της κεφαλίδας (ADR-899 §4).
 * @module features/property-grid/hooks/usePropertyFileRecords
 * @related hooks/files/useEntityFileRecords (η ανάγνωση, κοινή με τον όροφο — ADR-907 §11.10)
 *
 * 🔑 Λεπτή δέσμευση: εδώ ζει **μόνο** ό,τι είναι του ακινήτου — το είδος της οντότητας και ο μισθωτής του χρήστη.
 */

import type { UseAsyncDataReturn } from '@/hooks/useAsyncData';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useEntityFileRecords } from '@/hooks/files/useEntityFileRecords';
import { ENTITY_TYPES, type FileCategory } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

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

  return useEntityFileRecords({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    category,
    companyId,
    enabled,
  });
}
