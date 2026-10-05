/**
 * =============================================================================
 * Η ΕΠΙΛΟΓΗ ΑΡΧΕΙΟΥ ΤΟΥ `/files` ΖΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ (ADR-899 §9 θέμα 10)
 * =============================================================================
 *
 * Πριν: `useState<FileRecord | null>` — η επιλογή χανόταν σε reload, δεν μοιραζόταν, και το πάνελ κρατούσε
 * **αντίγραφο** της εγγραφής (μπαγιάτικο μετά από ζωντανή ενημέρωση της λίστας).
 * Τώρα: η διεύθυνση (`?file=<id>`) είναι η **μία** πηγή, και το αρχείο **παράγεται** από τις ζωντανές λίστες.
 *
 * 🔑 **Σύνθεση, όχι νέα μηχανή** — τρία υπάρχοντα SSoT:
 * `useSelectedEntityUrlState` (το δοχείο) · `deriveEntitySelection` + `useEntityFallbackResolution` (η απόφαση,
 * ADR-777 §8.31) · `fileViewerOutcomeOf` (τι σημαίνει για τον θεατή αρχείων).
 *
 * ⚠️ Η απόφαση διαβάζει την **αφιλτράριστη** λίστα: ένα φίλτρο δεν «εξαφανίζει» το αρχείο που ζήτησε η διεύθυνση
 * — το δείχνει, με ένδειξη ότι η λίστα το κρύβει.
 *
 * @module components/file-manager/useFileViewerSelection
 */

import { useCallback, useMemo } from 'react';

import { deriveEntitySelection } from '@/hooks/entity-selection-state';
import { useEntityFallbackResolution } from '@/hooks/useEntityFallbackResolution';
import { useSelectedEntityUrlState } from '@/hooks/useSelectedEntityUrlState';
import { fileShownBy, fileViewerOutcomeOf, type FileViewerOutcome } from '@/lib/files/file-viewer-outcome';
import { FILE_VIEWER_PARAM } from '@/lib/files/file-viewer-route';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';

const LOGGER_NAME = 'FileViewerSelection';

/**
 * Η εφεδρεία για ταυτότητα **εκτός** φορτωμένων λιστών (εισερχόμενο, αρχειοθετημένο, Κάδος που δεν ήρθε ακόμη).
 * Σταθερή αναφορά — είναι στα deps του `useEntityFallbackResolution`.
 * ⚠️ Διαβάζει **μόνο** τη συλλογή του γραφείου: ποτέ «δοκίμασε και την προσωπική» (ADR-866 §2.6.8 Γ).
 */
const resolveFileById = (fileId: string): Promise<FileRecord | null> => FileRecordService.getFileRecord(fileId);

export interface FileViewerSelectionParams {
  readonly companyId: string;
  /** Η ενεργή λίστα, **χωρίς** φίλτρα. */
  readonly files: readonly FileRecord[];
  readonly trashedFiles: readonly FileRecord[];
  /** Ό,τι δείχνει τώρα η λίστα αριστερά (μετά από φίλτρα και αναζήτηση). */
  readonly visibleFiles: readonly FileRecord[];
  /** Απάντησε η πηγή της λίστας; — όχι «σταμάτησε να φορτώνει» χωρίς χώρο. */
  readonly hasAnswered: boolean;
}

export interface FileViewerSelection {
  /** Το αρχείο που δείχνει το πάνελ, ή `null` (καμία επιλογή **ή** έκβαση-μήνυμα — δες `viewerOutcome`). */
  readonly selectedFile: FileRecord | null;
  readonly viewerOutcome: FileViewerOutcome<FileRecord>;
  /** Σχήμα `useState`, δοχείο η διεύθυνση. `null` ⇒ σβήνει την παράμετρο. */
  readonly setSelectedFile: (file: FileRecord | null) => void;
}

export function useFileViewerSelection({
  companyId, files, trashedFiles, visibleFiles, hasAnswered,
}: FileViewerSelectionParams): FileViewerSelection {
  const { selectedId, setSelectedId } = useSelectedEntityUrlState(FILE_VIEWER_PARAM);

  const inLoadedLists = useMemo(
    () => !selectedId || files.some(f => f.id === selectedId) || trashedFiles.some(f => f.id === selectedId),
    [selectedId, files, trashedFiles],
  );

  const fallbackEnabled = hasAnswered && !inLoadedLists;
  const fallback = useEntityFallbackResolution<FileRecord>({
    requestedId: selectedId,
    enabled: fallbackEnabled,
    resolveById: resolveFileById,
    loggerName: LOGGER_NAME,
  });

  const viewerOutcome = useMemo(() => {
    // ⚠️ Η εφεδρεία ξεκινά σε effect: στο καρέ ΠΡΙΝ τρέξει είναι ακόμη `unavailable`, και χωρίς αυτή τη γραμμή
    //    ο θεατής θα ανακοίνωνε «δεν βρέθηκε» για ένα καρέ. Οφείλεται ⇒ μετρά ως εν εξελίξει.
    const owed = fallbackEnabled && fallback.phase === 'unavailable';
    const selection = deriveEntitySelection<FileRecord>({
      requestedId: selectedId, hasAnswered, items: files, archivedItems: trashedFiles,
      fallback: owed ? { phase: 'pending', item: null } : fallback,
    });
    return fileViewerOutcomeOf(selection, { companyId, visibleIds: new Set(visibleFiles.map(f => f.id)) });
  }, [selectedId, hasAnswered, files, trashedFiles, fallback, fallbackEnabled, companyId, visibleFiles]);

  const setSelectedFile = useCallback(
    (file: FileRecord | null) => setSelectedId(file?.id ?? null),
    [setSelectedId],
  );

  return { selectedFile: fileShownBy(viewerOutcome), viewerOutcome, setSelectedFile };
}
