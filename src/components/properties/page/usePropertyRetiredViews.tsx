'use client';

/**
 * 🗑️🗄️ usePropertyRetiredViews — οι δύο προβολές «αποσυρμένων» της σελίδας ακινήτων, σε ΕΝΑ σημείο.
 *
 * Ο κύκλος ζωής έχει δύο καταστάσεις απόσυρσης (ADR-281 · ADR-329 §3.9): τον **κάδο** («σβήσε με»,
 * εκκαθάριση στις 30 ημέρες) και το **αρχείο** («αποσύρθηκα, αλλά με αναφέρουν άλλες εγγραφές» — μένει
 * για πάντα). Η σελίδα δεν χρειάζεται να ξέρει τίποτα από αυτά: παίρνει από εδώ ό,τι απλώνει στην
 * κεφαλίδα (`headerProps`), τι δείχνει το σώμα (`retiredView`), τη μπάρα ενεργειών και τους διαλόγους.
 *
 * Τι ΑΝΗΚΕΙ εδώ και πουθενά αλλού:
 *   • ο **αμοιβαίος αποκλεισμός** — ανοίγοντας τη μία προβολή κλείνει η άλλη. Δύο ανεξάρτητα toggles
 *     στη σελίδα θα επέτρεπαν «και κάδος και αρχείο», και το σώμα θα έπρεπε να διαλέξει σιωπηλά.
 *   • η **φρεσκάδα του μετρητή του αρχείου** (βλ. `useArchiveCountFreshness`).
 *
 * Γέννηση: η `UnitsPageContent` ήταν στις 494/500 γραμμές (N.7.1). Η καλωδίωση βγήκε ΟΛΟΚΛΗΡΗ εδώ —
 * εξαγωγή, όχι κλάδεμα.
 *
 * @module components/properties/page/usePropertyRetiredViews
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { usePropertiesTrashState } from '@/hooks/usePropertiesTrashState';
import { usePropertiesArchiveState } from '@/hooks/usePropertiesArchiveState';
import { useRealtimePropertiesTrashCount } from '@/services/realtime';
import { PropertyTrashActionsBar } from '@/components/properties/trash/PropertyTrashActionsBar';
import { PropertyArchiveActionsBar } from '@/components/properties/trash/PropertyArchiveActionsBar';
import { PropertyTrashDialogs } from '@/components/properties/trash/PropertyTrashDialogs';
import type { PropertyRetiredView } from '@/components/properties/page/PropertyPageBody';
import type { ListPageHeaderProps } from '@/core/headers';

interface UsePropertyRetiredViewsParams {
  selectedPropertyIds: string[];
  setSelectedProperties: (ids: string[]) => void;
  forceDataRefresh: () => void;
  /** Το ακίνητο του πάνελ λεπτομερειών — ο στόχος της μπάρας όταν δεν υπάρχει πολλαπλή επιλογή. */
  activePropertyId: string | null;
  /** Πλήθος ΕΝΕΡΓΩΝ ακινήτων — το σήμα για τον μετρητή του αρχείου. */
  activePropertyCount: number;
}

/** Ό,τι απλώνεται στην `PropertiesHeader` — υποσύνολο του κοινού contract, ποτέ δεύτερος τύπος. */
type RetiredViewHeaderProps = Pick<
  ListPageHeaderProps,
  'showTrash' | 'onToggleTrash' | 'trashCount' | 'showArchive' | 'onToggleArchive' | 'archiveCount'
>;

export interface PropertyRetiredViews {
  headerProps: RetiredViewHeaderProps;
  /** `null` ⇒ κανονική λίστα. */
  retiredView: PropertyRetiredView | null;
  actionsBar: ReactNode;
  dialogs: ReactNode;
}

/**
 * Κρατά τον μετρητή του αρχείου αληθινό **όσο το αρχείο είναι κλειστό**.
 *
 * Η αρχειοθέτηση γίνεται ΑΛΛΟΥ (ο διάλογος της μπλοκαρισμένης διαγραφής) και δεν εκπέμπει realtime
 * γεγονός — ενώ ο κάδος έχει δικό του ζωντανό μετρητή. Χωρίς αυτό, ο άνθρωπος αρχειοθετεί και το
 * σήμα στην κεφαλίδα μένει στο παλιό νούμερο μέχρι να ανοίξει το αρχείο.
 *
 * Το σήμα είναι η ζωντανή λίστα: τίποτα δεν μπαίνει στο αρχείο χωρίς να ΦΥΓΕΙ από αυτήν. Άρα «άλλαξε
 * το πλήθος των ενεργών» ⇒ ξαναρώτα. Κόστος: ένα GET ανά αλλαγή πλήθους. ⚠️ Η πρώτη τιμή αγνοείται —
 * την αρχική φόρτωση την κάνει ήδη η μηχανή. ⚠️ Με το αρχείο ΑΝΟΙΧΤΟ δεν ξαναρωτά: εκεί κάθε πράξη
 * ανανεώνει ήδη μόνη της, και δεύτερο fetch θα αναβόσβηνε την ένδειξη φόρτωσης πάνω στη λίστα.
 */
function useArchiveCountFreshness(
  activePropertyCount: number,
  archiveOpen: boolean,
  refetch: () => Promise<void>,
): void {
  const lastCount = useRef(activePropertyCount);
  useEffect(() => {
    if (lastCount.current === activePropertyCount) return;
    lastCount.current = activePropertyCount;
    if (!archiveOpen) void refetch();
  }, [activePropertyCount, archiveOpen, refetch]);
}

type TrashState = ReturnType<typeof usePropertiesTrashState>;
type ArchiveState = ReturnType<typeof usePropertiesArchiveState>;

/**
 * Αμοιβαίος αποκλεισμός: το toggle της ΑΛΛΗΣ προβολής, όταν είναι ανοιχτή, την κλείνει πρώτα.
 * Το κλείσιμο είναι σύγχρονο και χωρίς fetch (η μηχανή φορτώνει μόνο στο άνοιγμα), άρα οι δύο
 * αλλαγές κατάστασης φεύγουν στο ίδιο render — ποτέ ενδιάμεσο καρέ με τις δύο ανοιχτές.
 */
function useExclusiveToggles(trash: TrashState, archive: ArchiveState) {
  const { showTrash, handleToggleTrash } = trash;
  const { showArchive, handleToggleArchive } = archive;

  const onToggleTrash = useCallback(() => {
    if (showArchive) void handleToggleArchive();
    void handleToggleTrash();
  }, [showArchive, handleToggleArchive, handleToggleTrash]);

  const onToggleArchive = useCallback(() => {
    if (showTrash) void handleToggleTrash();
    void handleToggleArchive();
  }, [showTrash, handleToggleTrash, handleToggleArchive]);

  return { onToggleTrash, onToggleArchive };
}

export function usePropertyRetiredViews({
  selectedPropertyIds,
  setSelectedProperties,
  forceDataRefresh,
  activePropertyId,
  activePropertyCount,
}: UsePropertyRetiredViewsParams): PropertyRetiredViews {
  // 🗑️ Ο μετρητής του κάδου είναι ζωντανός (πάντα τρέχων, χωρίς κλικ)
  const { trashCount: realtimeTrashCount } = useRealtimePropertiesTrashCount();
  const clearSelection = useCallback(() => setSelectedProperties([]), [setSelectedProperties]);

  const trash = usePropertiesTrashState({ selectedPropertyIds, setSelectedProperties, forceDataRefresh });
  const archive = usePropertiesArchiveState({ forceDataRefresh, clearSelection });
  useArchiveCountFreshness(activePropertyCount, archive.showArchive, archive.fetchArchivedProperties);
  const { onToggleTrash, onToggleArchive } = useExclusiveToggles(trash, archive);

  return {
    headerProps: {
      showTrash: trash.showTrash,
      onToggleTrash,
      trashCount: realtimeTrashCount,
      showArchive: archive.showArchive,
      onToggleArchive,
      archiveCount: archive.archiveCount,
    },
    retiredView: selectRetiredView(trash, archive),
    actionsBar: (
      <RetiredViewActionsBar
        trash={trash}
        archive={archive}
        selectedIds={selectedPropertyIds}
        activePropertyId={activePropertyId}
      />
    ),
    dialogs: <RetiredViewDialogs trash={trash} />,
  };
}

/** Οι διάλογοι ζουν ΜΟΝΟ στον κάδο: το αρχείο δεν έχει οριστική διαγραφή, άρα ούτε επιβεβαίωση ούτε φραγή. */
function RetiredViewDialogs({ trash }: { trash: TrashState }) {
  return (
    <PropertyTrashDialogs
      showPermanentDeleteDialog={trash.showPermanentDeleteDialog}
      pendingPermanentDeleteIds={trash.pendingPermanentDeleteIds}
      isDeleting={trash.isDeleting}
      onConfirmPermanentDelete={trash.handleConfirmPermanentDelete}
      onCancelPermanentDelete={trash.handleCancelPermanentDelete}
      blockedDialog={trash.BlockedDialog}
    />
  );
}

/** Ποιες γραμμές δείχνει το σώμα. Ο κάδος προηγείται μόνο τυπικά — οι δύο δεν είναι ποτέ μαζί ανοιχτές. */
function selectRetiredView(trash: TrashState, archive: ArchiveState): PropertyRetiredView | null {
  if (trash.showTrash) return { loading: trash.loadingTrash, properties: trash.trashedProperties };
  if (archive.showArchive) return { loading: archive.loadingArchive, properties: archive.archivedProperties };
  return null;
}

interface RetiredViewActionsBarProps {
  trash: TrashState;
  archive: ArchiveState;
  selectedIds: string[];
  activePropertyId: string | null;
}

/** Η μπάρα της ανοιχτής προβολής — ή τίποτα, στην κανονική λίστα. */
function RetiredViewActionsBar({ trash, archive, selectedIds, activePropertyId }: RetiredViewActionsBarProps) {
  if (trash.showTrash) {
    return (
      <PropertyTrashActionsBar
        selectedIds={selectedIds}
        onBack={trash.handleToggleTrash}
        onRefresh={trash.handleTrashActionComplete}
        onPermanentDelete={trash.handlePermanentDeleteProperties}
        trashCount={trash.trashCount}
        activePropertyId={activePropertyId}
      />
    );
  }
  if (archive.showArchive) {
    return (
      <PropertyArchiveActionsBar
        selectedIds={selectedIds}
        onBack={archive.handleToggleArchive}
        onRefresh={archive.handleArchiveActionComplete}
        archiveCount={archive.archiveCount}
        activePropertyId={activePropertyId}
      />
    );
  }
  return null;
}
