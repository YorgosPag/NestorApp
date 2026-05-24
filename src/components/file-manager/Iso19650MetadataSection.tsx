/**
 * =============================================================================
 * Iso19650MetadataSection — Manual override UI for ISO 19650 FileRecord fields
 * =============================================================================
 *
 * Collapsible panel rendered inside FilePreviewPanel. Shows the 6 ISO 19650
 * metadata fields (disciplineCode, documentSeries, revisionCode, suitabilityCode,
 * cdeState, buildingCode) + an AI/manual source badge.
 *
 * On save: calls updateIso19650MetadataWithPolicy → writes iso19650Source.overriddenBy.
 * Does NOT re-trigger AI enricher.
 *
 * @module components/file-manager/Iso19650MetadataSection
 * @see ADR-373 §P2.1
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
import {
  DISCIPLINE_CODES,
  DOCUMENT_SERIES,
  CDE_STATES,
  SUITABILITY_CODES,
  DISCIPLINE_CODE_VALUES,
  DOCUMENT_SERIES_VALUES,
  CDE_STATE_VALUES,
  SUITABILITY_CODE_VALUES,
  type DisciplineCode,
  type DocumentSeries,
  type CdeState,
  type SuitabilityCode,
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
    suitabilityCode: file.suitabilityCode ?? null,
    cdeState: file.cdeState ?? null,
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
      (draft.suitabilityCode ?? null) !== (file.suitabilityCode ?? null) ||
      (draft.cdeState ?? null) !== (file.cdeState ?? null) ||
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

        {/* suitabilityCode */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.suitabilityCode')}</Label>
          <Select
            value={draft.suitabilityCode ?? ''}
            onValueChange={v => setDraft(d => ({ ...d, suitabilityCode: (v as SuitabilityCode) || null }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('iso19650:labels.select')} />
            </SelectTrigger>
            <SelectContent>
              {SUITABILITY_CODE_VALUES.map(code => (
                <SelectItem key={code} value={code} className="text-xs">
                  {code} — {t(`iso19650:suitabilityCode.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* cdeState */}
        <div className="space-y-1">
          <Label className="text-xs">{t('iso19650:labels.cdeState')}</Label>
          <Select
            value={draft.cdeState ?? ''}
            onValueChange={v => setDraft(d => ({ ...d, cdeState: (v as CdeState) || null }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('iso19650:labels.select')} />
            </SelectTrigger>
            <SelectContent>
              {CDE_STATE_VALUES.map(state => (
                <SelectItem key={state} value={state} className="text-xs">
                  {t(`iso19650:cdeState.${state}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
