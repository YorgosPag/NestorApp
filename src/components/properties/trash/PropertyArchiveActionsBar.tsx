'use client';

/**
 * 🗄️ PropertyArchiveActionsBar
 *
 * Η μπάρα της προβολής «Αρχείο» των ακινήτων (ADR-329 §3.9): πίσω στη λίστα, επαναφορά από το αρχείο,
 * και η εξήγηση του τι είναι το αρχείο εκεί όπου ο κάδος δείχνει την προειδοποίηση των 30 ημερών.
 *
 * ⚠️ ΧΩΡΙΣ οριστική διαγραφή, και όχι από παράλειψη: το αρχείο κρατά ό,τι το αναφέρουν άλλες εγγραφές —
 * δεν εκκαθαρίζεται ποτέ. Γι' αυτό το `onPermanentDelete` δεν δίνεται καθόλου και το κουμπί δεν αποδίδεται.
 *
 * Διάταξη + ροή: η ΜΙΑ `shared/trash/EntityTrashActionsBar` — εδώ μόνο ο δρόμος επιστροφής και τα κείμενα.
 *
 * @module components/properties/trash/PropertyArchiveActionsBar
 */

import '@/lib/design-system';
import { EntityTrashActionsBar } from '@/components/shared/trash/EntityTrashActionsBar';
import { useTranslation } from '@/i18n';
import { unarchiveProperties } from '@/hooks/usePropertiesArchiveState';

interface PropertyArchiveActionsBarProps {
  selectedIds: string[];
  onBack: () => void;
  /** Μετά από κάθε επαναφορά (και αποτυχημένη): ανανέωση αρχείου + κανονικής λίστας, καθαρισμός επιλογής. */
  onRefresh: () => void;
  archiveCount: number;
  /** Ο στόχος όταν δεν υπάρχει πολλαπλή επιλογή. */
  activePropertyId?: string | null;
}

export function PropertyArchiveActionsBar({
  activePropertyId,
  archiveCount,
  ...bar
}: PropertyArchiveActionsBarProps) {
  const { t } = useTranslation('trash');
  return (
    <EntityTrashActionsBar
      {...bar}
      activeId={activePropertyId}
      trashCount={archiveCount}
      entity="properties-archive"
      restore={unarchiveProperties}
      noticeTone="info"
      text={{
        view: t('archiveView'),
        back: t('backToList'),
        count: t('archiveCount', { count: archiveCount }),
        warning: `${t('archiveExplainer')} ${t('listingStaysOffMarketNotice')}`,
        restore: t('unarchive'),
        // Ο διακομιστής λέει αν κάποιο γύρισε εκτός αγοράς — το μήνυμα το λέει ρητά.
        restoreSuccess: (count, outcomes) =>
          outcomes.includes('taken-off-market')
            ? t('unarchiveSuccessOffMarket', { count })
            : t('unarchiveSuccess', { count }),
        restoreFailed: t('unarchiveFailed'),
      }}
    />
  );
}
