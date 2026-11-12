'use client';

/**
 * ADR-929 Δ21 (δ) — η λίστα **«Τι διάβασα»**: κάθε κείμενο της ανάγνωσης με την ερμηνεία του (τιμή ή είδος), βεβαιότητα,
 * κατάσταση στη σύντηξη και απόκλιση, η πιο ύποπτη πρώτη (`plan-read-values.ts`). Κλικ στο κείμενο ⇒ πεδίο διόρθωσης
 * (Enter αποθηκεύει, Esc ακυρώνει)· «Σωστό ✓» · «Δεν είναι διάσταση» · «Επαναφορά» με την αρχική ανάγνωση ορατή· πρόοδος
 * «ελέγχθηκαν N από M». Το δείκτη πάνω σε
 * γραμμή ⇒ επισήμανση του κειμένου στην εικόνα.
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 *
 * @see ../../../systems/plan-recognition/plan-reading-corrections.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { Check, CircleCheck, Crosshair, Lightbulb, Pencil, RotateCcw, TriangleAlert, UserCheck, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FusedDimensionStatus } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanTextKind } from '../../../bim/plan-recognition/plan-recognition-types';
import type { PlanCorrectionPreview } from '../../../bim/plan-recognition/reading/reading-corrections';
import {
  isHumanChecked, planReadValuesProgress, type PlanReadValuePriority, type PlanReadValueRow,
} from '../../../systems/plan-recognition/plan-read-values';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

export interface PlanReadValuesActions {
  readonly onCorrect: (textId: string, raw: string) => void;
  readonly onMarkNotDimension: (textId: string) => void;
  readonly onRevert: (textId: string) => void;
  /** Βήμα 2 — «Εστίαση στην πηγή»: η όψη πάει στο κείμενο στην εικόνα (ξεχωριστό κουμπί· το κλικ στο κείμενο = διόρθωση). */
  readonly onFocusSource: (textId: string) => void;
  /** Βήμα 3 — «Σωστό ✓»: η ανάγνωση επιβεβαιώνεται χωρίς αλλαγή. */
  readonly onConfirm: (textId: string) => void;
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

/**
 * Βήμα 4 — η ετικέτα προτεραιότητας: λέξη **και** σχήμα εικονιδίου διαφορετικά σε κάθε κατάσταση, ώστε να ξεχωρίζουν χωρίς
 * χρώμα (WCAG 1.4.1, πνεύμα του CHECK 3.41)· το χρώμα από τις παραλλαγές του κεντρικού `Badge` (μετρημένο μελάνι).
 */
const PRIORITY_MARK: Readonly<Record<PlanReadValuePriority, {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly variant: NonNullable<BadgeVariantProps['variant']>;
}>> = {
  suspect: { key: 'modelFromDrawing.image.ocr.values.priority.suspect', icon: TriangleAlert, variant: 'warning' },
  checked: { key: 'modelFromDrawing.image.ocr.values.priority.checked', icon: UserCheck, variant: 'info' },
  ok: { key: 'modelFromDrawing.image.ocr.values.priority.ok', icon: CircleCheck, variant: 'outline' },
};

function PriorityBadge({ priority, t }: { readonly priority: PlanReadValuePriority; readonly t: Translate }): React.ReactElement {
  const mark = PRIORITY_MARK[priority];
  const Icon = mark.icon;
  return (
    <Badge variant={mark.variant} className="shrink-0 gap-1 px-1.5 py-0 text-[10px]" data-testid="mfd-read-value-priority" data-priority={priority}>
      <Icon className="size-3" aria-hidden="true" />
      {t(mark.key)}
    </Badge>
  );
}

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
}): React.ReactElement {
  const canDrop = row.kind === 'dimension';
  const checked = isHumanChecked(row);
  return (
    <p className="m-0 flex flex-wrap items-center gap-1">
      {!checked ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => actions.onConfirm(row.textId)} data-testid="mfd-read-value-confirm">
          <Check className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.confirm')}
        </Button>
      ) : null}
      {canDrop ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => actions.onMarkNotDimension(row.textId)} data-testid="mfd-read-value-not-dimension">
          {t('modelFromDrawing.image.ocr.values.notDimension')}
        </Button>
      ) : null}
      {checked ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => actions.onRevert(row.textId)} data-testid="mfd-read-value-revert">
          <RotateCcw className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.revert')}
        </Button>
      ) : null}
    </p>
  );
}

/** Βήμα 7 — η πρόταση της συνόρθωσης για τιμή σε σύγκρουση, με αποδοχή ενός κλικ (ο ΙΔΙΟΣ δρόμος με κάθε διόρθωση). */
function RowSuggestion({ row, actions, t }: {
  readonly row: PlanReadValueRow;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement | null {
  const { suggestion } = row;
  if (suggestion === null) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-1 text-[11px] text-foreground" data-testid="mfd-read-value-suggestion">
      <Lightbulb className="size-3 shrink-0" aria-hidden="true" />
      <span>{t('modelFromDrawing.image.ocr.values.suggestion', { value: suggestion })}</span>
      <Button
        type="button" variant="outline" size="xs" onClick={() => actions.onCorrect(row.textId, suggestion)}
        aria-label={t('modelFromDrawing.image.ocr.values.acceptSuggestionLabel', { value: suggestion })}
        data-testid="mfd-read-value-accept-suggestion"
      >
        {t('modelFromDrawing.image.ocr.values.acceptSuggestion')}
      </Button>
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
      data-status={row.status ?? 'none'} data-corrected={row.correctedFrom !== null} data-confirmed={row.confirmed}
      onMouseEnter={() => actions.onHover(row.textId)} onMouseLeave={() => actions.onHover(null)}
      onFocus={() => actions.onHover(row.textId)} onBlur={() => actions.onHover(null)}
    >
      <header className="flex items-center gap-1.5">
        <PriorityBadge priority={row.priority} t={t} />
        {editing ? null : (
          <button
            type="button" onClick={() => onEdit(row.textId)} className="flex items-center gap-1.5 text-xs font-mono text-foreground"
            aria-label={t('modelFromDrawing.image.ocr.values.editLabel', { raw: row.raw })} data-testid="mfd-read-value-edit"
          >
            <span>{row.raw}</span>
            <Pencil className="size-3 shrink-0" aria-hidden="true" />
          </button>
        )}
        <Button
          type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => actions.onFocusSource(row.textId)}
          aria-label={t('modelFromDrawing.image.ocr.values.focusSourceLabel', { raw: row.raw })} data-testid="mfd-read-value-focus"
        >
          <Crosshair className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.focusSource')}
        </Button>
      </header>
      {editing ? <RowEditor row={row} onSave={save} onCancel={() => onEdit(null)} preview={actions.previewCorrection} t={t} /> : null}
      <p className="m-0 text-[11px] text-foreground">{interpretationOf(row, t)}</p>
      <p className={MUTED}>{metaOf(row, t)}</p>
      <RowSuggestion row={row} actions={actions} t={t} />
      {row.correctedFrom !== null ? (
        <p className={MUTED} data-testid="mfd-read-value-corrected">{t('modelFromDrawing.image.ocr.values.corrected', { raw: row.correctedFrom })}</p>
      ) : null}
      {row.confirmed ? (
        <p className={MUTED} data-testid="mfd-read-value-confirmed">{t('modelFromDrawing.image.ocr.values.confirmed')}</p>
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
  const progress = planReadValuesProgress(rows);
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-read-values">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.ocr.values.title')}</h4>
      {rows.length > 0 ? (
        <p className={MUTED} role="status" data-testid="mfd-read-values-progress">
          {t('modelFromDrawing.image.ocr.values.progress', { checked: progress.checked, total: progress.total })}
        </p>
      ) : null}
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
