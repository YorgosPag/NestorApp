/**
 * @related ADR-186 §8 Q7 — Inline error/warning display per field
 *
 * Renders the first error and the first warning targeting a given field.
 * Material Design pattern: inline, beneath the input, color-coded.
 */
'use client';

import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  BuildingCodeValidationResult,
  ValidationIssue,
} from '@/types/project-building-code';

interface FieldIssuesProps {
  field: ValidationIssue['field'];
  validation: BuildingCodeValidationResult;
}

function findFirst(
  issues: readonly ValidationIssue[],
  field: ValidationIssue['field'],
): ValidationIssue | undefined {
  return issues.find((issue) => issue.field === field);
}

export function FieldIssues({ field, validation }: FieldIssuesProps) {
  const { t } = useTranslation('buildingCode');

  const error = findFirst(validation.errors, field);
  const warning = findFirst(validation.warnings, field);

  if (!error && !warning) return null;

  return (
    <div className="mt-1 space-y-1">
      {error && (
        <p className="text-xs text-destructive flex items-start gap-1" role="alert">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>{t(error.i18nKey)}</span>
        </p>
      )}
      {warning && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>{t(warning.i18nKey)}</span>
        </p>
      )}
    </div>
  );
}

interface SummaryProps {
  validation: BuildingCodeValidationResult;
}

export function ValidationSummary({ validation }: SummaryProps) {
  const { t } = useTranslation('buildingCode');
  if (validation.errors.length === 0) return null;
  return (
    <p className="text-xs text-destructive" role="status">
      {t('validation.summary.blocked')}
    </p>
  );
}
