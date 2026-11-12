'use client';

/**
 * ADR-929 Δ21 (δ) — η λίστα **«Τι διάβασα»**: κάθε κείμενο της ανάγνωσης με την ερμηνεία του (τιμή ή είδος), βεβαιότητα,
 * κατάσταση στη σύντηξη και απόκλιση, η πιο ύποπτη πρώτη (`plan-read-values.ts`). Κλικ στο κείμενο ⇒ πεδίο διόρθωσης
 * (Enter αποθηκεύει, Esc ακυρώνει)· «Δεν είναι διάσταση» · «Επαναφορά» με την αρχική ανάγνωση ορατή. Το δείκτη πάνω σε
 * γραμμή ⇒ επισήμανση του κειμένου στην εικόνα.
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 *
 * @see ../../../systems/plan-recognition/plan-reading-corrections.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FusedDimensionStatus } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanTextKind } from '../../../bim/plan-recognition/plan-recognition-types';
import type { PlanCorrectionPreview } from '../../../bim/plan-recognition/reading/reading-corrections';
import type { PlanReadValueRow } from '../../../systems/plan-recognition/plan-read-values';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

export interface PlanReadValuesActions {
  readonly onCorrect: (textId: string, raw: string) => void;
  readonly onMarkNotDimension: (textId: string) => void;
  readonly onRevert: (textId: string) => void;
  /** Η γραμμή που δείχνει ο άνθρωπος (`null` = καμία). */
  readonly onHover: (textId: string | null) => void;
  /** Βήμα 5 — τι θα γινόταν το κείμενο με αυτή τη διόρθωση (ο ΙΔΙΟΣ δρόμος με την αποθήκευση)· `null` = τίποτα να δειχτεί. */
  readonly previewCorrection: (textId: string, raw: string) => PlanCorrectionPreview | null;
}

/** Κάθε είδος με ΡΗΤΟ κλειδί (CHECK 3.8)· εξαντλητικό: νέο είδος χωρίς κείμενο = σφάλμα μεταγλώττισης. */
const KIND_KEY: Readonly<Record<PlanTextKind, string>> = {
  dimension: 'modelFromDrawing.image.ocr.values.kind.dimension',
  'room-name': 'modelFromDrawing.image.ocr.values.kind.room-name',
  area: 'modelFromDrawing.image.ocr.values.kind.area',
  scale: 'modelFromDrawing.image.ocr.values.kind.scale',
  title: 'modelFromDrawing.image.ocr.values.kind.title',
  'opening-size': 'modelFromDrawing.image.ocr.values.kind.opening-size',
  other: 'modelFromDrawing.image.ocr.values.kind.other',
};

const STATUS_KEY: Readonly<Record<FusedDimensionStatus, string>> = {
  consistent: 'modelFromDrawing.image.ocr.values.status.consistent',
  conflict: 'modelFromDrawing.image.ocr.values.status.conflict',
  uncheckable: 'modelFromDrawing.image.ocr.values.status.uncheckable',
  unbound: 'modelFromDrawing.image.ocr.values.status.unbound',
};

/** Η ερμηνεία: είδος, και για διάσταση η τιμή ή «χωρίς αποδεδειγμένη μονάδα». Ίδια για γραμμή και προεπισκόπηση. */
function interpretationOf(row: PlanCorrectionPreview, t: Translate): string {
  const kind = t(KIND_KEY[row.kind]);
  if (row.valueMm !== null) return `${kind} ${t('modelFromDrawing.image.ocr.values.valueMm', { value: Math.round(row.valueMm) })}`;
  return row.kind === 'dimension' ? `${kind} · ${t('modelFromDrawing.image.ocr.values.noUnit')}` : kind;
}

/** Βεβαιότητα · κατάσταση στη σύντηξη · απόκλιση — ό,τι υπάρχει. */
function metaOf(row: PlanReadValueRow, t: Translate): string {
  const parts = [t('modelFromDrawing.image.ocr.values.confidence', { percent: Math.round(row.confidence * 100) })];
  if (row.status !== null) parts.push(t(STATUS_KEY[row.status]));
  if (row.deviationMm !== null) parts.push(t('modelFromDrawing.image.ocr.values.deviation', { value: Math.round(row.deviationMm) }));
  return parts.join(' · ');
}

function RowEditor({ row, onSave, onCancel, preview, t }: {
  readonly row: PlanReadValueRow;
  readonly onSave: (raw: string) => void;
  readonly onCancel: () => void;
  readonly preview: PlanReadValuesActions['previewCorrection'];
  readonly t: Translate;
}): React.ReactElement {
  const [draft, setDraft] = React.useState(row.raw);
  const interpreted = preview(row.textId, draft);
  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSave(draft);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation(); // το Esc κλείνει το πεδίο, όχι τον βοηθό
    onCancel();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-0.5" data-testid="mfd-read-value-editor">
      <Input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
        aria-label={t('modelFromDrawing.image.ocr.values.inputLabel')} className="h-7 text-xs" data-testid="mfd-read-value-input"
        aria-describedby={`mfd-read-value-preview-${row.textId}`}
      />
      <output
        id={`mfd-read-value-preview-${row.textId}`} aria-live="polite" className={MUTED} data-testid="mfd-read-value-preview"
      >
        {interpreted !== null ? t('modelFromDrawing.image.ocr.values.preview', { value: interpretationOf(interpreted, t) }) : null}
      </output>
    </form>
  );
}

function RowActions({ row, actions, t }: {
  readonly row: PlanReadValueRow;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement | null {
  const canDrop = row.kind === 'dimension';
  if (!canDrop && row.correctedFrom === null) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-1">
      {canDrop ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => actions.onMarkNotDimension(row.textId)} data-testid="mfd-read-value-not-dimension">
          {t('modelFromDrawing.image.ocr.values.notDimension')}
        </Button>
      ) : null}
      {row.correctedFrom !== null ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => actions.onRevert(row.textId)} data-testid="mfd-read-value-revert">
          <RotateCcw className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.revert')}
        </Button>
      ) : null}
    </p>
  );
}

function ValueRow({ row, editing, onEdit, actions, t }: {
  readonly row: PlanReadValueRow;
  readonly editing: boolean;
  readonly onEdit: (textId: string | null) => void;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement {
  const save = (raw: string): void => {
    onEdit(null);
    if (raw.trim() !== '' && raw.trim() !== row.raw) actions.onCorrect(row.textId, raw);
  };
  return (
    <li
      className="flex flex-col gap-0.5 rounded-md border border-border p-1.5" data-testid="mfd-read-value" data-text-id={row.textId}
      data-status={row.status ?? 'none'} data-corrected={row.correctedFrom !== null}
      onMouseEnter={() => actions.onHover(row.textId)} onMouseLeave={() => actions.onHover(null)}
      onFocus={() => actions.onHover(row.textId)} onBlur={() => actions.onHover(null)}
    >
      {editing ? <RowEditor row={row} onSave={save} onCancel={() => onEdit(null)} preview={actions.previewCorrection} t={t} /> : (
        <button
          type="button" onClick={() => onEdit(row.textId)} className="flex items-center gap-1.5 self-start text-xs font-mono text-foreground"
          aria-label={t('modelFromDrawing.image.ocr.values.editLabel', { raw: row.raw })} data-testid="mfd-read-value-edit"
        >
          <span>{row.raw}</span>
          <Pencil className="size-3 shrink-0" aria-hidden="true" />
        </button>
      )}
      <p className="m-0 text-[11px] text-foreground">{interpretationOf(row, t)}</p>
      <p className={MUTED}>{metaOf(row, t)}</p>
      {row.correctedFrom !== null ? (
        <p className={MUTED} data-testid="mfd-read-value-corrected">{t('modelFromDrawing.image.ocr.values.corrected', { raw: row.correctedFrom })}</p>
      ) : null}
      <RowActions row={row} actions={actions} t={t} />
    </li>
  );
}

/** Στον έλεγχο, όταν υπάρχει ανάγνωση: οι γραμμένες τιμές όπως τις διάβασε η μηχανή, με διόρθωση ενός κλικ. */
export function PlanReadValuesSection({ rows, actions, t }: {
  /** `null` = καμία ανάγνωση στη σύντηξη. */
  readonly rows: readonly PlanReadValueRow[] | null;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement | null {
  const [editing, setEditing] = React.useState<string | null>(null);
  if (rows === null) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-read-values">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.ocr.values.title')}</h4>
      <p className={MUTED}>
        {rows.length > 0 ? t('modelFromDrawing.image.ocr.values.hint') : t('modelFromDrawing.image.ocr.values.empty')}
      </p>
      {rows.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((row) => (
            <ValueRow key={row.textId} row={row} editing={editing === row.textId} onEdit={setEditing} actions={actions} t={t} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
