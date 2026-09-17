/**
 * useLifecycleFileList — η **μία** φόρτωση λίστας κύκλου ζωής (κάδος · αρχειοθήκη) ενός κατόχου.
 *
 * 🧹 **Εξήχθη με μέτρηση (CHECK 3.28, ADR-866 §2.6.8)**: `TrashView` και `ArchiveView` έγραφαν
 * **δίδυμο** σώμα — κρυφή μνήμη ανά κλειδί, τρεις καταστάσεις, ανάγνωση, σφάλμα — που διέφερε μόνο
 * στη συνάρτηση ανάγνωσης. Όταν ο κάτοχος έγινε «εταιρεία Ή άνθρωπος», το ίδιο μπλοκ θα έμπαινε
 * **δύο φορές**· μπαίνει **μία**.
 *
 * 🔑 Κλειδί κρυφής μνήμης = **είδος + id κατόχου** + οντότητα (`fileCustodyKey`): ο κάδος ενός
 * ανθρώπου και μιας εταιρείας δεν συγκρούονται ποτέ. Απών κάτοχος ⇒ **καμία** ανάγνωση.
 *
 * @module components/shared/files/hooks/useLifecycleFileList
 */

import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { EntityType } from '@/config/domain-constants';
import { fileCustodyKey, type FileCustody } from '@/lib/files/file-custody';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import { useStableFileCustody } from './useStableFileCustody';

const logger = createModuleLogger('LIFECYCLE_FILE_LIST');

/**
 * **Οι δύο κατάλογοι κύκλου ζωής** — κρυφή μνήμη (επιβιώνει αλλαγή καρτέλας) + ανάγνωση. ΜΙΑ δήλωση:
 * οι προβολές λένε **ποιος** κατάλογος, όχι **πώς** διαβάζεται.
 */
const LIFECYCLE_LISTS = {
  trashed: { cache: createStaleCache<FileRecord[]>('file-trash'), load: FileRecordService.getTrashedFiles },
  archived: { cache: createStaleCache<FileRecord[]>('file-archive'), load: FileRecordService.getArchivedFiles },
} as const;

type LifecycleListKind = keyof typeof LIFECYCLE_LISTS;

interface UseLifecycleFileListParams {
  readonly list: LifecycleListKind;
  readonly custody: FileCustody | undefined;
  readonly entityType?: string;
  readonly entityId?: string;
}

interface UseLifecycleFileListReturn {
  readonly files: FileRecord[];
  readonly setFiles: Dispatch<SetStateAction<FileRecord[]>>;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<void>;
}

export function useLifecycleFileList(params: UseLifecycleFileListParams): UseLifecycleFileListReturn {
  const { list: label, entityType, entityId } = params;
  const { cache, load } = LIFECYCLE_LISTS[label];
  const custody = useStableFileCustody(params.custody);
  const ownerKey = custody ? fileCustodyKey(custody) : 'none';
  const cacheKey = `${ownerKey}-${entityType ?? 'all'}-${entityId ?? 'all'}`;

  const [files, setFiles] = useState<FileRecord[]>(cache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(!cache.hasLoaded(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!custody) return;
    try {
      if (!cache.hasLoaded(cacheKey)) setLoading(true);
      setError(null);
      logger.info(`Fetching ${label} files`, { ownerKey, entityType, entityId });

      const loaded = await load({ custody, entityType: entityType as EntityType | undefined, entityId });

      logger.info(`${label} files fetched`, { count: loaded.length });
      cache.set(loaded, cacheKey);
      setFiles(loaded);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(`Failed to fetch ${label} files`);
      logger.error(`Failed to fetch ${label} files`, { error: fetchError.message });
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [cache, cacheKey, custody, entityId, entityType, label, load, ownerKey]);

  // Fetch on mount
  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { files, setFiles, loading, error, refetch };
}
