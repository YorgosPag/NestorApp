'use client';

/**
 * 🔴 ADR-739 §60 — **η καρτέλα «Στοίχιση»**: οι δύο άξονες θέσης, η **εσοχή**, η **ελεύθερη
 * γωνία** και το ξεχείλισμα.
 *
 * ## Γιατί υπάρχει, ενώ η κορδέλα έχει ήδη έξι κουμπιά στοίχισης
 * Επειδή δύο χειριστήρια **δεν χωρούν σε κουμπί** και το §59 τα άφησε ρητά εδώ:
 * ```
 *   ΕΛΕΥΘΕΡΗ ΓΩΝΙΑ  το μοντέλο δέχεται κάθε τιμή στο −90..+90 και η διάταξη την τιμά πλήρως·
 *                   η κορδέλα δίνει **δύο** preset, γιατί ένα κουμπί δεν παίρνει αριθμό
 *   ΕΣΟΧΗ           η κορδέλα δίνει ± ένα σκαλί· «πήγαινε στο 7» είναι επτά κλικ
 * ```
 * Είναι **ακριβώς** η διαίρεση του Excel: προεπιλογές στην κορδέλα, τιμές στον διάλογο.
 *
 * ## 🔴 ΤΙ ΔΕΝ ΕΙΝΑΙ ΕΔΩ, ΔΗΛΩΜΕΝΟ
 * · **«Συγχώνευση κελιών»** — το Excel το έχει σε αυτή την καρτέλα· εδώ **δεν** μπαίνει, και ο
 *   λόγος είναι το προσχέδιο: η συγχώνευση είναι δομική πράξη που **ρωτά τον χρήστη** όταν
 *   πετάει περιεχόμενο (ADR-755), δηλαδή δεν είναι εκφράσιμη ως καθαρή μετάλλαξη που δεσμεύεται
 *   με ένα «ΟΚ». Ζει ένα κλικ μακριά, στην **ίδια** ομάδα «Στοίχιση» της κορδέλας.
 * · **«Γέμισμα» / «Στοίχιση στο κέντρο της επιλογής» / «Πλήρης στοίχιση»** — δεν υπάρχουν στο
 *   `TableCellAlign` (τρεις θέσεις ανά άξονα, group code 170 του `ACAD_TABLE`). Δηλωμένο κενό:
 *   μια τέταρτη τιμή θα ήταν αλλαγή **μορφής αρχείου**, όχι επιφάνειας.
 * · **«Κατακόρυφο στοιβαγμένο»** (`textRotation = 255` του OOXML) — **άλλη διάταξη glyph**, όχι
 *   στροφή· δηλωμένο εκτός εμβέλειας από το §59.4.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsAlignTab
 * @see bim/table/table-align-ops.ts · table-indent-ops.ts · table-rotation-ops.ts — οι SSoT
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  resolveTableFormatState,
  setTableFormatField,
} from '../../../../bim/table/table-format-scope';
import { setTableFormatOverflow } from '../../../../bim/table/table-format-overflow-scope';
import { resolveTableStyleFieldOrigin } from '../../../../bim/table/table-format-origin';
import {
  nextTableAlign,
  tableAlignHorizontal,
  tableAlignVertical,
  type TableHorizontalAlign,
  type TableVerticalAlign,
} from '../../../../bim/table/table-align-ops';
import {
  MAX_TABLE_INDENT_LEVEL,
  clampTableIndentLevel,
} from '../../../../bim/table/table-indent-ops';
import {
  resolveTableAlignState,
  resolveTableOverflowState,
} from '../../../table-cell-editor/table-format-snapshot';
import type { FormatTarget } from '../../../table-cell-editor/table-format-snapshot';
import type { PersistedTableModel, TableCellAlign } from '../../../../types/table';
import {
  TABLE_FORMAT_CELLS_KEY,
  TABLE_HORIZONTAL_ALIGN_KEY,
  TABLE_VERTICAL_ALIGN_KEY,
} from './table-format-cells-labels';
import { TableFormatOriginNote } from './TableFormatOriginNote';
import { TableFormatCellsCheck, TableFormatCellsSelect } from './TableFormatCellsFields';
import { TableTextOrientationDial } from './TableTextOrientationDial';
import styles from './TableFormatCellsDialog.module.css';

const HORIZONTAL_CODES = Object.keys(TABLE_HORIZONTAL_ALIGN_KEY) as readonly TableHorizontalAlign[];
const VERTICAL_CODES = Object.keys(TABLE_VERTICAL_ALIGN_KEY) as readonly TableVerticalAlign[];

/**
 * Τα σκαλιά εσοχής ως επιλογές — **σκαλιά, όχι χιλιοστά**.
 *
 * Η μονάδα είναι του Excel, αυτολεξεί από το ECMA-376 §18.8.1 (*«an increment of 1 represents 3
 * spaces»*) και το χειριστήριο τη σέβεται: ακέραια σκαλιά μέχρι το φράγμα του SSoT. Ένα πεδίο σε
 * mm θα ήταν **δεύτερη τυπογραφική αυθεντία** δίπλα στον μετρητή που αποφασίζει τα πλάτη
 * στηλών (§59.3).
 */
const INDENT_OPTIONS = Array.from(
  { length: MAX_TABLE_INDENT_LEVEL + 1 },
  (_unused, level) => ({ value: String(level), label: String(level) }),
);

export interface TableFormatCellsAlignTabProps {
  readonly target: FormatTarget;
  readonly onDraft: (next: (current: PersistedTableModel) => PersistedTableModel) => void;
}

export function TableFormatCellsAlignTab(
  props: TableFormatCellsAlignTabProps,
): React.ReactElement {
  const { target, onDraft } = props;
  const { t } = useTranslation('dxf-viewer');
  const { model, style, scope } = target;

  const align = resolveTableAlignState(target);
  const indent = resolveTableFormatState(model, style, scope, 'indentLevel');
  const rotation = resolveTableFormatState(model, style, scope, 'textRotationDeg');
  const overflow = resolveTableOverflowState(target);

  const alignState = resolveTableFormatState(model, style, scope, 'align');
  const mixedLabel = t(`${TABLE_FORMAT_CELLS_KEY}.mixed`);

  /**
   * Οι **τρεις** γραφείς πεδίου — χωριστοί επίτηδες, ένας ανά τύπο τιμής.
   *
   * Ένας γενικός `write(key, value)` θα χρειαζόταν `as never` στην κλήση του
   * {@link setTableFormatField}: εκείνο είναι γενικό ως προς το **κλειδί**, οπότε η τιμή στενεύει
   * σε τομή τύπων που καμία συγκεκριμένη τιμή δεν ικανοποιεί. Ένα cast εκεί θα έσβηνε ακριβώς
   * τον έλεγχο που κάνει αδύνατο να γραφτεί γωνία στο πεδίο της εσοχής (N.2).
   *
   * ⚠️ Το `undefined` (**σβήσε**) δεν είναι το ίδιο με το `0`: ένα ρητό μηδέν στο κελί **νικά**
   * μια εσοχή ή γωνία δηλωμένη στη γραμμή/στήλη, δηλαδή γεννά παράκαμψη που ο χρήστης δεν
   * βλέπει και που ακυρώνει σιωπηλά την κληρονομιά. Ο κανόνας ζει στους δύο SSoT
   * (`nextTableIndentLevel`, `nextTableTextRotation`) και εδώ **εφαρμόζεται**, δεν ξαναγράφεται.
   */
  const writeAlign = useCallback(
    (value: TableCellAlign | undefined): void => {
      onDraft((current) => setTableFormatField(current, scope, 'align', value));
    },
    [onDraft, scope],
  );
  const writeIndent = useCallback(
    (level: number): void => {
      onDraft((current) => setTableFormatField(
        current, scope, 'indentLevel', level === 0 ? undefined : level,
      ));
    },
    [onDraft, scope],
  );
  const writeRotation = useCallback(
    (deg: number | undefined): void => {
      onDraft((current) => setTableFormatField(
        current, scope, 'textRotationDeg', deg === 0 ? undefined : deg,
      ));
    },
    [onDraft, scope],
  );

  return (
    <div className={styles.layout}>
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>
          {t(`${TABLE_FORMAT_CELLS_KEY}.alignment.textAlignment`)}
        </legend>

        {/*
          🔑 Δύο πτυσσόμενα (κάθετο × οριζόντιο) και **όχι** πλέγμα εννέα κουμπιών: είναι η
          διάταξη του Excel. Το πλέγμα είναι το idiom του AutoCAD — άλλο χειριστήριο, και ο
          χρήστης που ζήτησε 1:1 με το Excel δεν το ψάχνει εδώ. Οι εννέα συνδυασμοί μένουν
          εκφράσιμοι: τους παράγει το `nextTableAlign`, που αλλάζει **μόνο** τον άξονά του.
        */}
        <TableFormatCellsSelect
          label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.horizontal.label`)}
          value={align === null ? null : tableAlignHorizontal(align)}
          placeholder={mixedLabel}
          options={HORIZONTAL_CODES.map((code) => ({
            value: code, label: t(TABLE_HORIZONTAL_ALIGN_KEY[code]),
          }))}
          onChange={(code) => writeAlign(nextTableAlign(align, { axis: 'horizontal', code }))}
        />

        <TableFormatCellsSelect
          label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.vertical.label`)}
          value={align === null ? null : tableAlignVertical(align)}
          placeholder={mixedLabel}
          options={VERTICAL_CODES.map((code) => ({
            value: code, label: t(TABLE_VERTICAL_ALIGN_KEY[code]),
          }))}
          onChange={(code) => writeAlign(nextTableAlign(align, { axis: 'vertical', code }))}
        />

        <TableFormatOriginNote
          origin={resolveTableStyleFieldOrigin(model, style, scope, 'align')}
          explicit={alignState?.overridden === true}
          onClear={() => writeAlign(undefined)}
        />

        <TableFormatCellsSelect
          label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.indent`)}
          value={indent === null || indent.mixed
            ? null
            : String(clampTableIndentLevel(indent.value ?? 0))}
          placeholder={mixedLabel}
          options={INDENT_OPTIONS}
          onChange={(level) => writeIndent(clampTableIndentLevel(Number(level)))}
        />

        <TableFormatOriginNote
          origin={resolveTableStyleFieldOrigin(model, style, scope, 'indentLevel')}
          explicit={indent?.overridden === true}
          onClear={() => writeIndent(0)}
        />
      </fieldset>

      <div className={styles.section}>
        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>
            {t(`${TABLE_FORMAT_CELLS_KEY}.alignment.orientation`)}
          </legend>
          <TableTextOrientationDial
            value={rotation === null || rotation.mixed ? null : rotation.value ?? 0}
            onChange={writeRotation}
          />
          <TableFormatOriginNote
            origin={resolveTableStyleFieldOrigin(model, style, scope, 'textRotationDeg')}
            explicit={rotation?.overridden === true}
            onClear={() => writeRotation(undefined)}
          />
        </fieldset>

        <fieldset className={styles.section}>
          <legend className={styles.sectionTitle}>
            {t(`${TABLE_FORMAT_CELLS_KEY}.alignment.textControl`)}
          </legend>
          {/*
            🔴 Δύο κουτάκια που **ξετσεκάρουν το ένα το άλλο** — και η αμοιβαία αποκλειστικότητα
            δεν γράφεται πουθενά: την κάνει **μη εκφράσιμη** ο τύπος `TableCellOverflow` (ένωση,
            ποτέ δύο σημαίες). Το ξετσεκάρισμα γράφει `'clip'`, την προεπιλογή στην οποία
            επιστρέφεις — ίδιο με το Excel, που δεν έχει κουμπί «μην αναδιπλώνεις».
          */}
          <TableFormatCellsCheck
            label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.wrap`)}
            checked={overflow === 'wrap'}
            onChange={(next) => setOverflow(onDraft, scope, next ? 'wrap' : 'clip')}
          />
          <TableFormatCellsCheck
            label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.shrink`)}
            checked={overflow === 'shrink'}
            onChange={(next) => setOverflow(onDraft, scope, next ? 'shrink' : 'clip')}
          />
        </fieldset>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Ο γραφέας του ξεχειλίσματος — δικός του, γιατί **δεν** είναι πεδίο του `TableAxisStyleOverride`. */
function setOverflow(
  onDraft: TableFormatCellsAlignTabProps['onDraft'],
  scope: FormatTarget['scope'],
  value: 'wrap' | 'shrink' | 'clip',
): void {
  onDraft((current) => setTableFormatOverflow(current, scope, value));
}

