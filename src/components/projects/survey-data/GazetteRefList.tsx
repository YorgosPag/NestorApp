/**
 * @related ADR-759 §4.2 rule 1 / Q3 — the ΦΕΚ references of one institutional act
 *
 * 🔴 WHY THIS IS ITS OWN CONTROL AND NOT `SourcedFieldRow`. A `GazetteRef` is a
 * **value object**, not a sourced value: it has no provenance of its own (the act
 * that owns it carries that), its `rawText` is a required `string` rather than a
 * nullable one, and its `relation` is a choice from a closed set. Rendering it
 * through the sourced-field editor would print *"blank in the drawing"* over a field
 * that is required — the wrong sentence, with no type error to catch it.
 *
 * 🔴 `relation` IS NEVER PRE-SELECTED. ADR-759 Q3: the G753 sample carries exactly
 * one correction chain, and one sample is not a class. The select therefore opens on
 * «Δεν δηλώνεται» and only an explicit human choice writes anything. The Φ4 reader
 * must leave it alone and let `rawText` carry the chain.
 */
'use client';

import { Trash2, Plus } from 'lucide-react';
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GazetteFieldAccessor, GazetteSubList } from '@/config/survey-list-config';
import type { GazetteRelation, SurveyRecord } from '@/types/project-survey-record';
import { surveyFieldDomId } from './SourcedFieldRow';

/**
 * Sentinel for "no relation stated". Radix Select cannot hold an empty string as an
 * item value, so the project's convention (`FloorSelectField`) is a marker string
 * that is mapped back to `null` at the boundary — the stored value stays `null`.
 */
const NO_RELATION = '__none__';

/** The closed set, in the order a correction chain actually happens. */
const RELATION_OPTIONS: readonly { readonly value: GazetteRelation; readonly labelKey: string }[] =
  [
    { value: 'original', labelKey: 'gazette.relationOriginal' },
    { value: 'correction', labelKey: 'gazette.relationCorrection' },
    { value: 'revision', labelKey: 'gazette.relationRevision' },
  ];

interface GazetteRefListProps {
  readonly record: SurveyRecord;
  readonly gazettes: GazetteSubList;
  readonly actIndex: number;
  /** Row identity of the owning act — keeps DOM ids unique across acts. */
  readonly actScope: string;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
}

export function GazetteRefList({
  record,
  gazettes,
  actIndex,
  actScope,
  isEditing,
  onChange,
}: GazetteRefListProps) {
  const { t } = useTranslation('surveyRecord');
  const count = gazettes.count(record, actIndex);

  return (
    <section className="mt-3 border-l-2 pl-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h6 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(gazettes.titleKey)}
        </h6>
        {isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            onClick={() => onChange(gazettes.appendRow(record, actIndex))}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {t(gazettes.addKey)}
          </Button>
        ) : null}
      </header>

      {count === 0 ? (
        // Empty is shown, never hidden — ADR-759 §4.2 rule 3.
        <p className="text-xs text-muted-foreground italic">{t(gazettes.emptyKey)}</p>
      ) : (
        <ul className="space-y-3">
          {Array.from({ length: count }, (_unused, gazetteIndex) => (
            <li key={`${actScope}-gazette-${gazetteIndex}`} className="space-y-1.5">
              <GazetteRow
                record={record}
                fields={gazettes.fields(actIndex, gazetteIndex)}
                scope={`${actScope}-g${gazetteIndex}`}
                isEditing={isEditing}
                onChange={onChange}
                onRemove={() => onChange(gazettes.removeRow(record, actIndex, gazetteIndex))}
                removeLabel={t(gazettes.removeKey)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface GazetteRowProps {
  readonly record: SurveyRecord;
  readonly fields: readonly GazetteFieldAccessor[];
  readonly scope: string;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
  readonly onRemove: () => void;
  readonly removeLabel: string;
}

function GazetteRow({
  record,
  fields,
  scope,
  isEditing,
  onChange,
  onRemove,
  removeLabel,
}: GazetteRowProps) {
  return (
    <article className="rounded-md border p-2 space-y-2">
      {fields.map((field) => (
        <GazetteField
          key={field.labelKey}
          record={record}
          field={field}
          scope={scope}
          isEditing={isEditing}
          onChange={onChange}
        />
      ))}
      {isEditing ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1 text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          {removeLabel}
        </Button>
      ) : null}
    </article>
  );
}

function GazetteField({
  record,
  field,
  scope,
  isEditing,
  onChange,
}: {
  readonly record: SurveyRecord;
  readonly field: GazetteFieldAccessor;
  readonly scope: string;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
}) {
  const { t } = useTranslation('surveyRecord');
  const inputId = surveyFieldDomId(field.labelKey, scope);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs font-medium">
        {t(field.labelKey)}
      </Label>
      {renderControl()}
      {field.hintKey ? (
        <p className="text-xs text-muted-foreground">{t(field.hintKey)}</p>
      ) : null}
    </div>
  );

  function renderControl() {
    switch (field.kind) {
      case 'text': {
        const value = field.read(record);
        if (!isEditing) return <ReadOnlyText value={value} />;
        return (
          <Input
            id={inputId}
            value={value}
            required={field.required}
            aria-required={field.required}
            onChange={(e) => onChange(field.write(record, e.target.value))}
          />
        );
      }

      case 'relation': {
        const value = field.read(record);
        if (!isEditing) {
          return (
            <ReadOnlyText
              value={value === null ? t('gazette.relationNone') : t(relationLabelKey(value))}
            />
          );
        }
        return (
          <Select
            value={value ?? NO_RELATION}
            onValueChange={(next) =>
              onChange(field.write(record, next === NO_RELATION ? null : toRelation(next)))
            }
          >
            <SelectTrigger id={inputId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* The default. Nothing is ever inferred into this field. */}
              <SelectItem value={NO_RELATION}>{t('gazette.relationNone')}</SelectItem>
              {RELATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      default: {
        // Adding a gazette field kind to the config without adding a control here
        // must not silently render nothing.
        const never: never = field;
        return <>{String(never)}</>;
      }
    }
  }
}

/** `''` reads as "not stated" — the same fact the sourced fields spell out. */
function ReadOnlyText({ value }: { readonly value: string }) {
  const { t } = useTranslation('surveyRecord');
  if (value === '') {
    return <p className="text-sm text-muted-foreground italic">{t('provenance.empty')}</p>;
  }
  return <p className="text-sm whitespace-pre-wrap">{value}</p>;
}

function relationLabelKey(relation: GazetteRelation): string {
  switch (relation) {
    case 'original':
      return 'gazette.relationOriginal';
    case 'correction':
      return 'gazette.relationCorrection';
    case 'revision':
      return 'gazette.relationRevision';
    default: {
      const never: never = relation;
      throw new Error(`relationLabelKey: unhandled relation ${String(never)}`);
    }
  }
}

/**
 * Narrow a select value back to the union without a cast (N.2).
 *
 * The select can only emit values this file put in it, so an unknown string means
 * the option list and this function disagree — which is a bug, not user input, and
 * `null` is the honest answer rather than a wrong relation stored as fact.
 */
function toRelation(value: string): GazetteRelation | null {
  const match = RELATION_OPTIONS.find((option) => option.value === value);
  return match?.value ?? null;
}
