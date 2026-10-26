'use client';

/**
 * @fileoverview **Τα αρχεία της βιβλιοθήκης μέσων, ζωντανά** — ένας ακροατής για όλα τα `FileRecord` με κάτοχο
 *   `catalog_asset` (ADR-923 §5.10.4).
 * @related useCatalogCollection.ts (τα μέσα) · services/file-record-queries.ts (`fileOwnerConstraints` — ο φράχτης των
 *   κανόνων) · components/shared/files/hooks/useEntityFilesRealtime.ts (το ιδίωμα, ανά οντότητα)
 * @module hooks/catalog/useCatalogAssetFiles
 *
 * 🔑 **Ένας ακροατής, όχι ένας ανά ψηφίδα**: η βιβλιοθήκη δείχνει δεκάδες μέσα· ένας ακροατής ανά μέσο θα ήταν δεκάδες
 *    συνδέσεις. Το ίδιο στιγμιότυπο δίνει **και** τις εκδόσεις κάθε μέσου (Δ9: νέα έκδοση = νέο `FileRecord` στο ίδιο μέσο).
 * 🔑 **Ζωντανά, γιατί ο διακομιστής συμπληρώνει**: το `imageColour` το γράφει ο finalize trigger μετά το ανέβασμα και οι
 *    αποδόσεις γράφονται στη σύνδεση — η ψηφίδα τα βλέπει να εμφανίζονται χωρίς ανανέωση.
 * ⚠️ Μόνο ισότητες (χώρος · τύπος κατόχου · κατάσταση · διαγραφή) ⇒ συγχώνευση δεικτών ενός πεδίου, κανένας σύνθετος.
 *    Όριο κλίμακας (δηλωμένο): όλα τα αρχεία μέσων του χώρου σε ένα στιγμιότυπο — για βιβλιοθήκες δεκάδων χιλιάδων
 *    θα χρειαστεί σελιδοποίηση μαζί με τη λίστα μέσων.
 */

import { useEffect, useMemo, useState } from 'react';
import { where, type DocumentData } from 'firebase/firestore';

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { FileRecordService, toFileRecord } from '@/services/file-record.service';
import { fileOwnerConstraints } from '@/services/file-record-queries';
import { firestoreQueryService } from '@/services/firestore';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('useCatalogAssetFiles');

export interface CatalogAssetFiles {
  readonly ready: boolean;
  readonly byId: ReadonlyMap<string, FileRecord>;
  /** Οι εκδόσεις κάθε μέσου, νεότερη πρώτη. */
  readonly byAsset: ReadonlyMap<string, readonly FileRecord[]>;
}

const createdMs = (file: FileRecord): number => normalizeToMillisOrNull(file.createdAt) ?? 0;

function indexFiles(files: readonly FileRecord[]): Omit<CatalogAssetFiles, 'ready'> {
  const byId = new Map<string, FileRecord>();
  const byAsset = new Map<string, FileRecord[]>();
  for (const file of files) {
    byId.set(file.id, file);
    const versions = byAsset.get(file.entityId) ?? [];
    versions.push(file);
    byAsset.set(file.entityId, versions);
  }
  for (const versions of byAsset.values()) versions.sort((a, b) => createdMs(b) - createdMs(a));
  return { byId, byAsset };
}

export function useCatalogAssetFiles(): CatalogAssetFiles {
  const companyId = useCompanyId()?.companyId ?? null;
  const [load, setLoad] = useState<{ readonly ready: boolean; readonly files: readonly FileRecord[] }>({ ready: false, files: [] });

  useEffect(() => {
    if (companyId === null) return;
    return firestoreQueryService.subscribe<DocumentData>(
      FILE_COLLECTION.company,
      (result) => {
        const files = result.documents
          .map((raw) => toFileRecord(raw))
          .filter((file): file is FileRecord => file !== null)
          .filter(FileRecordService.isVisibleInActiveLists);
        setLoad({ ready: true, files });
      },
      (error) => {
        logger.error('Η ζωντανή ανάγνωση των αρχείων μέσων απέτυχε', { error: error.message });
        setLoad((prev) => ({ ready: true, files: prev.files }));
      },
      {
        constraints: [
          ...fileOwnerConstraints({ companyId }),
          where('entityType', '==', ENTITY_TYPES.CATALOG_ASSET),
          where('status', '==', FILE_STATUS.READY),
          where('isDeleted', '==', false),
        ],
      },
    );
  }, [companyId]);

  const index = useMemo(() => indexFiles(load.files), [load.files]);
  return { ready: load.ready, ...index };
}
