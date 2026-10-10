'use client';

/**
 * @fileoverview **Τα αρχεία μιας οντότητας του γραφείου, μιας κατηγορίας** — η ΜΙΑ εφάπαξ ανάγνωση.
 * @module hooks/files/useEntityFileRecords
 * @related hooks/useAsyncData (ADR-223 — σειρά απαντήσεων, unmount) · services/file-record.service ·
 *   features/property-grid/hooks/usePropertyFileRecords (ο πρώτος καταναλωτής, από όπου εξήχθη)
 *
 * 🔑 **Εξαγωγή, όχι δίδυμο** (N.18): το ακίνητο (ADR-899 §4) και ο όροφος (ADR-907 §11.10) διαφέρουν **μόνο** στο είδος
 *   της οντότητας και στο ποιος είναι ο μισθωτής· ο φύλακας (`custody`), η ενεργοποίηση και το log αποτυχίας είναι ένα.
 *
 * ⚠️ **Δεν είναι η λίστα αρχείων της οθόνης** (`useEntityFiles` — ακροατής, φίλτρα, πράξεις). Είναι η ελαφριά ανάγνωση
 *   για όποιον θέλει απλώς να **ρωτήσει** τα αρχεία.
 */

import { useAsyncData, type UseAsyncDataReturn } from '@/hooks/useAsyncData';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';

import { useSettledFileChange } from './useSettledFileChange';

const logger = createModuleLogger('useEntityFileRecords');

export interface EntityFileRecordsQuery {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly category: FileCategory;
  /** Ο μισθωτής των αρχείων — ο καλών ξέρει **ποιανού** είναι η οντότητα (π.χ. το κτίριο, για super_admin). */
  readonly companyId: string | null | undefined;
  /** `false` ⇒ καμία ανάγνωση. */
  readonly enabled?: boolean;
  /** `true` ⇒ ξαναδιαβάζει **σιωπηλά** όταν αλλάξει αρχείο στην ίδια οθόνη (ένα αίτημα μετά το τελευταίο σήμα). */
  readonly refreshOnFileChange?: boolean;
}

export function useEntityFileRecords({
  entityType,
  entityId,
  category,
  companyId,
  enabled = true,
  refreshOnFileChange = false,
}: EntityFileRecordsQuery): UseAsyncDataReturn<readonly FileRecord[]> {
  const ready = enabled && typeof companyId === 'string' && companyId.length > 0 && entityId.length > 0;

  const files = useAsyncData<readonly FileRecord[]>({
    fetcher: () =>
      FileRecordService.getFilesByEntity(entityType, entityId, {
        custody: { companyId: companyId ?? '' },
        category,
      }),
    deps: [entityType, entityId, companyId, category],
    enabled: ready,
    onError: (message) => logger.warn('Τα αρχεία της οντότητας δεν διαβάστηκαν', { entityType, entityId, category, message }),
  });

  const { silentRefetch } = files;
  useSettledFileChange(ready && refreshOnFileChange ? entityId : null, () => { void silentRefetch(); });

  return files;
}
