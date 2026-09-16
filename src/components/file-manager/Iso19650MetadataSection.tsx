/**
 * =============================================================================
 * Iso19650MetadataSection — Manual override UI for ISO 19650 FileRecord fields
 * =============================================================================
 *
 * Collapsible panel rendered inside FilePreviewPanel.
 *
 * **ΤΕΣΣΕΡΑ επεξεργάσιμα** πεδία ταξινόμησης (`disciplineCode` · `documentSeries` ·
 * `revisionCode` · `buildingCode`) + σήμα προέλευσης AI/χειροκίνητης διόρθωσης.
 *
 * 🔴 **ΔΥΟ πεδία είναι ΜΟΝΟ ΑΝΑΓΝΩΣΗΣ** (ADR-862 Φ0 Β3):
 *   • `cdeState` — **φρουρεί** (ADR-787 Κ-4) και αλλάζει **μόνο** με ονομασμένη
 *     πράξη (AIP-216). Όσο ήταν `<Select>`, ο φρουρός άνοιγε **με ένα κλικ**.
 *   • `suitabilityCode` — **παράγεται** από την κατάσταση (ISO 19650 §6.1
 *     «fixed relationships»), δεν δηλώνεται χωριστά.
 *
 * ⚠️ Το docblock έλεγε «6 metadata fields» και θα έλεγε **ψέματα** μετά τη Φ0 —
 * ίδιο σχήμα με το σχόλιο του `UserRoleContext` που το ADR-801 καταγράφει ως
 * *«η περιγραφή της διόρθωσης ΗΤΑΝ η απόκλιση»*.
 *
 * On save: calls updateIso19650MetadataWithPolicy → writes iso19650Source.overriddenBy.
 * Does NOT re-trigger AI enricher.
 *
 * @module components/file-manager/Iso19650MetadataSection
 * @see ADR-373 §P2.1 · ADR-862 Φ0
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ADR-862 Φ0 Β3 — μένουν ΜΟΝΟ τα δύο επεξεργάσιμα λεξιλόγια.
//   • έφυγαν `CDE_STATE_VALUES` / `SUITABILITY_CODE_VALUES` / `CdeState` /
//     `SuitabilityCode`: τα δύο `<Select>` τους έγιναν **ενδείξεις**·
//   • έφυγαν και `DISCIPLINE_CODES` / `DOCUMENT_SERIES` / `CDE_STATES` /
//     `SUITABILITY_CODES`, που ήταν **ήδη πριν τη Φ0** αχρησιμοποίητα —
//     **μετρημένο** με grep, όχι υποτιθέμενο (N.0.2 Boy Scout).
import {
  DISCIPLINE_CODE_VALUES,
  DOCUMENT_SERIES_VALUES,
  type DisciplineCode,
  type DocumentSeries,
} from '@/config/iso19650-constants';
import { validateRevisionCode, validateBuildingCode } from '@/services/iso19650/validators';
import { updateIso19650MetadataWithPolicy, type Iso19650MetadataUpdate } from '@/services/filesystem/file-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('Iso19650MetadataSection');

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  file: FileRecord;
  currentUserId: string;
  onFileUpdated?: () => void;
}

// ============================================================================
// SOURCE BADGE — reads iso19650Source.filledBy
// ============================================================================

function SourceBadge({ file, t }: { file: FileRecord; t: ReturnType<typeof useTranslation>['t'] }) {
  const source = file.iso19650Source;
  if (!source) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('iso19650:labels.noClassification')}
      </span>
    );
  }

  if (source.filledBy === 'ai') {
    const pct = source.aiConfidence != null ? Math.round(source.aiConfidence * 100) : null;
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span>🤖 {t('iso19650:labels.aiClassified')}</span>
        {pct != null && (
          <span className="text-xs opacity-70">{pct}%</span>
        )}
      </span>
    );
  }

  if (source.filledBy === 'user') {
    return (
      <span className="text-xs text-muted-foreground">
        ✏️ {t('iso19650:labels.manualOverride')}
      </span>
    );
  }

  if (source.filledBy === 'derived') {
    return (
      <span className="text-xs text-muted-foreground">
        {t('iso19650:labels.derivedLabel')}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {t('iso19650:labels.noClassification')}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Iso19650MetadataSection({ file, currentUserId, onFileUpdated }: Props) {
  const { t } = useTranslation(['iso19650']);

  const [draft, setDraft] = useState<Iso19650MetadataUpdate>({
    disciplineCode: file.disciplineCode ?? null,
    documentSeries: file.documentSeries ?? null,
    revisionCode: file.revisionCode ?? null,
    buildingCode: file.buildingCode ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [revisionError, setRevisionError] = useState('');
  const [buildingError, setBuildingError] = useState('');

  const hasChanges = useMemo(() => {
    return (
      (draft.disciplineCode ?? null) !== (file.disciplineCode ?? null) ||
      (draft.documentSeries ?? null) !== (file.documentSeries ?? null) ||
      (draft.revisionCode ?? null) !== (file.revisionCode ?? null) ||
      (draft.buildingCode ?? null) !== (file.buildingCode ?? null)
    );
  }, [draft, file]);

  const hasErrors = revisionError !== '' || buildingError !== '';

  function handleRevisionChange(value: string) {
    setDraft(d => ({ ...d, revisionCode: value || null }));
    if (value && !validateRevisionCode(value)) {
      setRevisionError(t('iso19650:errors.invalidRevisionCode'));
    } else {
      setRevisionError('');
    }
  }

  function handleBuildingChange(value: string) {
    setDraft(d => ({ ...d, buildingCode: value || null }));
    if (value && !validateBuildingCode(value)) {
      setBuildingError(t('iso19650:errors.invalidBuildingCode'));
    } else {
      setBuildingError('');
    }
  }

  async function handleSave() {
    if (!hasChanges || hasErrors || saving) return;
    setSaving(true);
    try {
      await updateIso19650MetadataWithPolicy(file.id, draft, currentUserId);
      setSavedAt(new Date());
      onFileUpdated?.();
    } catch (err) {
      logger.error('ISO 19650 metadata save failed', { fileId: file.id, error: err });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="px-3 py-2.5 space-y-3">
      {/* Header: badge + save button */}
      <div className="flex items-center justify-between gap-2">
        <SourceBadge file={file} t={t} />
        <div className="flex items-center gap-1.5">
          {savedAt && !hasChanges && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('iso19650:labels.saved')}
            </span>
          )}
          <Button
            size="sm"
            variant="default"
            disabled={!hasChanges || hasErrors || saving}
            onClick={handleSave}
            className="h-7 text-xs px-3"
          >
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t('iso19650:labels.saving')}</>
            ) : (
              t('iso19650:labels.saveChanges')
            )}
          </Button>
        </div>
      </div>

      {/* 2-column grid of fields */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">

        {/* disciplineCode */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.disciplineCode')}</Label>
          <Select
            value={draft.disciplineCode ?? ''}
            onValueChange={v => setDraft(d => ({ ...d, disciplineCode: (v as DisciplineCode) || null }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('iso19650:labels.select')} />
            </SelectTrigger>
            <SelectContent>
              {DISCIPLINE_CODE_VALUES.map(code => (
                <SelectItem key={code} value={code} className="text-xs">
                  {code} — {t(`iso19650:discipline.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* documentSeries */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.documentSeries')}</Label>
          <Select
            value={draft.documentSeries != null ? String(draft.documentSeries) : ''}
            onValueChange={v => setDraft(d => ({ ...d, documentSeries: v ? (Number(v) as DocumentSeries) : null }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('iso19650:labels.select')} />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_SERIES_VALUES.map(series => (
                <SelectItem key={series} value={String(series)} className="text-xs">
                  {series} — {t(`iso19650:documentSeries.${series}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* suitabilityCode — ΠΑΡΑΓΟΜΕΝΟ (ADR-862 Φ0 Β3), ποτέ επιλογή */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.suitabilityCode')}</Label>
          <p className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {file.suitabilityCode
                ? t(`iso19650:suitabilityCode.${file.suitabilityCode}`)
                : t('iso19650:labels.cdeStateUndeclared')}
            </span>
            <span className="opacity-70">{t('iso19650:labels.suitabilityDerived')}</span>
          </p>
        </div>

        {/* cdeState — ΠΡΑΞΗ, ΟΧΙ ΠΕΔΙΟ (ADR-862 Φ0 Β3 · AIP-216) */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.cdeState')}</Label>
          <p className="flex h-8 items-center text-xs text-muted-foreground">
            {file.cdeState
              ? t(`iso19650:cdeState.${file.cdeState}`)
              : t('iso19650:labels.cdeStateUndeclared')}
          </p>
          <p className="text-[0.65rem] leading-tight text-muted-foreground opacity-70">
            {t('iso19650:labels.cdeStateReadOnly')}
          </p>
        </div>

        {/* revisionCode */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.revisionCode')}</Label>
          <Input
            className={cn('h-8 text-xs', revisionError && 'border-destructive')}
            value={draft.revisionCode ?? ''}
            placeholder={t('iso19650:placeholder.revisionCode')}
            onChange={e => handleRevisionChange(e.target.value)}
          />
          {revisionError && (
            <p className="text-xs text-destructive">{revisionError}</p>
          )}
        </div>

        {/* buildingCode */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.buildingCode')}</Label>
          <Input
            className={cn('h-8 text-xs', buildingError && 'border-destructive')}
            value={draft.buildingCode ?? ''}
            placeholder={t('iso19650:placeholder.buildingCode')}
            onChange={e => handleBuildingChange(e.target.value)}
          />
          {buildingError && (
            <p className="text-xs text-destructive">{buildingError}</p>
          )}
        </div>

      </div>

      {/* AI reasoning (read-only, shown only if present) */}
      {file.iso19650Source?.aiReasoning && (
        <p className="text-xs text-muted-foreground italic border-t pt-2">
          <span className="font-medium not-italic">{t('iso19650:labels.aiReasoning')}:</span>{' '}
          {file.iso19650Source.aiReasoning}
        </p>
      )}
    </section>
  );
}
