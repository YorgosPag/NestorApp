'use client';

/**
 * 🔴 ADR-739 §57 — **Ο ΕΝΑΣ ΕΦΑΡΜΟΣΤΗΣ ΤΗΣ ΕΠΙΚΟΛΛΗΣΗΣ**: παίρνει την απόφαση του
 * {@link resolveTablePasteSource} και την εκτελεί — ή εξηγεί γιατί δεν εκτελείται.
 *
 * ## Γιατί υπάρχει
 * Οι τρεις διαδρομές επικόλλησης (`Ctrl+V` · δεξί κλικ · κουμπί κορδέλας) έχουν **διαφορετικό
 * τρόπο να μάθουν τι λέει το πρόχειρο** — συμβάν, `navigator.clipboard`, ή και τα δύο — αλλά
 * **ίδια** συνέχεια: γράψε το μοντέλο, κάνε ένα βήμα undo, πες τι έγινε. Τρία αντίγραφα αυτής
 * της συνέχειας θα ήταν sibling clone (CHECK 3.28 / N.18)· το σοβαρό όμως δεν είναι οι γραμμές,
 * είναι ότι **δύο από τα τρία θα ξεχνούσαν κάποτε το `external` σημάδι** και θα έλεγαν στον
 * χρήστη ότι χάθηκε μια μορφοποίηση που δεν χάθηκε (δες `use-table-paste-report.ts`).
 *
 * ## Οι πέντε καταστάσεις απαντιούνται ΟΛΕΣ — καμία σιωπή
 * Τρεις εφαρμόζουν, δύο εξηγούν. Δεν υπάρχει κλάδος «τίποτα δεν έγινε και δεν το είπα»: είναι
 * ακριβώς το «πάτησα Επικόλληση και δεν έγινε τίποτα» που η κεφαλίδα του §54 ονομάζει *«η
 * χειρότερη δυνατή έκβαση για εντολή δεδομένων»*.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-paste-apply
 * @see bim/table/table-clipboard-resolve.ts — ποιος αποφασίζει
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { resolveTableStyle } from '../../bim/table/table-entity-geometry';
import { pasteTableClipboard, type TablePasteRequest } from '../../bim/table/table-clipboard-paste';
import { pasteTsvIntoTable } from '../../bim/table/table-range-clipboard';
import { useTableModelCommit } from './use-table-model-commit';
import { useTablePasteReport } from './use-table-paste-report';
import type { TablePasteSource } from '../../bim/table/table-clipboard-resolve';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTablePasteApplyParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

/** Εφαρμόζει μια επιλυμένη πηγή επικόλλησης πάνω στον ζωντανό πίνακα. */
export type TablePasteApply = (
  live: TableEntity,
  anchor: TableCellRef,
  source: TablePasteSource,
  request: TablePasteRequest,
) => void;

/**
 * Οι δύο καταστάσεις που **δεν** εφαρμόζουν τίποτα, με το μήνυμά τους.
 *
 * Χάρτης και όχι αλυσίδα `if`: την ημέρα που ο επιλυτής αποκτήσει έκτη κατάσταση, **αυτό το
 * αντικείμενο δεν μεταγλωττίζεται** μέχρι κάποιος να απαντήσει «τι λέμε στον χρήστη;» — ενώ ένα
 * `if` θα την προσπερνούσε σιωπηλά και η εντολή θα ήταν πάλι «πάτησα και δεν έγινε τίποτα».
 */
const NOTHING_APPLIED: Readonly<
  Record<Exclude<TablePasteSource['kind'], 'internal' | 'external'>, {
    readonly key: string;
    readonly level: 'info' | 'warning';
  }>
> = {
  denied: { key: 'table.clipboard.readDenied', level: 'warning' },
  empty: { key: 'table.clipboard.pasteEmpty', level: 'info' },
  'needs-internal': { key: 'table.clipboard.needsInternal', level: 'warning' },
};

export function useTablePasteApply(params: UseTablePasteApplyParams): TablePasteApply {
  const { levelManager, execute } = params;
  const { t } = useTranslation('dxf-viewer');
  const notifications = useNotifications();
  const commitModel = useTableModelCommit({ levelManager, execute });
  const reportPaste = useTablePasteReport();

  return useCallback(
    (live, anchor, source, request) => {
      if (source.kind !== 'internal' && source.kind !== 'external') {
        const message = NOTHING_APPLIED[source.kind];
        notifications[message.level](t(message.key));
        return;
      }

      // §57 — η «τυφλή» επικόλληση λέγεται **πριν** εφαρμοστεί: ο χρήστης μαθαίνει ότι
      // επικολλήθηκε το τελευταίο αντίγραφο **του ΝΕΣΤΩΡ** και όχι ό,τι κι αν κρατά τώρα το
      // λειτουργικό, που δεν μπορέσαμε να διαβάσουμε.
      if (source.kind === 'internal' && source.blind) {
        notifications.info(t('table.clipboard.internalFallback'));
      }

      const result = source.kind === 'internal'
        ? pasteTableClipboard(live.model, resolveTableStyle(live), source.payload, anchor, request)
        : pasteTsvIntoTable(live.model, anchor, source.grid);

      commitModel(live, result.model);
      reportPaste(result, source.kind === 'external');
    },
    [commitModel, reportPaste, notifications, t],
  );
}
