'use client';

/**
 * ADR-750 Φ6 — **«Περισσότερα περιγράμματα…»**: το «Μορφοποίηση κελιών → Περίγραμμα» του Excel.
 *
 * ## 🔑 Το προσχέδιο ΕΙΝΑΙ ένα `PersistedTableModel` — και είναι δωρεάν
 * Ο διάλογος έχει «ΟΚ / Άκυρο», άρα τίποτα δεν αγγίζει το ζωντανό μοντέλο πριν το ΟΚ. Ο
 * πειρασμός είναι μια δεύτερη, «ελαφριά» αναπαράσταση («ποιες θέσεις άναψαν»), που θα ήταν
 * **δεύτερο μοντέλο περιγραμμάτων** και η μετάφρασή του το σημείο απόκλισης. Δεν χρειάζεται:
 * όλες οι πράξεις της μηχανής είναι καθαρές `model → model` **με εγγύηση by-reference**, οπότε
 * ένα τοπικό `useState<PersistedTableModel>` κάνει ακριβώς τη δουλειά — και το «Άκυρο» είναι
 * σκέτη απόρριψη μιας τοπικής μεταβλητής.
 *
 * ## ⚠️ ΤΟ ΜΟΛΥΒΙ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΔΙΑΛΟΓΟΥ, ΟΧΙ ΙΔΙΟΤΗΤΑ ΤΩΝ ΑΚΜΩΝ
 * Αλλαγή στυλ ή χρώματος **δεν** πειράζει ό,τι έχει ήδη τοποθετηθεί: αφορά τις **επόμενες**
 * θέσεις που θα πατηθούν. Γι' αυτό το `pencil` υπολογίζεται τη στιγμή της πράξης και δεν
 * υπάρχει πουθενά εδώ «ξαναβάψε τα πάντα». Το αντίθετο μοντέλο είναι εύκολο να γραφτεί κατά
 * λάθος και αδύνατο να ξεγραφτεί: ο χρήστης που βάζει λεπτές εσωτερικές και μετά διαλέγει παχύ
 * για το εξωτερικό θα έχανε σιωπηλά τις εσωτερικές του.
 *
 * ## Ένα commit, ένα `Ctrl+Z`
 * Το ΟΚ παραδίδει **ένα** μοντέλο στον {@link onCommit}, που περνά από το `useLiveTableMutation`
 * — την ίδια διαδρομή με κάθε άλλη αλλαγή πίνακα (ADR-739 §6.6). Είκοσι κλικ μέσα στον διάλογο
 * = ένα βήμα αναίρεσης. Και αν το προσχέδιο γύρισε **ίδιο** by-reference, δεν γεννιέται καν
 * εντολή: «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» δεν αφήνει ίχνος.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/TableBorderDialog
 * @see bim/table/table-border-dialog-draft.ts — οι μεταλλάξεις
 * @see bim/table/table-border-dialog-positions.ts — οι αναγνώσεις
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §9.2
 */

import React, { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { resolveLinetypePatternMm } from '../../../../rendering/linetype-dash-resolver';
import {
  tableBorderStylePencil,
  tableBorderStylePreset,
  type TableBorderStyleId,
} from '../../../../bim/table/table-border-style-catalog';
import {
  applyTableBorderDialogPreset,
  toggleTableBorderDialogPosition,
  type TableBorderDialogPresetId,
} from '../../../../bim/table/table-border-dialog-draft';
import {
  tableBorderDialogSnapshot,
  type TableBorderDialogPositionId,
} from '../../../../bim/table/table-border-dialog-positions';
import type { TableCellRangeBounds } from '../../../../bim/table/table-cell-range';
import type { TableStyle } from '../../../../bim/table/table-style';
import type { PersistedTableModel } from '../../../../types/table';
import { TABLE_BORDER_DIALOG_KEY } from './table-border-dialog-labels';
import { TableBorderDialogTabs } from './TableBorderDialogTabs';
import { TableBorderStyleListbox } from './TableBorderStyleListbox';
import { TableBorderDialogColor } from './TableBorderDialogColor';
import { TableBorderDialogPresets } from './TableBorderDialogPresets';
import { TableBorderProxyWidget } from './TableBorderProxyWidget';
import styles from './TableBorderDialog.module.css';

/**
 * Η θέση του listbox που είναι επιλεγμένη στο **άνοιγμα**.
 *
 * `'none'` επειδή αυτό δείχνει το μετρημένο στιγμιότυπο ελληνικού Excel (2026-08-04) — όχι
 * επειδή είναι η βολική προεπιλογή. Ονομασμένη σταθερά ακριβώς για να αλλάζει με **μία**
 * γραμμή αν ο ιδιοκτήτης αποφασίσει αλλιώς αφού το δει στην οθόνη.
 */
export const INITIAL_TABLE_BORDER_STYLE_ID: TableBorderStyleId = 'none';

/** Ό,τι χρειάζεται ο διάλογος για να δουλέψει — **παγωμένο στο άνοιγμα**, από τον καλούντα. */
export interface TableBorderDialogTarget {
  readonly bounds: TableCellRangeBounds;
  /** Το ζωντανό μοντέλο τη στιγμή του ανοίγματος — η **αφετηρία** του προσχεδίου. */
  readonly model: PersistedTableModel;
  /** Το ενεργό στυλ του πίνακα — η κληρονομιά κάθε πεδίου που ο χρήστης δεν άγγιξε (Α20). */
  readonly style: TableStyle;
}

export interface TableBorderDialogProps extends TableBorderDialogTarget {
  /** Το ΟΚ: **ένα** μοντέλο, **ένα** commit. */
  readonly onCommit: (model: PersistedTableModel) => void;
  /** Άκυρο / Escape / `✕` — και τα τρία σημαίνουν το ίδιο: πέτα το προσχέδιο. */
  readonly onClose: () => void;
}

export function TableBorderDialog({
  bounds, model, style, onCommit, onClose,
}: TableBorderDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const panelId = useId();
  const hintId = useId();

  const [draft, setDraft] = useState<PersistedTableModel>(model);
  const [styleId, setStyleId] = useState<TableBorderStyleId>(INITIAL_TABLE_BORDER_STYLE_ID);
  const [colorHex, setColorHex] = useState<string | undefined>(undefined);

  /**
   * Το μολύβι **που θα εφαρμοστεί στο επόμενο κλικ**.
   *
   * Περνά από την ίδια `tableBorderStylePencil` που θα εκτελέσει η πράξη — και το `dashMm`
   * λύνεται εδώ επειδή η μηχανή είναι επίτηδες ντετερμινιστική (η μετάφραση ονόματος → μοτίβο
   * θέλει το `LinetypeRegistry`, δηλαδή κατάσταση).
   */
  const pencil = useMemo(() => {
    const pen = tableBorderStylePreset(styleId)?.pen;
    const dashMm = pen ? resolveLinetypePatternMm(pen.linetypeName) : [];
    return tableBorderStylePencil(styleId, style, dashMm, colorHex);
  }, [styleId, style, colorHex]);

  const snapshot = useMemo(() => tableBorderDialogSnapshot(draft, bounds), [draft, bounds]);

  const toggle = useCallback(
    (id: TableBorderDialogPositionId) => {
      setDraft((current) => toggleTableBorderDialogPosition(current, bounds, id, pencil));
    },
    [bounds, pencil],
  );

  const applyPreset = useCallback(
    (preset: TableBorderDialogPresetId) => {
      setDraft((current) => applyTableBorderDialogPreset(current, bounds, preset, pencil));
    },
    [bounds, pencil],
  );

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${TABLE_BORDER_DIALOG_KEY}.title`)}</DialogTitle>
        </DialogHeader>

        <TableBorderDialogTabs panelId={panelId} hintId={hintId} />

        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-border`}
          className={styles.layout}
        >
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
              {t(`${TABLE_BORDER_DIALOG_KEY}.line.section`)}
            </legend>
            <span className={styles.fieldLabel}>{t(`${TABLE_BORDER_DIALOG_KEY}.line.style`)}</span>
            <TableBorderStyleListbox
              selected={styleId}
              onSelect={setStyleId}
              colorHex={colorHex}
              label={t(`${TABLE_BORDER_DIALOG_KEY}.line.style`)}
            />
            <TableBorderDialogColor
              selected={colorHex}
              onSelect={setColorHex}
              resolvedHex={pencil.colorHex}
            />
          </fieldset>

          <div className={styles.section}>
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                {t(`${TABLE_BORDER_DIALOG_KEY}.presets.section`)}
              </legend>
              <TableBorderDialogPresets bounds={bounds} onApply={applyPreset} />
            </fieldset>

            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                {t(`${TABLE_BORDER_DIALOG_KEY}.border.section`)}
              </legend>
              <TableBorderProxyWidget snapshot={snapshot} onToggle={toggle} />
            </fieldset>
          </div>
        </section>

        {/*
          Το κείμενο βοήθειας **είναι** η περιγραφή του διαλόγου: δηλώνει τη ροή («πρώτα στυλ,
          μετά πού»). Ως `DialogDescription` το διαβάζει ο αναγνώστη οθόνης στο άνοιγμα — και ο
          Radix σταματά να προειδοποιεί για διάλογο χωρίς περιγραφή.
        */}
        <DialogDescription className={styles.help}>
          {t(`${TABLE_BORDER_DIALOG_KEY}.helpText`)}
        </DialogDescription>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t(`${TABLE_BORDER_DIALOG_KEY}.cancel`)}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onCommit(draft);
              onClose();
            }}
          >
            {t(`${TABLE_BORDER_DIALOG_KEY}.ok`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
