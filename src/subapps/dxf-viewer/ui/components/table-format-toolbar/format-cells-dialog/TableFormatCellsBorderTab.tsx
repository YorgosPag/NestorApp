'use client';

/**
 * 🔴 ADR-750 Φ6 — **η καρτέλα «Περίγραμμα»** του «Μορφοποίηση κελιών»: γραμμή, υποδείγματα, και
 * το proxy preview των οκτώ θέσεων.
 *
 * ## Γιατί εξήχθη από το κέλυφος (§60)
 * Μέχρι το §60 το κέλυφος **ήταν** αυτή η καρτέλα: ένα αρχείο, μία ζωντανή καρτέλα, καμία
 * διάκριση. Με τρεις ζωντανές, το κέλυφος οφείλει να ξέρει **μόνο** «ποια καρτέλα, ποιο
 * προσχέδιο, πότε δεσμεύω» — και η γνώση «τι σημαίνει μολύβι» δεν έχει καμία δουλειά εκεί.
 * **Εξαγωγή, ποτέ trim** (N.0.2): καμία γραμμή δεν χάθηκε, ούτε τεκμηρίωση.
 *
 * ## ⚠️ ΤΟ ΜΟΛΥΒΙ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΚΑΡΤΕΛΑΣ, ΟΧΙ ΙΔΙΟΤΗΤΑ ΤΩΝ ΑΚΜΩΝ
 * Αλλαγή στυλ ή χρώματος **δεν** πειράζει ό,τι έχει ήδη τοποθετηθεί: αφορά τις **επόμενες**
 * θέσεις που θα πατηθούν. Γι' αυτό το `pencil` υπολογίζεται τη στιγμή της πράξης και δεν
 * υπάρχει πουθενά εδώ «ξαναβάψε τα πάντα». Το αντίθετο μοντέλο είναι εύκολο να γραφτεί κατά
 * λάθος και αδύνατο να ξεγραφτεί: ο χρήστης που βάζει λεπτές εσωτερικές και μετά διαλέγει παχύ
 * για το εξωτερικό θα έχανε σιωπηλά τις εσωτερικές του.
 *
 * ⚠️ Το μολύβι **δεν επιβιώνει** εναλλαγής καρτέλας, και είναι σωστό: είναι εργαλείο *αυτής*
 * της καρτέλας, όπως το μολύβι του Excel δεν θυμάται τι διάλεξες πριν κλείσεις τον διάλογο.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsBorderTab
 * @see bim/table/table-border-dialog-draft.ts — οι μεταλλάξεις
 * @see bim/table/table-border-dialog-positions.ts — οι αναγνώσεις
 */

import React, { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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
import { TABLE_BORDER_DIALOG_KEY } from './table-format-cells-labels';
import { TableBorderStyleListbox } from './TableBorderStyleListbox';
import { TableBorderDialogColor } from './TableBorderDialogColor';
import { TableBorderDialogPresets } from './TableBorderDialogPresets';
import { TableBorderProxyWidget } from './TableBorderProxyWidget';
import styles from './TableFormatCellsDialog.module.css';

/**
 * Η θέση του listbox που είναι επιλεγμένη στο **άνοιγμα**.
 *
 * `'none'` επειδή αυτό δείχνει το μετρημένο στιγμιότυπο ελληνικού Excel (2026-08-04) — όχι
 * επειδή είναι η βολική προεπιλογή. Ονομασμένη σταθερά ακριβώς για να αλλάζει με **μία**
 * γραμμή αν ο ιδιοκτήτης αποφασίσει αλλιώς αφού το δει στην οθόνη.
 */
const INITIAL_TABLE_BORDER_STYLE_ID: TableBorderStyleId = 'none';

export interface TableFormatCellsBorderTabProps {
  readonly bounds: TableCellRangeBounds;
  /** Το **προσχέδιο** — η καρτέλα διαβάζει και γράφει σε αυτό, ποτέ στο ζωντανό μοντέλο. */
  readonly draft: PersistedTableModel;
  /** Το ενεργό στυλ του πίνακα — η κληρονομιά κάθε πεδίου που ο χρήστης δεν άγγιξε (Α20). */
  readonly style: TableStyle;
  readonly onDraft: (next: (current: PersistedTableModel) => PersistedTableModel) => void;
}

export function TableFormatCellsBorderTab(
  props: TableFormatCellsBorderTabProps,
): React.ReactElement {
  const { bounds, draft, style, onDraft } = props;
  const { t } = useTranslation('dxf-viewer');
  const helpId = useId();

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
      onDraft((current) => toggleTableBorderDialogPosition(current, bounds, id, pencil));
    },
    [bounds, pencil, onDraft],
  );

  const applyPreset = useCallback(
    (preset: TableBorderDialogPresetId) => {
      onDraft((current) => applyTableBorderDialogPreset(current, bounds, preset, pencil));
    },
    [bounds, pencil, onDraft],
  );

  return (
    <>
      <div className={styles.layout}>
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

          {/*
            🔴 Το `aria-describedby` κάθεται **εδώ** και όχι στη ρίζα του διαλόγου, όπου ήταν
            μέχρι το §60: η οδηγία («πρώτα στυλ, μετά πού») περιγράφει **αυτό** το χειριστήριο.
            Στη ρίζα, ο αναγνώστης οθόνης θα την άκουγε και ανοίγοντας την καρτέλα «Αριθμός» —
            δηλαδή θα έλεγε ψέματα στα δύο τρίτα των περιπτώσεων. Ένα `<fieldset>` είναι
            πραγματική ομάδα και **ανακοινώνει** την περιγραφή του· ένα `<div>` όχι.
          */}
          <fieldset className={styles.section} aria-describedby={helpId}>
            <legend className={styles.sectionTitle}>
              {t(`${TABLE_BORDER_DIALOG_KEY}.border.section`)}
            </legend>
            <TableBorderProxyWidget snapshot={snapshot} onToggle={toggle} />
          </fieldset>
        </div>
      </div>

      <p id={helpId} className={styles.help}>
        {t(`${TABLE_BORDER_DIALOG_KEY}.helpText`)}
      </p>
    </>
  );
}
