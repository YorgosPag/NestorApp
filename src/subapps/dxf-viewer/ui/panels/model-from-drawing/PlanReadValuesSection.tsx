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
 * Βήμα 6 — πλήκτρα όπως στο Figma, **μόνο** όσο η εστίαση είναι σε γραμμή (κανένα καθολικό πλήκτρο):
 *   ↑ / ↓  προηγούμενη / επόμενη γραμμή (η εστίαση φέρνει και την επισήμανση στον καμβά)·
 *   Enter  διόρθωση (το πεδίο ανοίγει· Enter αποθηκεύει, Esc ακυρώνει, η εστίαση γυρίζει στη γραμμή)·
 *   Space  «Σωστό ✓» · N  «Δεν είναι διάσταση».
 * Τα πλήκτρα διαβάζονται από το `event.code` (θέση πλήκτρου): ίδια σε ελληνική και αγγλική διάταξη.
 * ⚠️ ADR-711 — `role="listbox"` / `role="option"` ΓΙΑ ΛΟΓΟ, όπως η ουρά ανοιγμάτων του ίδιου πάνελ
 * (`ModelFromDrawingOpeningSections.tsx`): αυτοί οι ρόλοι κάνουν τους καθολικούς accelerators του viewer να υποχωρούν
 * (`shouldGlobalShortcutYield`)· αλλιώς το Space ή το N θα έτρεχαν και ό,τι είναι δεμένο σε αυτά στον καμβά.
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

/**
 * Η ερμηνεία: είδος, και για διάσταση η τιμή, ή «άγνωστη μονάδα «kh.»» (Δ21 (δ)), ή «χωρίς αποδεδειγμένη μονάδα». Ίδια για
 * γραμμή και προεπισκόπηση.
 */
function interpretationOf(row: PlanCorrectionPreview, t: Translate): string {
  const kind = t(KIND_KEY[row.kind]);
  if (row.valueMm !== null) return `${kind} ${t('modelFromDrawing.image.ocr.values.valueMm', { value: Math.round(row.valueMm) })}`;
  if (row.kind !== 'dimension') return kind;
  const why = row.unknownUnit !== null
    ? t('modelFromDrawing.image.ocr.values.unknownUnit', { suffix: row.unknownUnit })
    : t('modelFromDrawing.image.ocr.values.noUnit');
  return `${kind} · ${why}`;
}

/**
 * Βεβαιότητα · κατάσταση στη σύντηξη · απόκλιση — ό,τι υπάρχει. Δ3 — χωρίς κλίμακα η απόκλιση λέει ρητά ότι **δεν** κρίνει
 * τη γραμμένη τιμή (μετρά μόνο τις αναλογίες του χαρτιού).
 */
function metaOf(row: PlanReadValueRow, t: Translate): string {
  const parts = [t('modelFromDrawing.image.ocr.values.confidence', { percent: Math.round(row.confidence * 100) })];
  if (row.status !== null) parts.push(t(STATUS_KEY[row.status]));
  if (row.deviationMm !== null) {
    const key = row.scaleKnown ? 'modelFromDrawing.image.ocr.values.deviation' : 'modelFromDrawing.image.ocr.values.deviationUnscaled';
    parts.push(t(key, { value: Math.round(row.deviationMm) }));
  }
  return parts.join(' · ');
}

/** Βήμα 6 — τι σημαίνει ένα πλήκτρο πάνω σε γραμμή. `null` = δεν είναι δικό της (π.χ. Ctrl+N του browser). */
type ReadValueKey =
  | { readonly kind: 'step'; readonly delta: 1 | -1 }
  | { readonly kind: 'edit' | 'confirm' | 'not-dimension' };

const READ_VALUE_KEY_BY_CODE: Readonly<Record<string, ReadValueKey>> = {
  ArrowDown: { kind: 'step', delta: 1 },
  ArrowUp: { kind: 'step', delta: -1 },
  Enter: { kind: 'edit' },
  NumpadEnter: { kind: 'edit' },
  Space: { kind: 'confirm' },
  KeyN: { kind: 'not-dimension' },
};

/** Τα πλήκτρα της γραμμής, για το `aria-keyshortcuts` (WAI-ARIA). */
const ROW_KEY_SHORTCUTS = 'ArrowUp ArrowDown Enter Space N';

function decodeReadValueKey(event: React.KeyboardEvent): ReadValueKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  return READ_VALUE_KEY_BY_CODE[event.code] ?? null;
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

/**
 * Δ4 — κάθε πράξη της γραμμής κάνει το ΙΔΙΟ το κουμπί της να χαθεί (το «Σωστό» γίνεται «Επαναφορά», η «Αποδοχή» φεύγει μαζί
 * με την πρόταση). WAI-ARIA APG: όταν χάνεται το στοιχείο με την εστίαση, η εστίαση πάει σε λογικό σημείο — εδώ η **γραμμή**
 * (roving tabindex), όπως ήδη μετά το Esc του πεδίου· όχι στο `BODY` (μετρημένο live). `run` = πράξη + επιστροφή εστίασης.
 */
type RunRowAction = (action: () => void) => void;

function RowActions({ row, actions, run, t }: {
  readonly row: PlanReadValueRow;
  readonly actions: PlanReadValuesActions;
  readonly run: RunRowAction;
  readonly t: Translate;
}): React.ReactElement {
  const canDrop = row.kind === 'dimension';
  const checked = isHumanChecked(row);
  return (
    <p className="m-0 flex flex-wrap items-center gap-1">
      {!checked ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => run(() => actions.onConfirm(row.textId))} data-testid="mfd-read-value-confirm">
          <Check className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.confirm')}
        </Button>
      ) : null}
      {canDrop ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => run(() => actions.onMarkNotDimension(row.textId))} data-testid="mfd-read-value-not-dimension">
          {t('modelFromDrawing.image.ocr.values.notDimension')}
        </Button>
      ) : null}
      {checked ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => run(() => actions.onRevert(row.textId))} data-testid="mfd-read-value-revert">
          <RotateCcw className="size-3" aria-hidden="true" />
          {t('modelFromDrawing.image.ocr.values.revert')}
        </Button>
      ) : null}
    </p>
  );
}

/** Βήμα 7 — η πρόταση της συνόρθωσης για τιμή σε σύγκρουση, με αποδοχή ενός κλικ (ο ΙΔΙΟΣ δρόμος με κάθε διόρθωση). */
function RowSuggestion({ row, actions, run, t }: {
  readonly row: PlanReadValueRow;
  readonly actions: PlanReadValuesActions;
  readonly run: RunRowAction;
  readonly t: Translate;
}): React.ReactElement | null {
  const { suggestion } = row;
  if (suggestion === null) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-1 text-[11px] text-foreground" data-testid="mfd-read-value-suggestion">
      <Lightbulb className="size-3 shrink-0" aria-hidden="true" />
      <span>{t('modelFromDrawing.image.ocr.values.suggestion', { value: suggestion })}</span>
      <Button
        type="button" variant="outline" size="xs" onClick={() => run(() => actions.onCorrect(row.textId, suggestion))}
        aria-label={t('modelFromDrawing.image.ocr.values.acceptSuggestionLabel', { value: suggestion })}
        data-testid="mfd-read-value-accept-suggestion"
      >
        {t('modelFromDrawing.image.ocr.values.acceptSuggestion')}
      </Button>
    </p>
  );
}

/**
 * Βήμα 1 — το απόσπασμα της εικόνας από το οποίο διαβάστηκε το κείμενο (τεκμήριο δίπλα στην τιμή).
 * Δ5 — ύψος 64 CSS px (`h-16`, ήταν `h-8`: μετρημένο live 43–52 × 29 px, το κείμενο μόλις διαβαζόταν). Η πηγή
 * (`PLAN_READ_THUMB_MAX_EDGE_PX`) καλύπτει οθόνη 2× σε αυτό το ύψος· ποτέ πάνω από το πλάτος της γραμμής (`max-w-full`).
 */
function SourceThumbnail({ url, raw, t }: { readonly url: string | undefined; readonly raw: string; readonly t: Translate }): React.ReactElement | null {
  if (url === undefined) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- object URL μικρογραφίας από τον provider, όχι στατικό asset
    <img
      src={url} alt={t('modelFromDrawing.image.ocr.values.thumbnailAlt', { raw })} data-testid="mfd-read-value-thumbnail"
      className="h-16 max-w-full self-start rounded-sm border border-border bg-background object-contain object-left"
    />
  );
}

/** Ετικέτα προτεραιότητας · το κείμενο (κλικ = διόρθωση) · «Εστίαση» (βήμα 2). */
function RowHeader({ row, editing, onEdit, onFocusSource, t }: {
  readonly row: PlanReadValueRow;
  readonly editing: boolean;
  readonly onEdit: () => void;
  readonly onFocusSource: PlanReadValuesActions['onFocusSource'];
  readonly t: Translate;
}): React.ReactElement {
  return (
    <header className="flex items-center gap-1.5">
      <PriorityBadge priority={row.priority} t={t} />
      {editing ? null : (
        <button
          type="button" onClick={onEdit} className="flex items-center gap-1.5 text-xs font-mono text-foreground"
          aria-label={t('modelFromDrawing.image.ocr.values.editLabel', { raw: row.raw })} data-testid="mfd-read-value-edit"
        >
          <span>{row.raw}</span>
          <Pencil className="size-3 shrink-0" aria-hidden="true" />
        </button>
      )}
      <Button
        type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => onFocusSource(row.textId)}
        aria-label={t('modelFromDrawing.image.ocr.values.focusSourceLabel', { raw: row.raw })} data-testid="mfd-read-value-focus"
      >
        <Crosshair className="size-3" aria-hidden="true" />
        {t('modelFromDrawing.image.ocr.values.focusSource')}
      </Button>
    </header>
  );
}

interface ValueRowProps {
  readonly row: PlanReadValueRow;
  readonly thumbnail: string | undefined;
  readonly editing: boolean;
  /** Η γραμμή που κατέχει τα πλήκτρα (roving tabindex): η μόνη με `tabIndex=0`. */
  readonly active: boolean;
  readonly rowRef: (node: HTMLLIElement | null) => void;
  readonly onActivate: () => void;
  readonly onEdit: () => void;
  /** Το πεδίο έκλεισε (αποθήκευση ή Esc): η εστίαση γυρίζει στη γραμμή. */
  readonly onEndEdit: () => void;
  /** Δ4 — η εστίαση στη γραμμή (μετά από πράξη που κρύβει το κουμπί της). */
  readonly focusSelf: () => void;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}

function ValueRow({ row, thumbnail, editing, active, rowRef, onActivate, onEdit, onEndEdit, focusSelf, actions, t }: ValueRowProps): React.ReactElement {
  const run: RunRowAction = (action) => { action(); focusSelf(); };
  const save = (raw: string): void => {
    onEndEdit();
    if (raw.trim() !== '' && raw.trim() !== row.raw) actions.onCorrect(row.textId, raw);
  };
  return (
    <li
      ref={rowRef} tabIndex={active ? 0 : -1} role="option" aria-selected={active} aria-keyshortcuts={ROW_KEY_SHORTCUTS}
      className="flex flex-col gap-0.5 rounded-md border border-border p-1.5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
      data-testid="mfd-read-value" data-text-id={row.textId}
      data-status={row.status ?? 'none'} data-corrected={row.correctedFrom !== null} data-confirmed={row.confirmed}
      onMouseEnter={() => actions.onHover(row.textId)} onMouseLeave={() => actions.onHover(null)}
      onFocus={() => { onActivate(); actions.onHover(row.textId); }} onBlur={() => actions.onHover(null)}
    >
      <RowHeader row={row} editing={editing} onEdit={onEdit} onFocusSource={actions.onFocusSource} t={t} />
      <SourceThumbnail url={thumbnail} raw={row.raw} t={t} />
      {editing ? <RowEditor row={row} onSave={save} onCancel={onEndEdit} preview={actions.previewCorrection} t={t} /> : null}
      <p className="m-0 text-[11px] text-foreground">{interpretationOf(row, t)}</p>
      <p className={MUTED}>{metaOf(row, t)}</p>
      <RowSuggestion row={row} actions={actions} run={run} t={t} />
      {row.correctedFrom !== null ? (
        <p className={MUTED} data-testid="mfd-read-value-corrected">{t('modelFromDrawing.image.ocr.values.corrected', { raw: row.correctedFrom })}</p>
      ) : null}
      {row.confirmed ? (
        <p className={MUTED} data-testid="mfd-read-value-confirmed">{t('modelFromDrawing.image.ocr.values.confirmed')}</p>
      ) : null}
      <RowActions row={row} actions={actions} run={run} t={t} />
    </li>
  );
}

/** Βήμα 6 — η πράξη ενός πλήκτρου πάνω στη γραμμή `row` (η εστιασμένη). */
function applyReadValueKey(
  key: ReadValueKey,
  row: PlanReadValueRow,
  ops: { readonly step: (delta: 1 | -1) => void; readonly edit: () => void; readonly actions: PlanReadValuesActions },
): void {
  if (key.kind === 'step') ops.step(key.delta);
  else if (key.kind === 'edit') ops.edit();
  else if (key.kind === 'confirm') { if (!isHumanChecked(row)) ops.actions.onConfirm(row.textId); }
  else if (row.kind === 'dimension') ops.actions.onMarkNotDimension(row.textId);
}

/**
 * Βήμα 6 — ο χειριστής πλήκτρων της λίστας. Μόνο όταν η εστίαση είναι στη ΓΡΑΜΜΗ: στο πεδίο το Enter αποθηκεύει και το
 * Space γράφει κενό. Η γραμμή διαβάζεται από το `event.target` τη στιγμή του πλήκτρου (ADR-711: όχι από state, που μπορεί
 * να μην έχει προλάβει την εστίαση).
 */
function readValueKeyHandler(
  rows: readonly PlanReadValueRow[],
  ops: { readonly focusRow: (textId: string) => void; readonly edit: (textId: string) => void; readonly actions: PlanReadValuesActions },
): (event: React.KeyboardEvent<HTMLOListElement>) => void {
  return (event) => {
    const { target } = event;
    if (!(target instanceof Element) || target.getAttribute('role') !== 'option') return;
    const textId = target.getAttribute('data-text-id');
    const index = rows.findIndex((r) => r.textId === textId);
    const key = decodeReadValueKey(event);
    if (index < 0 || key === null) return;
    event.preventDefault();
    applyReadValueKey(key, rows[index], {
      step: (delta) => ops.focusRow(rows[Math.min(rows.length - 1, Math.max(0, index + delta))].textId),
      edit: () => ops.edit(rows[index].textId),
      actions: ops.actions,
    });
  };
}

/** Η λίστα: roving tabindex, ένα πεδίο διόρθωσης τη φορά, τα πλήκτρα του βήματος 6 (βλ. κεφαλίδα). */
function ReadValueList({ rows, thumbnails, actions, t }: {
  readonly rows: readonly PlanReadValueRow[];
  readonly thumbnails: ReadonlyMap<string, string>;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const nodes = React.useRef(new Map<string, HTMLLIElement>());
  const activeIndex = Math.max(0, rows.findIndex((r) => r.textId === activeId));
  const focusRow = (textId: string): void => { nodes.current.get(textId)?.focus(); };

  const onKeyDown = readValueKeyHandler(rows, { focusRow, edit: setEditing, actions });

  return (
    <ol
      className="m-0 flex list-none flex-col gap-1 p-0" role="listbox" onKeyDown={onKeyDown}
      aria-label={t('modelFromDrawing.image.ocr.values.listLabel')} data-testid="mfd-read-values-list"
    >
      {rows.map((row, i) => (
        <ValueRow
          key={row.textId} row={row} thumbnail={thumbnails.get(row.textId)} editing={editing === row.textId} active={i === activeIndex}
          rowRef={(node) => { if (node) nodes.current.set(row.textId, node); else nodes.current.delete(row.textId); }}
          onActivate={() => setActiveId(row.textId)} onEdit={() => setEditing(row.textId)}
          onEndEdit={() => { setEditing(null); focusRow(row.textId); }} focusSelf={() => focusRow(row.textId)} actions={actions} t={t}
        />
      ))}
    </ol>
  );
}

/** Στον έλεγχο, όταν υπάρχει ανάγνωση: οι γραμμένες τιμές όπως τις διάβασε η μηχανή, με διόρθωση ενός κλικ. */
export function PlanReadValuesSection({ rows, thumbnails, actions, t }: {
  /** `null` = καμία ανάγνωση στη σύντηξη. */
  readonly rows: readonly PlanReadValueRow[] | null;
  /** Βήμα 1 — `textId → URL` μικρογραφίας· όσα λείπουν απλώς δεν δείχνουν εικόνα. */
  readonly thumbnails: ReadonlyMap<string, string>;
  readonly actions: PlanReadValuesActions;
  readonly t: Translate;
}): React.ReactElement | null {
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
      {rows.length > 0 ? <p className={MUTED} data-testid="mfd-read-values-keys">{t('modelFromDrawing.image.ocr.values.keys')}</p> : null}
      {rows.length > 0 ? <ReadValueList rows={rows} thumbnails={thumbnails} actions={actions} t={t} /> : null}
    </section>
  );
}
