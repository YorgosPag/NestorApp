/**
 * @related ADR-759 §4.1 + Q5 — the two values, side by side
 *
 * 🔴 THE RULE THIS COMPONENT ENFORCES: nothing copies itself. The survey column is
 * read-only; the project column changes only when the engineer presses a button that
 * names what it does. ADR-759 §4.1 — and §5.2, "no copy without an explicit
 * per-field adoption".
 *
 * Three actions, mirroring Revit's Coordination Review: adopt the linked value,
 * accept the difference, or leave it. "Accept the difference" is not politeness — it
 * is what stops a judged difference from reappearing as unresolved forever, which is
 * how a review surface trains people to ignore it (ADR-759 §5.8).
 */
'use client';

import { ArrowRight, Check, Equal, Minus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  isActionable,
  type FieldComparison,
} from '@/lib/survey-record/survey-reconciliation';
import type { ReconcilableField, ReconciliationAction } from '@/types/project-survey-record';

interface SurveyComparePanelProps {
  readonly comparisons: readonly FieldComparison[];
  readonly disabled: boolean;
  readonly onDecide: (
    field: ReconcilableField,
    action: ReconciliationAction,
    surveyValue: number | null
  ) => void;
}

export function SurveyComparePanel({
  comparisons,
  disabled,
  onDecide,
}: SurveyComparePanelProps) {
  const { t } = useTranslation('surveyRecord');

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h4 className="text-base font-semibold">{t('compare.title')}</h4>
        <p className="text-sm text-muted-foreground">{t('compare.explainer')}</p>
      </header>

      <ul className="divide-y rounded-lg border">
        {comparisons.map((comparison) => (
          <li key={comparison.field} className="p-3">
            <ComparisonRow
              comparison={comparison}
              disabled={disabled}
              onDecide={onDecide}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComparisonRow({
  comparison,
  disabled,
  onDecide,
}: {
  readonly comparison: FieldComparison;
  readonly disabled: boolean;
  readonly onDecide: SurveyComparePanelProps['onDecide'];
}) {
  const { t } = useTranslation('surveyRecord');
  const fieldLabel = t(`compare.fields.${comparison.field}`);
  const actionable = isActionable(comparison.state) && !disabled;

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
      <ValueCell
        caption={t('compare.surveyValue')}
        text={comparison.surveyText}
        emptyText={t('compare.noSurveyValue')}
      />

      <span className="hidden sm:block text-muted-foreground" aria-hidden>
        <Minus className="h-4 w-4" />
      </span>

      <ValueCell caption={t('compare.projectValue')} text={String(comparison.projectValue)} />

      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <StateBadge state={comparison.state} />
        {actionable ? (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="gap-1"
              aria-label={t('compare.adoptAria', { field: fieldLabel })}
              onClick={() => onDecide(comparison.field, 'adopted', comparison.surveyValue)}
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              {t('compare.adopt')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              aria-label={t('compare.keepOursAria', { field: fieldLabel })}
              onClick={() => onDecide(comparison.field, 'kept-ours', comparison.surveyValue)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t('compare.keepOurs')}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="sm:col-span-4 text-xs font-medium text-muted-foreground">{fieldLabel}</p>

      {comparison.state === 'reopened' ? (
        <p className="sm:col-span-4 flex items-center gap-1.5 text-xs text-[hsl(var(--text-warning))]">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('compare.reopened')}
        </p>
      ) : null}
    </div>
  );
}

function ValueCell({
  caption,
  text,
  emptyText,
}: {
  readonly caption: string;
  readonly text: string | null;
  readonly emptyText?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{caption}</p>
      {text === null ? (
        <p className="text-sm italic text-muted-foreground">{emptyText}</p>
      ) : (
        <p className="text-sm font-medium">{text}</p>
      )}
    </div>
  );
}

/**
 * One badge per state, exhaustively.
 *
 * ADR-759 §2.2 is the cautionary tale: three different causes rendered as two
 * identical messages, leaving the engineer unable to tell "not supported" from
 * "not wired up". Every state here gets its own words.
 */
function StateBadge({ state }: { readonly state: FieldComparison['state'] }) {
  const { t } = useTranslation('surveyRecord');

  switch (state) {
    case 'identical':
      return (
        <Badge variant="outline" className="gap-1">
          <Equal className="h-3 w-3" aria-hidden />
          {t('compare.identical')}
        </Badge>
      );
    case 'no-survey-value':
      return <Badge variant="outline">{t('compare.noSurveyValue')}</Badge>;
    case 'not-comparable':
      return <Badge variant="outline">{t('provenance.rawText')}</Badge>;
    case 'undecided':
      return <Badge variant="secondary">{t('compare.undecided')}</Badge>;
    case 'adopted':
      return <Badge>{t('compare.adopted')}</Badge>;
    case 'kept-ours':
      return <Badge variant="secondary">{t('compare.keptOurs')}</Badge>;
    case 'reopened':
      return <Badge variant="destructive">{t('compare.undecided')}</Badge>;
    default: {
      const never: never = state;
      return <>{String(never)}</>;
    }
  }
}
