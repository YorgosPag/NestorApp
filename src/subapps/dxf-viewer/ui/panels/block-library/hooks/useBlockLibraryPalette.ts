'use client';

/**
 * ADR-652 M2 — ο κύκλος ζωής του palette «Τα Blocks μου».
 *
 * Ενώνει τις δύο πηγές (in-session import + cloud βιβλιοθήκη) σε μία λίστα καρτών, και
 * κατέχει τις δύο ενέργειες που έχουν παρενέργεια:
 *  - **επιλογή** → αν είναι cloud, κατεβάζει πρώτα τη γεωμετρία (lazy hydration) και μετά
 *    δίνει στον καλούντα το όνομα του (πλέον τοποθετήσιμου) ορισμού.
 *  - **αποθήκευση** → ανεβάζει γεωμετρία + metadata (`BlockLibraryService`).
 *
 * Mirror του `useMaterialLibrary` (ADR-363): service memoized ανά (companyId, userId,
 * projectId)· το store snapshot έρχεται από τα vanilla stores (ADR-040), όχι από React state.
 *
 * @see ../../../../bim/block-library/block-palette-entries.ts — ο pure merge
 * @see ../../../../bim/block-library/hydrate-cloud-block.ts — lazy geometry
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import {
  createBlockLibraryService,
  type BlockLibraryService,
} from '../../../../bim/services/BlockLibraryService';
import {
  listSessionBlockDefs,
  subscribeSessionBlockDefs,
  getSessionBlockDef,
  removeSessionBlockDef,
} from '../../../../bim/block-library/block-library-registry';
import {
  listCloudBlockItems,
  subscribeCloudBlockItems,
} from '../../../../bim/block-library/block-library-cloud-store';
import { mergeBlockPaletteEntries } from '../../../../bim/block-library/block-palette-entries';
import { hydrateCloudBlockDef } from '../../../../bim/block-library/hydrate-cloud-block';
import { computeBlockLocalBoundsMm } from '../../../../bim/block-library/block-local-bounds';
import type {
  BlockPaletteEntry,
} from '../../../../bim/block-library/block-palette-entries';
import type {
  BlockCategory,
  BlockLicense,
  PromoteBlockLibraryItemInput,
} from '../../../../bim/block-library/block-library-types';

/** Ό,τι συμπληρώνει ο χρήστης στη φόρμα προέλευσης/άδειας. */
export interface BlockSaveFormValues {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicense;
}

/** Ό,τι αποφασίζει ο χρήστης στη φόρμα «Δημοσίευση» (M3). */
export interface BlockPromoteFormValues {
  readonly scope: PromoteBlockLibraryItemInput['scope'];
  readonly license: BlockLicense;
}

/** Ό,τι διορθώνει ο χρήστης στη φόρμα «Επεξεργασία» (M4) — metadata μόνο, ΟΧΙ scope/γεωμετρία. */
export interface BlockEditFormValues {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicense;
}

export interface UseBlockLibraryPaletteResult {
  readonly entries: readonly BlockPaletteEntry[];
  /** Κλειδί κάρτας που «δουλεύει» (κατέβασμα/αποθήκευση/δημοσίευση/διαγραφή). */
  readonly busyKey: string | null;
  readonly error: string | null;
  /** Επιλογή κάρτας → όνομα τοποθετήσιμου ορισμού, ή `null` αν απέτυχε το hydration. */
  readonly selectEntry: (entry: BlockPaletteEntry) => Promise<string | null>;
  /** Αποθήκευση session block στη ΔΙΚΗ ΜΟΥ βιβλιοθήκη (scope `user`). */
  readonly saveEntry: (entry: BlockPaletteEntry, values: BlockSaveFormValues) => Promise<boolean>;
  /** M3 — προαγωγή ιδιωτικού block σε εταιρεία/έργο (περνά από το νομικό gate). */
  readonly promoteEntry: (
    entry: BlockPaletteEntry,
    values: BlockPromoteFormValues,
  ) => Promise<boolean>;
  /** M4 — διόρθωση metadata (όνομα/κατηγορία/άδεια)· γεωμετρία και scope μένουν ως έχουν. */
  readonly updateEntry: (
    entry: BlockPaletteEntry,
    values: BlockEditFormValues,
  ) => Promise<boolean>;
  /** M3 — διαγραφή (doc + geometry blob). */
  readonly deleteEntry: (entry: BlockPaletteEntry) => Promise<boolean>;
  readonly canSaveToLibrary: boolean;
  /** Ο τρέχων χρήστης — κρίνει ποιες ενέργειες δείχνει η κάρτα. */
  readonly userId: string | undefined;
  /** Υπάρχει ενεργό έργο; (χωρίς αυτό, δεν προσφέρεται scope «έργου» στη δημοσίευση) */
  readonly hasProject: boolean;
}

export function useBlockLibraryPalette(projectId?: string): UseBlockLibraryPaletteResult {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  const defs = useSyncExternalStore(
    subscribeSessionBlockDefs,
    listSessionBlockDefs,
    listSessionBlockDefs,
  );
  const items = useSyncExternalStore(
    subscribeCloudBlockItems,
    listCloudBlockItems,
    listCloudBlockItems,
  );

  const entries = useMemo(() => mergeBlockPaletteEntries(defs, items), [defs, items]);

  const service = useMemo<BlockLibraryService | null>(() => {
    if (!companyId || !userId) return null;
    return createBlockLibraryService({ companyId, userId, projectId });
  }, [companyId, userId, projectId]);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectEntry = useCallback(async (entry: BlockPaletteEntry): Promise<string | null> => {
    setError(null);
    if (entry.source === 'session' || !entry.item) return entry.name;

    setBusyKey(entry.key);
    try {
      const def = await hydrateCloudBlockDef(entry.item);
      if (!def) {
        setError('geometryFetchFailed');
        return null;
      }
      return def.name;
    } finally {
      setBusyKey(null);
    }
  }, []);

  /**
   * Ο ΚΟΙΝΟΣ κύκλος μιας ενέργειας γραφής (αποθήκευση / δημοσίευση / διαγραφή): busy-key,
   * καθάρισμα σφάλματος, ένα i18n error key σε αποτυχία. Γράφεται ΜΙΑ φορά — οι τρεις
   * ενέργειες διαφέρουν μόνο στο σώμα τους (N.18).
   */
  const runEntryAction = useCallback(
    async (
      entry: BlockPaletteEntry,
      errorKey: string,
      action: (svc: BlockLibraryService) => Promise<void>,
    ): Promise<boolean> => {
      setError(null);
      if (!service) {
        setError(errorKey);
        return false;
      }

      setBusyKey(entry.key);
      try {
        await action(service);
        return true;
      } catch {
        setError(errorKey);
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [service],
  );

  const saveEntry = useCallback(
    async (entry: BlockPaletteEntry, values: BlockSaveFormValues): Promise<boolean> => {
      const def = getSessionBlockDef(entry.name);
      if (!def || !userId) {
        setError('saveFailed');
        return false;
      }

      return runEntryAction(entry, 'saveFailed', (svc) =>
        svc
          .saveBlock({
            scope: 'user',
            name: values.name,
            category: values.category,
            boundsMm: def.boundsMm ?? computeBlockLocalBoundsMm(def.localMembers),
            localMembers: def.localMembers,
            provenance: {
              sourceType: 'user-import',
              importedAt: Date.now(),
              importedBy: userId,
            },
            license: values.license,
          })
          .then(() => undefined),
      );
    },
    [runEntryAction, userId],
  );

  const promoteEntry = useCallback(
    async (entry: BlockPaletteEntry, values: BlockPromoteFormValues): Promise<boolean> => {
      const item = entry.item;
      if (!item) {
        setError('promoteFailed');
        return false;
      }

      return runEntryAction(entry, 'promoteFailed', (svc) =>
        svc.promoteBlock({
          blockId: item.id,
          scope: values.scope,
          license: values.license,
        }),
      );
    },
    [runEntryAction],
  );

  const updateEntry = useCallback(
    async (entry: BlockPaletteEntry, values: BlockEditFormValues): Promise<boolean> => {
      const item = entry.item;
      if (!item) {
        setError('updateFailed');
        return false;
      }

      const ok = await runEntryAction(entry, 'updateFailed', (svc) =>
        svc.updateBlock({
          blockId: item.id,
          name: values.name,
          category: values.category,
          license: values.license,
        }),
      );

      // ΜΕΤΟΝΟΜΑΣΙΑ: το registry κλειδώνει στο ΟΝΟΜΑ (`hydrateCloudBlockDef` → upsert ανά όνομα).
      // Αν είχε ήδη γίνει hydration, ο ορισμός με το ΠΑΛΙΟ όνομα μένει φάντασμα — και επειδή ο
      // dedup του palette βασίζεται κι αυτός στο όνομα, θα ξαναεμφανιζόταν ως «μη αποθηκευμένο»
      // session block (με κουμπί 💾). Τον αφαιρούμε· η νέα ταυτότητα θα κάνει hydration στο
      // επόμενο κλικ (idempotent, ίδιο blob).
      if (ok && values.name.trim() !== item.name) {
        removeSessionBlockDef(item.name);
      }
      return ok;
    },
    [runEntryAction],
  );

  const deleteEntry = useCallback(
    async (entry: BlockPaletteEntry): Promise<boolean> => {
      const item = entry.item;
      if (!item) {
        setError('deleteFailed');
        return false;
      }

      return runEntryAction(entry, 'deleteFailed', (svc) => svc.deleteBlock(item.id));
    },
    [runEntryAction],
  );

  return {
    entries,
    busyKey,
    error,
    selectEntry,
    saveEntry,
    promoteEntry,
    updateEntry,
    deleteEntry,
    canSaveToLibrary: service !== null,
    userId,
    hasProject: Boolean(projectId),
  };
}
