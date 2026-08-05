/**
 * @related ADR-759 §4.2/§4.3 — the ONE editor for every scalar survey field
 *
 * The card has ~30 fields. This renders all of them, driven by `FieldAccessor` from
 * `survey-card-config`. Writing an editor per field would be ~30 near-identical
 * components — the sibling-clone shape N.18 exists to prevent.
 *
 * 🔴 EMPTY IS A STATE, NOT AN ABSENCE. ADR-759 §4.2 rule 3: `Παρέκκλιση`, `Σύστημα`
 * and `ΟΡΟΦΟΙ` are blank in the real drawing because the engineer does not have them
 * yet. Read-only mode therefore renders an explicit "blank in the drawing" marker
 * rather than hiding the row — the engineer has to be able to see what is missing.
 */
'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FieldAccessor } from '@/config/survey-card-config';
import { parseStrictDecimal } from '@/lib/survey-record/survey-number';
import { userSourced, type SurveyRecord } from '@/types/project-survey-record';

interface SourcedFieldRowProps {
  readonly record: SurveyRecord;
  readonly field: FieldAccessor;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
  /**
   * Disambiguates the input's DOM id when the same field appears more than once.
   *
   * Scalar fields are unique per card, so they need nothing. Repeating rows are not:
   * three approvals all render `approvals.authority`, and three inputs sharing one
   * `id` means every `<Label htmlFor>` points at the first one — the label stops
   * being a label for rows 2 and 3, silently, for screen readers and for clicks.
   * The list renderer passes the row's identity here.
   */
  readonly idScope?: string;
}

/**
 * The one rule for building a survey field's DOM id.
 *
 * Exported because the ΦΕΚ list and the notary control render their own inputs and
 * must produce ids by the same rule — two rules would eventually collide, and a
 * collision here is invisible: the page still renders, the `<Label>` just stops
 * pointing at the right input.
 */
export function surveyFieldDomId(labelKey: string, scope?: string): string {
  const base = labelKey.replace(/\./g, '-');
  return scope === undefined ? `survey-${base}` : `survey-${scope}-${base}`;
}

/** Multi-value fields are typed as a comma-separated list — matches how they read. */
const LIST_SEPARATOR = ', ';

function parseList(raw: string): readonly string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Number inputs accept the Greek decimal comma; `''` means "no value", not zero. */
const parseNumber = parseStrictDecimal;

export function SourcedFieldRow({
  record,
  field,
  isEditing,
  onChange,
  idScope,
}: SourcedFieldRowProps) {
  const { t } = useTranslation('surveyRecord');
  const inputId = surveyFieldDomId(field.labelKey, idScope);

  const label = (
    <Label htmlFor={inputId} className="text-sm font-medium">
      {t(field.labelKey)}
    </Label>
  );

  const hint = field.hintKey ? (
    <p className="text-xs text-muted-foreground">{t(field.hintKey)}</p>
  ) : null;

  return (
    <div className="space-y-1.5 py-2">
      {label}
      {renderControl()}
      {hint}
    </div>
  );

  function renderControl() {
    switch (field.kind) {
      case 'text': {
        const current = field.read(record);
        if (!isEditing) return <ReadOnlyValue text={current.value} />;
        const commit = (raw: string) =>
          onChange(field.write(record, userSourced<string>(raw === '' ? null : raw)));
        return field.multiline ? (
          <Textarea
            id={inputId}
            rows={3}
            value={current.value ?? ''}
            onChange={(e) => commit(e.target.value)}
          />
        ) : (
          <Input
            id={inputId}
            value={current.value ?? ''}
            onChange={(e) => commit(e.target.value)}
          />
        );
      }

      case 'number': {
        const current = field.read(record);
        if (!isEditing) {
          return <ReadOnlyValue text={current.value === null ? null : String(current.value)} />;
        }
        return (
          <Input
            id={inputId}
            inputMode="decimal"
            value={current.value === null ? '' : String(current.value)}
            onChange={(e) =>
              onChange(field.write(record, userSourced<number>(parseNumber(e.target.value))))
            }
          />
        );
      }

      case 'boolean': {
        const current = field.read(record);
        if (!isEditing) {
          return (
            <ReadOnlyValue
              text={current.value === null ? null : t(current.value ? 'actions.yes' : 'actions.no')}
            />
          );
        }
        return (
          <Checkbox
            id={inputId}
            checked={current.value === true}
            onCheckedChange={(checked) =>
              onChange(field.write(record, userSourced<boolean>(checked === true)))
            }
          />
        );
      }

      case 'textList': {
        const current = field.read(record);
        const joined = (current.value ?? []).join(LIST_SEPARATOR);
        if (!isEditing) return <ReadOnlyValue text={joined === '' ? null : joined} />;
        return (
          <Input
            id={inputId}
            value={joined}
            onChange={(e) => {
              const parsed = parseList(e.target.value);
              onChange(
                field.write(
                  record,
                  userSourced<readonly string[]>(parsed.length === 0 ? null : parsed),
                ),
              );
            }}
          />
        );
      }

      default: {
        // Exhaustiveness guard: adding a `kind` to the config union without adding
        // a control here must not silently render nothing.
        const never: never = field;
        return <>{String(never)}</>;
      }
    }
  }
}

/**
 * A value the engineer is only reading.
 *
 * `null` renders the explicit "blank in the drawing" marker — never an empty cell.
 * An empty cell reads as "there is nothing here"; the marker reads as "the drawing
 * does not say", which is the actual fact and is often the thing that matters.
 */
function ReadOnlyValue({ text }: { readonly text: string | null }) {
  const { t } = useTranslation('surveyRecord');
  if (text === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-sm text-muted-foreground italic">{t('provenance.empty')}</p>
        </TooltipTrigger>
        <TooltipContent>{t('provenance.emptyHint')}</TooltipContent>
      </Tooltip>
    );
  }
  return <p className="text-sm whitespace-pre-wrap">{text}</p>;
}
