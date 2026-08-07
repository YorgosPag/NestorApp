'use client';

/**
 * 🔴 ADR-769 Δ1 — **Η ΠΟΡΤΑ ΤΟΥ WRITE-BACK**: εδώ ο πίνακας ζητάει, και εδώ ο χρήστης ακούει «όχι».
 *
 * ## Καμία νέα μηχανή — μόνο μετάφραση
 * Κάθε γραμμή δείχνει σε κώδικα που υπάρχει και είναι ελεγμένος:
 *
 * ```
 *   τα δεδομένα   → readTableSourceContext        (binding/table-source-context)   ← η ΜΙΑ γέφυρα
 *   το αίτημα     → askTableWriteBack             (write-back/table-write-back-request)
 *   η κρίση       → planTableWriteBack            (write-back/table-write-back-plan) ← οι 6 φρουροί
 *   η εκτέλεση    → buildTableWriteBackCommand    (write-back/table-write-back-owner)
 *   ο ιδιοκτήτης  → MoveTopoSurveyPointCommand    (ADR-662 §13)                      ← ΑΝΕΓΓΙΧΤΟΣ
 * ```
 *
 * Ό,τι είναι όντως καινούριο είναι **η μετάφραση**: τι σημαίνει κάθε άρνηση για τον **άνθρωπο**.
 * Αυτή είναι μία `switch` και ζει εδώ, όπως ακριβώς το `freshnessOf` του ADR-767 Δ3.
 *
 * ## 🔴 Ζει σε δικό του module για τον ίδιο λόγο με τα άλλα πέντε
 * Το `useTableCellDoubleClickEditor` είναι στα **όρια των 500 γραμμών** (N.7.1). Ο διαχωρισμός
 * όμως δεν είναι μόνο μέγεθος: εκεί «ποιο κελί, πού, με τι όψη», εδώ «ποιος ιδιοκτήτης, τι του
 * ζητώ, τι απάντησε».
 *
 * ## ⛔ ΔΕΝ ανανεώνει τον πίνακα μετά τη γραφή
 * Ο πειρασμός είναι `refresh()` στο τέλος — και είναι **ακριβώς** το Δ3 του ADR-767 από την πίσω
 * πόρτα (ADR-769 Δ6). Ο ιδιοκτήτης εκτέλεσε· ο **έλεγχος** φρεσκάδας ξυπνά μόνος του από το
 * `subscribeTopo(check)` του `use-table-binding-actions`, δηλαδή ο πίνακας θα **δηλώσει** ότι
 * είναι μπαγιάτικος και ο άνθρωπος θα αποφασίσει. Αυτό είναι το «accept or reject» του
 * Navisworks, όχι παράλειψη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-write-back
 * @see ui/table-cell-editor/use-table-binding-actions.ts — η αδελφή πόρτα (Δ3, «Ανανέωση»)
 * @see docs/centralized-systems/reference/adrs/ADR-769-table-live-write-back.md §4, §7.2
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { readTableSourceContext } from '../../bim/table/binding/table-source-context';
import {
  askTableWriteBack,
  tableCellInputValue,
} from '../../bim/table/write-back/table-write-back-request';
import { buildTableWriteBackCommand } from '../../bim/table/write-back/table-write-back-owner';
import {
  TABLE_WRITE_BACK_OWNER_REFUSED_KEY,
  tableWriteBackMessageKey,
} from '../../bim/table/write-back/table-write-back-message';
import { useCommandHistory } from '../../core/commands';
import type { TableColumnId, TableRowId } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

/**
 * Χειρίστηκε αυτό το commit ο write-back;
 *
 * 🔴 `false` σημαίνει «**αυτό το κελί γράφεται στο μοντέλο**» — ο καλών συνεχίζει τον κανονικό
 * του δρόμο. Δεν σημαίνει «απέτυχε»: κάθε άρνηση **μιλάει** και επιστρέφει `true`, γιατί
 * αλλιώς η γραφή θα έπεφτε πίσω στο μοντέλο και ο χρήστης θα έβλεπε την τιμή του να «κολλάει»
 * στο κελί ενώ η οντότητα δεν κουνήθηκε — η χειρότερη δυνατή έκβαση (ψεύτικη επιτυχία).
 */
export type TableCellWriteBackAttempt = (
  entity: TableEntity,
  rowId: TableRowId,
  colId: TableColumnId,
  nextText: string,
) => boolean;

export function useTableCellWriteBack(levelManager: LevelManagerLike): TableCellWriteBackAttempt {
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();
  const { execute } = useCommandHistory();

  return useCallback(
    (entity, rowId, colId, nextText) => {
      const binding = entity.binding;
      if (!binding) return false;

      // Τα δεδομένα διαβάζονται **τη στιγμή του commit** — όχι από στιγμιότυπο απόδοσης, που
      // θα ήταν μπαγιάτικο ακριβώς τη στιγμή που ο CAS του Δ3 το χρειάζεται φρέσκο.
      const request = askTableWriteBack({
        model: entity.model,
        binding,
        context: readTableSourceContext(),
        rowId,
        colId,
        nextDisplayValue: tableCellInputValue(nextText),
      });
      if (request === null) return false;

      const { plan } = request;
      if (plan.status === 'unchanged') return true;
      if (plan.status === 'rejected') {
        notifications.warning(t(tableWriteBackMessageKey(plan.reason)), { duration: 6000 });
        return true;
      }

      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return true;
      const command = buildTableWriteBackCommand({
        sourceRef: binding.sourceRef,
        sourceRowIndex: request.sourceRowIndex,
        field: plan.field,
        storeValue: plan.storeValue,
        sceneManager: createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId),
      });
      // 🔴 Ο ιδιοκτήτης εγκρίθηκε αλλά **δεν μπόρεσε** — χωριστό μήνυμα από κάθε άρνηση του
      // κριτή: εκεί φταίει το αίτημα, εδώ ο κόσμος (λείπει το περίγραμμα, χάθηκε η κορυφή).
      if (command === null) notifications.warning(t(TABLE_WRITE_BACK_OWNER_REFUSED_KEY));
      else execute(command);
      return true;
    },
    [levelManager, execute, notifications, t],
  );
}
