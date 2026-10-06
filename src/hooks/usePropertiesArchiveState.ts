'use client';

/**
 * 🗄️ usePropertiesArchiveState — το ΑΡΧΕΙΟ των ακινήτων, πάνω στη μηχανή του κάδου.
 *
 * Ο κύκλος ζωής έχει δύο καταστάσεις απόσυρσης (ADR-281 · ADR-329 §3.9): ο **κάδος** («σβήσε με»,
 * εκκαθαρίζεται στις 30 ημέρες) και το **αρχείο** («αποσύρθηκα, αλλά με αναφέρουν άλλες εγγραφές» —
 * μένει για πάντα, επαναφέρεται). Η ΠΡΟΒΟΛΗ τους είναι η ίδια: λίστα, επιλογή, επαναφορά, ανανέωση.
 * Γι' αυτό εδώ δεν υπάρχει δεύτερη μηχανή — μόνο ό,τι διαφέρει: η διαδρομή της λίστας και ο δρόμος
 * της επιστροφής (`unarchive` αντί για `restore`).
 *
 * ⚠️ Τα ονόματα της μηχανής (`showTrash`, `trashCount`…) μεταφράζονται ΕΔΩ στα ονόματα του αρχείου,
 * ώστε η σελίδα να μη διαβάζει ποτέ «trash» εκεί που εννοεί «αρχείο».
 *
 * @module hooks/usePropertiesArchiveState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9 — Αρχείο
 */

import { useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { useEntityTrashState, type EntityTrashSpec } from '@/hooks/trash/useEntityTrashState';
import type { Property } from '@/types/property-viewer';
import type { LifecycleOutcome } from '@/types/soft-deletable';

interface UsePropertiesArchiveStateParams {
  forceDataRefresh: () => void;
  clearSelection?: () => void;
}

/**
 * Ο ΕΝΑΣ δρόμος επιστροφής από το αρχείο. Τον ζητά η μηχανή (spec) **και** η μπάρα του αρχείου —
 * ποτέ δεύτερη γραφή του `bulkUnarchive('property', …)`.
 */
export const unarchiveProperties = (ids: string[]): Promise<LifecycleOutcome[]> =>
  TrashService.bulkUnarchive('property', ids);

const PROPERTIES_ARCHIVE_SPEC: EntityTrashSpec<Property> = {
  entityKind: 'property',
  trashRoute: API_ROUTES.PROPERTIES.ARCHIVED,
  selectItems: response => response.properties as Property[] | undefined,
  restore: unarchiveProperties,
};

export function usePropertiesArchiveState({
  forceDataRefresh,
  clearSelection,
}: UsePropertiesArchiveStateParams) {
  const archive = useEntityTrashState(PROPERTIES_ARCHIVE_SPEC, { forceDataRefresh, clearSelection });

  return useMemo(
    () => ({
      showArchive: archive.showTrash,
      archiveCount: archive.trashCount,
      archivedProperties: archive.items,
      loadingArchive: archive.loadingTrash,
      handleToggleArchive: archive.handleToggleTrash,
      handleArchiveActionComplete: archive.handleTrashActionComplete,
      handleUnarchiveProperties: archive.handleRestore,
      fetchArchivedProperties: archive.fetchTrashedItems,
    }),
    [archive],
  );
}
