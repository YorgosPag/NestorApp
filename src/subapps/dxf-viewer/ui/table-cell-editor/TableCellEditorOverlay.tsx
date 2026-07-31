'use client';

/**
 * ADR-739 Φάση Δ βήμα 2 — Table cell inline text editor overlay.
 *
 * Ο πλάτης καταναλωτής του κοινού `TextEditorAnchorLayer` (ADR-344 Φ-3D) για ΕΝΑ απλό
 * αλφαριθμητικό κελί πίνακα — καμία σχέση με το AST/TipTap του `TextEditorOverlay`: το
 * `TableCell.value` (ADR-739 Φ.Α) είναι απλό `string`, όχι εμπλουτισμένο κείμενο, οπότε
 * ένας πλήρης rich-text editor εδώ θα υποσχόταν μορφοποίηση που κανείς καταναλωτής της
 * διάταξης δεν διαβάζει (`table-model-helpers.ts` §`cellText`).
 *
 * Απλό controlled `<input>`, ίδιο σχήμα με το `OpeningInfoTagEditorOverlay` (ADR-612) —
 * χωρίς τον αριθμητικό περιορισμό εκείνου, αφού ένα κελί πίνακα δέχεται οποιοδήποτε
 * κείμενο.
 *
 *   Enter / blur → commit    Esc → cancel (escape-bus, MODAL_DIALOG — ADR-364)
 *
 * ΠΟΙΟ κελί ανοίγει + ΠΩΣ γίνεται commit ζει στο `useTableCellDoubleClickEditor`
 * (καθρέφτης του `useTextDoubleClickEditor`, ADR-344 Φ6.E) — αυτό το αρχείο είναι
 * καθαρά η όψη, prop-driven (όχι store-driven όπως το opening-info-tag).
 *
 * @see ui/table-cell-editor/useTableCellDoubleClickEditor.ts — ο ανοιχτήρας + commit brain
 * @see ui/text-toolbar/TextEditorAnchorLayer.tsx — το κοινό imperative-positioning κέλυφος
 * @see ui/opening-info-tag/OpeningInfoTagEditorOverlay.tsx — ο αδελφός που καθρεφτίζει
 */

import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useInlineEditorKeys } from '../inline-editor/use-inline-editor-keys';
import { TextEditorAnchorLayer, type TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import type { TableColumnId, TableRowId } from '../../types/table';

export interface TableCellEditorOverlayProps {
  readonly entityId: string;
  /** Μόνο για το `key` του καλούντος (αλλαγή κελιού πρέπει να ξαναφτιάξει το `<input>`). */
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly initialText: string;
  readonly anchor: TextEditorAnchor;
  readonly onCommit: (nextText: string) => void;
  readonly onCancel: () => void;
}

export function TableCellEditorOverlay(props: TableCellEditorOverlayProps): React.ReactElement {
  const { initialText, anchor, onCommit, onCancel } = props;
  const { t } = useTranslation('dxf-viewer');
  const [value, setValue] = useState(initialText);

  const handleCommit = useCallback(() => onCommit(value), [onCommit, value]);

  // Το πληκτρολόγιο (Enter δεσμεύει · ESC μέσω escape-bus) + ο φρουρός «μία φορά» ζουν στο
  // κοινό SSoT — ίδιος κώδικας με το OpeningInfoTagEditorOverlay, γραμμένος μία φορά (N.18).
  const { commit, onKeyDown } = useInlineEditorKeys({
    id: 'table-cell-editor/table-cell-editor-overlay',
    onCommit: handleCommit,
    onCancel,
  });

  return (
    <TextEditorAnchorLayer {...anchor}>
      <input
        type="text"
        autoFocus
        value={value}
        placeholder={t('table.cellEditor.editorPlaceholder')}
        aria-label={t('table.cellEditor.editorPlaceholder')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          'box-border rounded border border-primary bg-background px-2 text-foreground',
          'outline-none focus:ring-2 focus:ring-primary',
        )}
        style={{ width: anchor.size.width, height: anchor.size.height }}
      />
    </TextEditorAnchorLayer>
  );
}
