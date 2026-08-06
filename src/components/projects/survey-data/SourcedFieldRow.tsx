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
import { surveyAffirmationLabel } from '@/config/survey-record-labels';
import { parseStrictDecimal } from '@/lib/survey-record/survey-number';
import { userSourced, type Sourced, type SurveyRecord } from '@/types/project-survey-record';

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
        if (!isEditing) return <ReadOnlyValue text={current.value} source={current} />;
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
          return (
            <ReadOnlyValue
              text={current.value === null ? null : String(current.value)}
              source={current}
            />
          );
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
              // SSoT (ADR-759 Φ4β): η **ίδια** λέξη που δείχνει η παλέτα σύνδεσης στο «→ …»
              // πριν την έγκριση. Δύο κυριολεκτικά κλειδιά σε δύο οθόνες θα απέκλιναν.
              text={current.value === null ? null : surveyAffirmationLabel(current.value, t)}
              source={current}
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
        if (!isEditing) return <ReadOnlyValue text={joined === '' ? null : joined} source={current} />;
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
 * A value the engineer is only reading — in **three** states, not two (ADR-759 Φ3γ).
 *
 * 🔴 THE THIRD STATE IS THE NEW ONE, AND IT IS NOT COSMETIC. A value can be read from
 * the drawing and still fail to parse: the title block says «ΙΟΥΛΙΟΣ 2026» and
 * `surveyDate` is an ISO date. Before this, that landed in the first state and the card
 * printed *"blank in the drawing"* — which is **false**: the drawing said something, we
 * just could not turn it into a date. Showing the verbatim text instead is what makes
 * `Sourced.rawText` worth storing at all (ADR-745 §8 rule 3: the parse may be wrong,
 * the original never is).
 *
 * | state | renders |
 * |---|---|
 * | value present | the value, plus the origin marker when it came from a drawing |
 * | value `null`, `rawText` present | **the drawing's own words**, marked as unparsed |
 * | value `null`, no `rawText` | «blank in the drawing» — nobody has said anything |
 *
 * The origin marker answers the §5.3 question — *"in six months, who wrote this?"* — at
 * the only moment it can be asked, which is while looking at the field.
 */
function ReadOnlyValue({
  text,
  source,
}: {
  readonly text: string | null;
  readonly source: Sourced<unknown>;
}) {
  const { t } = useTranslation('surveyRecord');

  if (text !== null) {
    return (
      <p className="text-sm whitespace-pre-wrap">
        {text}
        <OriginMarker source={source} />
      </p>
    );
  }

  if (source.rawText !== undefined && source.rawText.trim() !== '') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {source.rawText}
            <OriginMarker source={source} />
          </p>
        </TooltipTrigger>
        <TooltipContent>{t('provenance.rawText')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="text-sm text-muted-foreground italic">{t('provenance.empty')}</p>
      </TooltipTrigger>
      <TooltipContent>{t('provenance.emptyHint')}</TooltipContent>
    </Tooltip>
  );
}

/**
 * «Από το σχέδιο» — shown only for `'survey'`.
 *
 * Deliberately silent for `'user'`: a marker on every hand-typed field would be noise on
 * ~30 rows, and noise is what trains the engineer to stop reading (ADR-759 §5.8). The
 * interesting fact is the *exception* — a value this person did not type.
 */
function OriginMarker({ source }: { readonly source: Sourced<unknown> }) {
  const { t } = useTranslation('surveyRecord');
  if (source.provenance !== 'survey') return null;
  return (
    <span className="ml-2 align-middle text-xs text-muted-foreground">
      {t('provenance.survey')}
    </span>
  );
}
