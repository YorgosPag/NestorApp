'use client';

/**
 * 🔴 ADR-760 §9 «Στάδιο 2» — **η καρτέλα «Αριθμός»**: το χειριστήριο που έλειπε από τη μορφή
 * κελιού. Το μοντέλο, η μηχανή, ο γραφέας και η ανάγνωση υπήρχαν **ολόκληρα** από το ADR-760·
 * αυτό εδώ είναι η επιφάνεια, και **μόνο** αυτή.
 *
 * ## Η διάταξη είναι του Excel, μετρημένη από την τεκμηρίωση της Microsoft
 * ```
 *   [ Κατηγορία ]   |   Δείγμα: 1.234,50 €
 *   Γενική          |   Δεκαδικά ψηφία:  [2 ▾]
 *   Ακέραιος        |   Σύμβολο:         [EUR ▾]
 *   Δεκαδικός       |   [x] Διαχωριστικό χιλιάδων
 *   Νόμισμα         |
 *   …               |   ⓘ Το ορίζει η ΣΤΗΛΗ
 * ```
 * Αριστερά η λίστα κατηγοριών, δεξιά **μόνο** οι επιλογές που έχουν νόημα για την επιλεγμένη —
 * ακριβώς όπως το Excel δείχνει «Δεκαδικά ψηφία» για τον Αριθμό και «Τύπος» για την Ημερομηνία.
 *
 * ## 🔬 Τι από αυτά **δεν** έχουμε, δηλωμένο αντί για σιωπηλά απόν
 * Το Excel προσφέρει *Λογιστική · Ώρα · Κλάσμα · Επιστημονική · Ειδική · Προσαρμοσμένη*, και
 * καμία τους δεν είναι εδώ:
 * ```
 *   Λογιστική     — είναι Νόμισμα με στοίχιση συμβόλων· η στοίχιση είναι ερώτηση της ΔΙΑΤΑΞΗΣ
 *   Ώρα           — η εποχή του `excel-serial-date` κρατά ημέρες, όχι κλάσμα ημέρας
 *   Κλάσμα        — δεν υπάρχει στο `TableCellFormatKind` (ADR-760 §6.1)
 *   Επιστημονική  — ομοίως
 *   Ειδική        — ΤΚ/τηλέφωνο/ΑΜΚΑ: λεξιλόγιο **των ΗΠΑ**, όχι σχεδίου
 *   Προσαρμοσμένη — είναι το μοτίβο ψηφίων που το ADR-760 §5 απορρίπτει ΡΗΤΑ ως μη φορητό
 * ```
 * Η **γωνία** είναι η μία κατηγορία που το Excel δεν έχει και εμείς ναι — από το AutoCAD
 * (`AUNITS`), γιατί ένα σχέδιο τη χρειάζεται.
 *
 * ## 🏆 Δύο πράγματα που κανένα εργαλείο πίνακα δεν δείχνει
 * 1. **Ποιο επίπεδο αποφασίζει** (κελί ▸ γραμμή ▸ στήλη ▸ `valueType`) — δες
 *    {@link TableFormatOriginNote}·
 * 2. **Επαναφορά αυτού του πεδίου** στην κληρονομιά, από μέσα (idiom Revit «By Category»). Το
 *    Excel έχει μόνο «Απαλοιφή μορφών» για ολόκληρο το κελί.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsNumberTab
 * @see bim/table/table-number-format-facets.ts — τι σημαίνει κάθε αλλαγή (SSoT)
 * @see bim/table/table-format-sample.ts — από πού έρχεται το «Δείγμα»
 */

import React, { useCallback, useId } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getCurrencyOptions } from '../../../../config/modal-select';
import { setTableFormatField } from '../../../../bim/table/table-format-scope';
import { resolveTableNumberFormatOrigin } from '../../../../bim/table/table-format-origin';
import { tableFormatSample } from '../../../../bim/table/table-format-sample';
import {
  DEFAULT_TABLE_ANGLE_UNIT,
  TABLE_DECIMAL_STEPS,
  TABLE_NUMBER_FORMAT_KINDS,
  clampTableFormatDecimals,
  tableNumberFormatDecimals,
  tableNumberFormatHasGrouping,
  tableNumberFormatSupportsGrouping,
  withTableNumberFormatAngleUnit,
  withTableNumberFormatCurrency,
  withTableNumberFormatDateStyle,
  withTableNumberFormatDecimals,
  withTableNumberFormatGrouping,
  withTableNumberFormatKind,
} from '../../../../bim/table/table-number-format-facets';
import { resolveTableNumberFormatState } from '../../../table-cell-editor/table-format-snapshot';
import {
  DEFAULT_TABLE_CURRENCY,
  DEFAULT_TABLE_DATE_STYLE,
  TABLE_GENERAL_FORMAT,
  type TableCellFormat,
  type TableDateStyle,
} from '../../../../types/table-cell-format';
import type { AngularUnitType } from '../../../../config/number-format-config';
import type { FormatTarget } from '../../../table-cell-editor/table-format-snapshot';
import type { PersistedTableModel } from '../../../../types/table';
import {
  TABLE_ANGLE_UNIT_KEY,
  TABLE_DATE_STYLE_KEY,
  TABLE_FORMAT_CELLS_KEY,
  TABLE_FORMAT_KIND_KEY,
} from './table-format-cells-labels';
import { TableFormatOriginNote } from './TableFormatOriginNote';
import { TableFormatCellsCheck, TableFormatCellsSelect } from './TableFormatCellsFields';
import styles from './TableFormatCellsDialog.module.css';

/** Οι έξι μορφές ημερομηνίας — ο κατάλογος του μοντέλου, όχι δεύτερη λίστα. */
const DATE_STYLES = Object.keys(TABLE_DATE_STYLE_KEY) as readonly TableDateStyle[];
/** Οι πέντε μονάδες γωνίας του ADR-082 — ομοίως. */
const ANGLE_UNITS = Object.keys(TABLE_ANGLE_UNIT_KEY) as readonly AngularUnitType[];

/**
 * Τα σκαλιά ακρίβειας ως επιλογές.
 *
 * ⚠️ **Λίστα και όχι `<input type="number">`**: ο τύπος `Precision` είναι κλειστό σύνολο 0-8,
 * οπότε ένα ελεύθερο πεδίο θα δεχόταν `12` και θα χρειαζόταν κόψιμο **μετά** — δηλαδή ο χρήστης
 * θα έβλεπε την τιμή του να αλλάζει μόνη της. (Το Excel κόβει κι εκείνο στα 30, απλώς σιωπηλά.)
 */
const DECIMAL_OPTIONS = TABLE_DECIMAL_STEPS.map((step) => ({
  value: String(step),
  label: String(step),
}));

/** Τα νομίσματα: ο **κωδικός** είναι και η τιμή και η ετικέτα (ISO 4217, αμετάφραστος). */
const CURRENCY_OPTIONS = getCurrencyOptions().map((option) => ({
  value: option.value,
  label: option.value,
}));

export interface TableFormatCellsNumberTabProps {
  readonly target: FormatTarget;
  readonly onDraft: (next: (current: PersistedTableModel) => PersistedTableModel) => void;
}

export function TableFormatCellsNumberTab(
  props: TableFormatCellsNumberTabProps,
): React.ReactElement {
  const { target, onDraft } = props;
  const { t } = useTranslation('dxf-viewer');
  const listId = useId();

  const state = resolveTableNumberFormatState(target);
  const origin = resolveTableNumberFormatOrigin(target.model, target.style, target.scope);
  const current = state.current;
  const sample = tableFormatSample(target.model, target.scope, current ?? TABLE_GENERAL_FORMAT);

  /**
   * Ο ΕΝΑΣ γραφέας της καρτέλας.
   *
   * ⚠️ `undefined` σημαίνει **σβήσε το πεδίο** (επιστροφή στην κληρονομιά) και όχι «καμία
   * αλλαγή» — η ίδια τριάδα καταστάσεων με το `setField` της θύρας, αυτούσια. Ένα δεύτερο
   * νόημα εδώ θα ήταν το σημείο όπου ο διάλογος και η κορδέλα θα διαφωνούσαν για το τι κάνει
   * το «Επαναφορά».
   */
  const write = useCallback(
    (value: TableCellFormat | undefined): void => {
      onDraft((model) => setTableFormatField(model, target.scope, 'numberFormat', value));
    },
    [onDraft, target.scope],
  );

  const decimals = tableNumberFormatDecimals(current);
  const grouping = current !== null && tableNumberFormatHasGrouping(current);
  const mixedLabel = t(`${TABLE_FORMAT_CELLS_KEY}.mixed`);

  return (
    <div className={styles.layout}>
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>
          {t(`${TABLE_FORMAT_CELLS_KEY}.number.category`)}
        </legend>
        {/*
          `listbox` και όχι πτυσσόμενο: το Excel δείχνει **ανοιχτή** λίστα κατηγοριών, ώστε η
          περιήγηση να είναι ένα κλικ. Ίδιο μοτίβο με το `TableBorderStyleListbox` δίπλα.
        */}
        <div
          id={listId}
          role="listbox"
          aria-label={t(`${TABLE_FORMAT_CELLS_KEY}.number.category`)}
          className={styles.kindList}
        >
          {TABLE_NUMBER_FORMAT_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="option"
              aria-selected={current?.kind === kind}
              className={cn(
                styles.kindOption,
                current?.kind === kind && styles.kindOptionSelected,
              )}
              onClick={() => write(withTableNumberFormatKind(current, kind))}
            >
              {t(TABLE_FORMAT_KIND_KEY[kind])}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.section}>
        <SampleBox sample={sample} />

        {decimals === null ? null : (
          <TableFormatCellsSelect
            label={t(`${TABLE_FORMAT_CELLS_KEY}.number.decimals`)}
            value={String(decimals)}
            placeholder={mixedLabel}
            options={DECIMAL_OPTIONS}
            onChange={(next) => write(
              withTableNumberFormatDecimals(current, clampTableFormatDecimals(Number(next))),
            )}
          />
        )}

        {/*
          🔴 Το **σύμβολο νομίσματος** έρχεται από τον υπάρχοντα κατάλογο του `modal-select`
          (ADR-294), τρίτος καταναλωτής του. Μια δική μας λίστα ISO 4217 εδώ θα ήταν δεύτερη
          απάντηση στο «ποια νομίσματα υποστηρίζει η εφαρμογή» και θα απέκλινε από τη φόρμα
          τραπεζικού λογαριασμού στην πρώτη προσθήκη.
        */}
        {current?.kind === 'currency' ? (
          <TableFormatCellsSelect
            label={t(`${TABLE_FORMAT_CELLS_KEY}.number.currency`)}
            value={current.currency ?? DEFAULT_TABLE_CURRENCY}
            placeholder={mixedLabel}
            options={CURRENCY_OPTIONS}
            onChange={(code) => write(withTableNumberFormatCurrency(current, code))}
          />
        ) : null}

        {current?.kind === 'date' ? (
          <TableFormatCellsSelect
            label={t(`${TABLE_FORMAT_CELLS_KEY}.number.dateStyle`)}
            value={current.style ?? DEFAULT_TABLE_DATE_STYLE}
            placeholder={mixedLabel}
            options={DATE_STYLES.map((style) => ({ value: style, label: t(TABLE_DATE_STYLE_KEY[style]) }))}
            onChange={(style) => write(withTableNumberFormatDateStyle(current, style))}
          />
        ) : null}

        {current?.kind === 'angle' ? (
          <TableFormatCellsSelect
            label={t(`${TABLE_FORMAT_CELLS_KEY}.number.angleUnit`)}
            value={current.unit ?? DEFAULT_TABLE_ANGLE_UNIT}
            placeholder={mixedLabel}
            options={ANGLE_UNITS.map((unit) => ({ value: unit, label: t(TABLE_ANGLE_UNIT_KEY[unit]) }))}
            onChange={(unit) => write(withTableNumberFormatAngleUnit(current, unit))}
          />
        ) : null}

        {current !== null && tableNumberFormatSupportsGrouping(current) ? (
          <TableFormatCellsCheck
            label={t(`${TABLE_FORMAT_CELLS_KEY}.number.grouping`)}
            checked={grouping}
            onChange={(next) => write(withTableNumberFormatGrouping(current, next))}
          />
        ) : null}

        <TableFormatOriginNote
          origin={origin}
          explicit={state.explicit}
          onClear={() => write(undefined)}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — ένα πεδίο, μία ερώτηση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το «Δείγμα» του Excel — με **την πραγματική τιμή** του κελιού όταν υπάρχει.
 *
 * ⚠️ Όταν το κελί είναι κενό, το κείμενο ονομάζεται **παράδειγμα**. Χωρίς αυτή τη διάκριση ο
 * χρήστης θα διάβαζε `1.234,50` και θα νόμιζε ότι το κελί έχει περιεχόμενο — ψέμα ακριβώς στο
 * χειριστήριο που υπάρχει για να λέει την αλήθεια. Δες `bim/table/table-format-sample.ts`.
 */
function SampleBox({ sample }: {
  readonly sample: ReturnType<typeof tableFormatSample>;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  return (
    <div className={styles.sampleBox}>
      <span className={styles.fieldLabel}>
        {sample.source === 'cell'
          ? t(`${TABLE_FORMAT_CELLS_KEY}.number.sample`)
          : t(`${TABLE_FORMAT_CELLS_KEY}.number.sampleExample`)}
      </span>
      <output className={styles.sampleValue}>{sample.text}</output>
    </div>
  );
}
