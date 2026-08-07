'use client';

/**
 * ADR-739 §4.3/§4.5 — **ΤΙ ΕΜΑΘΕ Ο ΧΡΗΣΤΗΣ ΜΕΤΑ ΤΗΝ ΕΠΙΚΟΛΛΗΣΗ**: ποτέ σιωπηλή απώλεια.
 *
 * ## Γιατί βγήκε από το `use-table-range-actions`
 * Ζούσε εκεί ως ιδιωτικό `useCallback` όσο η επικόλληση είχε **έναν** δρόμο (το συμβάν `paste`
 * του `<textarea>` της συνεδρίας). Το ADR-739 §54 πρόσθεσε δεύτερο — «Επικόλληση» από το μενού
 * δεξιού κλικ, μέσω async Clipboard API — και τα δύο οφείλουν να λένε **τα ίδια**: τριάντα
 * γραμμές μηνυμάτων αντιγραμμένες θα ήταν sibling clone (CHECK 3.28 / N.18), αλλά το σοβαρό
 * είναι άλλο — η μία διαδρομή θα μάθαινε κάποτε να αναφέρει μια νέα απώλεια και η άλλη όχι,
 * δηλαδή «το ποντίκι σου έκρυψε αυτό που σου είπε το πληκτρολόγιο».
 *
 * ## Δύο διαφορετικά πράγματα, δύο διαφορετικά μηνύματα
 *  - **τι δεν χώρεσε** (προειδοποίηση, ανά πράξη) — αφορά *αυτά* τα δεδομένα·
 *  - **τι δεν μεταφέρεται ποτέ** (ενημέρωση, μία φορά) — αφορά τον κανόνα του συστήματος.
 *
 * ## 🔴 ADR-739 §57 — ΤΟ ΔΕΥΤΕΡΟ ΜΗΝΥΜΑ ΕΓΙΝΕ **ΨΕΥΔΕΣ** ΚΑΙ ΧΡΕΙΑΣΤΗΚΕ ΦΥΛΑΚΑΣ
 * Το `pastePlainText` λέει κατά λέξη «*η μορφοποίηση δεν μεταφέρεται*». Ίσχυε απόλυτα όσο η
 * **μόνη** πηγή επικόλλησης ήταν TSV. Με το εσωτερικό πρόχειρο (§57) η επικόλληση **μέσα στον
 * ΝΕΣΤΩΡ** μεταφέρει τύπους, χρώματα, περιγράμματα και μορφή αριθμού — δηλαδή το μήνυμα θα
 * διέψευδε ό,τι μόλις είδε ο χρήστης στην οθόνη του.
 *
 * Γι' αυτό ο καλών **οφείλει** να δηλώσει από πού ήρθαν τα δεδομένα. Παράμετρος και όχι
 * προαιρετική σημαία με προεπιλογή: η προεπιλογή θα ήταν σιωπηλά λάθος για όποια νέα διαδρομή
 * ξεχνούσε να την περάσει, και το σύμπτωμα («μου λέει ότι χάθηκε η μορφή ενώ δεν χάθηκε») δεν
 * δείχνει ποτέ προς την αιτία.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-paste-report
 * @see bim/table/table-range-clipboard.ts — ποιος παράγει τα νούμερα
 * @see bim/table/table-clipboard-resolve.ts — ποιος αποφασίζει αν είναι εξωτερική
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { TablePasteResult } from '../../bim/table/table-range-clipboard';

/**
 * Η προειδοποίηση «απλό κείμενο» λέγεται **μία φορά ανά φόρτωση σελίδας** (§4.5).
 *
 * Ένα toast σε **κάθε** επικόλληση θα ήταν θόρυβος που ο χρήστης μαθαίνει να αγνοεί — και
 * τότε θα έχανε και τα μηνύματα που **μετράνε** (τι δεν χώρεσε). Μία φορά είναι αρκετή για
 * να μάθει τον κανόνα· είναι πληροφορία για το **σύστημα**, όχι για τη συγκεκριμένη πράξη.
 *
 * Σε επίπεδο module και όχι στο store: δεν είναι κατάσταση του πίνακα, δεν σειριοποιείται,
 * δεν αναιρείται. Και **ένα** module για **δύο** διαδρομές επικόλλησης: αλλιώς ο χρήστης θα
 * το άκουγε μία φορά για το `Ctrl+V` και άλλη μία για το μενού.
 */
let plainTextNoticeShown = false;

/** Test helper — μηδενισμός του «μία φορά» μεταξύ tests. */
export function __resetTablePlainTextNoticeForTests(): void {
  plainTextNoticeShown = false;
}

export function useTablePasteReport(): (result: TablePasteResult, external: boolean) => void {
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();

  return useCallback(
    (result: TablePasteResult, external: boolean) => {
      const parts: string[] = [];
      if (result.fittedRows < result.offeredRows) {
        parts.push(
          t('table.clipboard.pasteClippedRows', {
            fitted: result.fittedRows,
            offered: result.offeredRows,
          }),
        );
      }
      if (result.fittedColumns < result.offeredColumns) {
        parts.push(
          t('table.clipboard.pasteClippedColumns', {
            fitted: result.fittedColumns,
            offered: result.offeredColumns,
          }),
        );
      }
      if (result.skippedMergedCells > 0) {
        parts.push(t('table.clipboard.pasteMergedSkipped', { count: result.skippedMergedCells }));
      }
      if (parts.length > 0) {
        notifications.warning(t('table.clipboard.pasteClipped', { detail: parts.join(' · ') }), {
          duration: 6000,
        });
      }
      // §57 — **μόνο** για δεδομένα του έξω κόσμου. Δες την κεφαλίδα: μέσα στον ΝΕΣΤΩΡ η
      // μορφοποίηση **μεταφέρεται**, οπότε εδώ το μήνυμα θα ήταν διάψευση της ίδιας της οθόνης.
      if (external && !plainTextNoticeShown) {
        plainTextNoticeShown = true;
        notifications.info(t('table.clipboard.pastePlainText'), { duration: 8000 });
      }
    },
    [notifications, t],
  );
}
