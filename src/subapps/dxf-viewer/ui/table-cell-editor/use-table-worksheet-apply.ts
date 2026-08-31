'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **Η ΜΙΑ ΔΙΑΔΡΟΜΗ ΜΙΑΣ ΠΡΑΞΗΣ ΦΥΛΛΟΥ**: σχέδιο → μία εντολή → δρομέας σε
 * κελί που **υπάρχει**.
 *
 * Το αδελφό του {@link useTableAxisActionApply}, ένα επίπεδο πιο πάνω: εκείνο εφαρμόζει δομικές
 * πράξεις **μέσα** σε ένα φύλλο (γραμμές/στήλες), αυτό πράξεις **πάνω** στα φύλλα.
 *
 * ## Πέντε καταναλωτές, μία ακολουθία
 * το ⊕ της λωρίδας · το μενού δεξιού κλικ της καρτέλας (προσθήκη/διαγραφή/μετονομασία/
 * αναδιάταξη) · η in-place μετονομασία · η **προσθήκη** φύλλων από `.xlsx` · η
 * **αντικατάσταση** από `.xlsx`. Πέντε αντίγραφα της ίδιας πεντάδας γραμμών θα ήταν ο sibling
 * clone του N.18 — και, όπως πάντα, το ακριβό δεν είναι οι γραμμές: είναι ότι το πέμπτο
 * αντίγραφο θα ξεχνούσε τον **δρομέα**.
 *
 * ## 🔴 ΓΙΑΤΙ Ο ΔΡΟΜΕΑΣ ΔΕΝΕΤΑΙ ΣΤΗ **ΜΠΑΛΩΜΕΝΗ** ΟΝΤΟΤΗΤΑ
 * Το `setTableCellCursor` διαβάζει το **ενεργό φύλλο** για να γράψει το `worksheetId` του
 * δρομέα (ADR-833 Φ2 — «η μισή ταυτότητα δεν επιτρέπεται να ξεχαστεί»). Με τη `live`, ο δρομέας
 * θα γεννιόταν δεμένος στο φύλλο που μόλις **διαγράφηκε** — δηλαδή θα κρινόταν άκυρος από τον
 * ίδιο φύλακα που τον προστατεύει, και ο χρήστης θα έβλεπε πίνακα χωρίς δρομέα χωρίς να ξέρει
 * γιατί. Ίδια ακριβώς κίνηση —και ίδιος λόγος— με το `use-table-worksheet-tab-click`.
 *
 * ⚠️ Η σειρά «πρώτα τα δεδομένα, μετά ο δρομέας» **δεν** αφήνει παράθυρο ασυνέπειας: το
 * `setLevelScene` είναι κατάσταση React (ασύγχρονη), το `setTableCellCursor` external store
 * (σύγχρονο). Ένα ενδιάμεσο καρέ θα έβλεπε **παλιά** οντότητα με **νέο** δρομέα — και ο φύλακας
 * της Φάσης 2 τον κρίνει τότε άκυρο, δηλαδή δεν ζωγραφίζεται τίποτα σε λάθος φύλλο.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-worksheet-apply
 * @see bim/table/table-worksheet-ops.ts — ΤΙ πρέπει να γίνει (οι καθαροί σχεδιαστές)
 * @see bim/table/table-worksheet-command.ts — ΠΩΣ γίνεται εντολή (ένα undo)
 * @see ui/table-cell-editor/use-table-axis-action-apply.ts — το αδελφό, ένα επίπεδο πιο κάτω
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { buildTableWorksheetCommand } from '../../bim/table/table-worksheet-command';
import { newWorksheetModel, planWorksheetAdd } from '../../bim/table/table-worksheet-ops';
import { checkWorksheetsFitShare } from '../../bim/table/table-capacity';
import { resolveWorksheets } from '../../bim/table/table-worksheet-resolve';
import { setTableCellCursor } from '../../state/table-cell-cursor-store';
import { useTableCommandCommit, type UseTableModelCommitParams } from './use-table-model-commit';
import type { TableWorksheetPlan } from '../../bim/table/table-worksheet-ops';
import type { TableEntity } from '../../types/table-entity';

/** Εφαρμόζει ένα σχέδιο πράξης φύλλων· `false` όταν δεν έγινε τίποτα (`null` σχέδιο ή no-op). */
export type TableWorksheetApply = (
  live: TableEntity,
  plan: TableWorksheetPlan | null,
) => boolean;

/** Δες την κεφαλίδα: σχέδιο → ένα `UpdateEntityCommand` → δρομέας στο νέο ενεργό φύλλο. */
export function useTableWorksheetApply(params: UseTableModelCommitParams): TableWorksheetApply {
  const commit = useTableCommandCommit(params);

  return useCallback<TableWorksheetApply>(
    (live, plan) => {
      if (!plan) return false;
      if (!commit((sceneManager) => buildTableWorksheetCommand(live, plan, sceneManager))) return false;
      // Ο δρομέας μετακινείται **μόνο** όταν το σχέδιο το ζητά ρητά. `null`/απόν σημαίνει «μην
      // δημιουργήσεις δρομέα»: μια πράξη φύλλου δεν είναι είσοδος σε λειτουργία πίνακα.
      if (plan.restoreCursor) {
        setTableCellCursor(
          {
            ...live,
            worksheets: plan.worksheets,
            ...(plan.activeWorksheetId !== undefined && { activeWorksheetId: plan.activeWorksheetId }),
          },
          plan.restoreCursor,
          'nav',
        );
      }
      return true;
    },
    [commit],
  );
}

/** Πόσα MB είναι αυτά τα bytes, σε **ένα** δεκαδικό — η μονάδα με την οποία μιλά το όριο. */
function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * 🔴 ADR-833 Φ5Β — **Ο ΕΝΑΣ ΔΡΟΜΟΣ ΠΡΟΣΘΗΚΗΣ ΦΥΛΛΟΥ**: σχεδίασε, εφάρμοσε, και **πες το με
 * αριθμό** όταν ο πίνακας δεν χωρά άλλο.
 *
 * ## Γιατί δεν αρκεί το `useTableWorksheetApply`
 * Εκείνο εφαρμόζει ένα σχέδιο· δεν ξέρει **γιατί** ένα σχέδιο είναι `null`. Και από τη Φάση
 * 5Β το `null` της προσθήκης έχει καινούργια σημασία — «δεν χωρά» — που **οφείλει** να
 * φτάσει στον άνθρωπο: μια σιωπηλά αδρανής πράξη είναι η ίδια «σιωπηλή απώλεια» που το
 * §5.6.5 απαγόρευσε, απλώς με άλλο πρόσωπο. Το ⊕ που δεν κάνει τίποτα και δεν λέει τίποτα
 * είναι χειρότερο από άρνηση: ο χρήστης νομίζει ότι έσπασε η εφαρμογή.
 *
 * ## Γιατί ΕΔΩ και όχι στους δύο καλούντες
 * Οι πόρτες είναι **δύο** (το ⊕ της λωρίδας, το «Νέο φύλλο» του μενού) και είναι η **ίδια**
 * πράξη. Δύο αντίγραφα της τριάδας «σχέδιο → εφαρμογή → μήνυμα» θα ήταν ο sibling clone του
 * N.18, και το δεύτερο αντίγραφο θα ξεχνούσε το μήνυμα — ακριβώς όπως το πέμπτο αντίγραφο
 * θα ξεχνούσε τον δρομέα (δες την κεφαλίδα του module).
 *
 * ⚠️ Η μέτρηση για το **μήνυμα** γίνεται μόνο στον κλάδο της άρνησης: στη συνηθισμένη
 * περίπτωση δεν πληρώνεται κανένα `stringify` παραπάνω από αυτό που έκανε ήδη ο σχεδιαστής.
 */
export type TableWorksheetAdd = (live: TableEntity) => boolean;

export function useTableWorksheetAdd(params: UseTableModelCommitParams): TableWorksheetAdd {
  const apply = useTableWorksheetApply(params);
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();

  return useCallback<TableWorksheetAdd>(
    (live) => {
      const plan = planWorksheetAdd(live, newWorksheetModel(live));
      if (plan) return apply(live, plan);

      // Ο αριθμός δεν επινοείται εδώ: ρωτιέται η **ίδια** αρχή που αρνήθηκε.
      const verdict = checkWorksheetsFitShare(resolveWorksheets(live));
      notifications.warning(
        t('table.worksheetMenu.full', {
          usedMb: megabytes(verdict.bytes),
          limitMb: megabytes(verdict.limit),
        }),
        { duration: 6000 },
      );
      return false;
    },
    [apply, notifications, t],
  );
}
