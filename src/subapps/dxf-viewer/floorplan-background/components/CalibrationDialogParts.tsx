'use client';

/**
 * ADR-929 Φ5.2 — τα κομμάτια του διαλόγου βαθμονόμησης: πεδίο γνωστού μήκους και σύνοψη λύσης.
 *
 * Η σύνοψη δείχνει **τι θα γραφτεί** («1 pixel = x mm», ανισοτροπία X–Y, απόκλιση ανά μήκος) πριν την
 * εφαρμογή — ο έλεγχος «μέτρα και μια δεύτερη διάσταση» που ο Bluebeam αφήνει στο χέρι του χρήστη,
 * εδώ αυτόματος. Η κατάσταση (εντάξει / προσοχή) λέγεται με **εικονίδιο και κείμενο**, όχι μόνο με
 * χρώμα (CHECK 3.41).
 */

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/intl-formatting';
import { CALIBRATION_UNITS, isCalibrationUnit } from '../providers/types';
import type { CalibrationLengthDraft } from '../geometry/calibration-draft';
import { calibrationNeedsReview } from '../geometry/calibration-solve';
import type { CalibrationPreview } from '../hooks/useCalibration';
import { CALIBRATION_POINT_LABELS } from '../stores/floorplanBackgroundStore';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

const KEY = 'panels.floorplanBackground.calibration';
/** Ετικέτες των αναφορών, από τις ίδιες ετικέτες σημείων που ζωγραφίζει ο καμβάς. */
const [PA, PB, PC, PD] = CALIBRATION_POINT_LABELS;
const REFERENCE_LABELS = [`${PA}–${PB}`, `${PC}–${PD}`] as const;

// ── Known-length field ────────────────────────────────────────────────────────

interface ReferenceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly draft: CalibrationLengthDraft;
  readonly onChange: (next: CalibrationLengthDraft) => void;
  readonly t: Translate;
}

export function CalibrationReferenceField({ id, label, draft, onChange, t }: ReferenceFieldProps) {
  return (
    <fieldset className="flex items-center gap-3">
      <Label htmlFor={id} className="shrink-0 text-sm">{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft.text}
        onChange={(e) => onChange({ ...draft, text: e.target.value })}
        className="flex-1"
        placeholder={t(`${KEY}.realDistPlaceholder`)}
      />
      <Select
        value={draft.unit}
        onValueChange={(v) => { if (isCalibrationUnit(v)) onChange({ ...draft, unit: v }); }}
      >
        <SelectTrigger className="w-20" aria-label={t(`${KEY}.unit`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CALIBRATION_UNITS.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}

// ── Optional second reference ─────────────────────────────────────────────────

interface SecondReferenceProps {
  /** Ζητήθηκε δεύτερο μήκος (η συνεδρία έχει στόχο 4 σημεία). */
  readonly active: boolean;
  readonly draft: CalibrationLengthDraft;
  readonly onChange: (next: CalibrationLengthDraft) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly t: Translate;
}

export function CalibrationSecondReference({ active, draft, onChange, onAdd, onRemove, t }: SecondReferenceProps) {
  if (!active) {
    return (
      <aside className="space-y-1">
        <Button variant="outline" size="sm" onClick={onAdd}>{t(`${KEY}.addSecond`)}</Button>
        <p className="text-xs text-muted-foreground">{t(`${KEY}.addSecondHint`)}</p>
      </aside>
    );
  }
  return (
    <>
      <CalibrationReferenceField id="cal-length-2" label={t(`${KEY}.referenceSecond`)} draft={draft} onChange={onChange} t={t} />
      <Button variant="ghost" size="sm" onClick={onRemove}>{t(`${KEY}.removeSecond`)}</Button>
    </>
  );
}

// ── Align-to-axis toggle ──────────────────────────────────────────────────────

interface AlignToggleProps {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly t: Translate;
}

/** Περιστροφή ώστε η πρώτη αναφορά να γίνει οριζόντια ή κατακόρυφη — ό,τι είναι πλησιέστερο. */
export function CalibrationAlignToggle({ checked, onChange, t }: AlignToggleProps) {
  return (
    <fieldset className="flex items-center gap-2">
      <Checkbox id="cal-align-axis" checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor="cal-align-axis" className="text-sm cursor-pointer">{t(`${KEY}.deriveRotation`)}</Label>
    </fieldset>
  );
}

// ── Solution summary ──────────────────────────────────────────────────────────

const pct = (rel: number): string => formatNumber(Math.abs(rel) * 100, { maximumFractionDigits: 2 });
const mm = (value: number): string => formatNumber(value, { maximumFractionDigits: 3 });

export function CalibrationSummary({ preview, t }: { readonly preview: CalibrationPreview; readonly t: Translate }) {
  if (preview.status === 'incomplete') return null;
  if (preview.status === 'failed') {
    return <output role="alert" className="block text-sm text-destructive">{t(`${KEY}.failure.${preview.reason}`)}</output>;
  }
  const { solution } = preview;
  const review = calibrationNeedsReview(solution);
  const ToneIcon = review ? AlertTriangle : CheckCircle2;
  return (
    <section className="space-y-1 text-sm" aria-live="polite">
      <p className="font-medium">
        {solution.mode === 'per-axis'
          ? t(`${KEY}.previewPerAxis`, { x: mm(solution.mmPerPixelX), y: mm(solution.mmPerPixelY) })
          : t(`${KEY}.preview`, { mm: mm(solution.mmPerPixelX) })}
      </p>
      {solution.mode === 'per-axis' && <p>{t(`${KEY}.anisotropy`, { pct: pct(solution.anisotropyRel) })}</p>}
      {solution.residualsRel.length > 1 && (
        <ul className="list-none">
          {solution.residualsRel.map((r, i) => (
            <li key={REFERENCE_LABELS[i]}>{t(`${KEY}.residual`, { label: REFERENCE_LABELS[i], pct: pct(r) })}</li>
          ))}
        </ul>
      )}
      {solution.residualsRel.length > 1 && (
        <p className={review ? 'flex items-center gap-1 text-destructive' : 'flex items-center gap-1'}>
          <ToneIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t(review ? `${KEY}.reviewWarning` : `${KEY}.reviewOk`)}
        </p>
      )}
    </section>
  );
}
