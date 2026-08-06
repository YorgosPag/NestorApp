/**
 * @related ADR-759 §4.3 — the «Στοιχεία Τοπογραφικού» project tab
 *
 * Φ2 is MANUAL entry (ADR-759 §6). Nothing here reads a DXF; landing the values the
 * reader already produces is Φ3, and reading outside the title block is Φ4. Building
 * the card first is deliberate: Φ4 before Φ2 would emit ~40 suggestions with nowhere
 * to go, multiplying the very problem §2.2 documents instead of solving it.
 */
'use client';

import { useMemo, useState } from 'react';
import { FilePlus2, Lock, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSurveyRecords } from '@/hooks/useSurveyRecords';
import type { SurveyCardSection } from '@/config/survey-card-config';
import { SURVEY_CARD_ORDER, type SurveyCardEntry } from '@/config/survey-card-order';
import type { SurveyListSection as SurveyListSectionConfig } from '@/config/survey-list-config';
import { compareSurveyToBuildingCode } from '@/lib/survey-record/survey-reconciliation';
import type { Project } from '@/types/project';
import type { SurveyRecord } from '@/types/project-survey-record';
import { SourcedFieldRow } from './SourcedFieldRow';
import { SurveyComparePanel } from './SurveyComparePanel';
import { SurveyDocumentSection } from './SurveyDocumentSection';
import { SurveyListSection } from './SurveyListSection';

interface SurveyDataTabProps {
  project?: Project | null;
  data?: Project | null;
}

export function SurveyDataTab({ project, data }: SurveyDataTabProps) {
  const projectData = project ?? data ?? null;
  const { t } = useTranslation('surveyRecord');
  const [isEditing, setIsEditing] = useState(false);

  const survey = useSurveyRecords(
    projectData?.id ?? null,
    projectData?.activeSurveyRecordId ?? null
  );

  const comparisons = useMemo(() => {
    const code = projectData?.buildingCode;
    if (!survey.current || !code) return [];
    return compareSurveyToBuildingCode(survey.current, code);
  }, [survey.current, projectData?.buildingCode]);

  const handleCancel = () => {
    survey.discardDraft();
    setIsEditing(false);
  };

  const handleSave = async () => {
    const ok = await survey.save();
    if (ok) setIsEditing(false);
  };

  return (
    <section className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('card.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('card.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {survey.current === null ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={survey.isSaving || !projectData}
              onClick={() => void survey.createBlank()}
            >
              <FilePlus2 className="h-4 w-4" aria-hidden />
              {t('card.emptyCta')}
            </Button>
          ) : isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={handleCancel}
                disabled={survey.isSaving}
              >
                <X className="h-4 w-4" aria-hidden />
                {t('actions.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleSave()}
                disabled={survey.isSaving || !survey.isDirty}
              >
                <Save className="h-4 w-4" aria-hidden />
                {survey.isSaving ? t('actions.saving') : t('actions.save')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditing(true)}
              disabled={survey.isFrozen}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {t('actions.edit')}
            </Button>
          )}
        </div>
      </header>

      <p className="text-sm text-muted-foreground">{t('card.explainer')}</p>

      {survey.current === null ? (
        <p className="text-sm text-muted-foreground">{t('card.empty')}</p>
      ) : (
        <>
          {survey.isFrozen ? (
            <Alert>
              <Lock className="h-4 w-4" aria-hidden />
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {t('header.frozenNotice')}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void survey.setConfirmed(false)}
                >
                  {t('header.unconfirm')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void survey.setConfirmed(true)}
            >
              {t('header.confirm')}
            </Button>
          )}

          {survey.draft !== null ? (
            <SurveyDocumentSection
              records={survey.records}
              current={survey.draft}
              activeId={projectData?.activeSurveyRecordId ?? null}
              disabled={survey.isSaving}
              onSelect={survey.select}
              onSetActive={(id) => void survey.setActive(id)}
            />
          ) : null}

          {comparisons.length > 0 ? (
            <SurveyComparePanel
              comparisons={comparisons}
              disabled={survey.isSaving}
              onDecide={(field, action, surveyValue) =>
                void survey.decide(field, action, surveyValue)
              }
            />
          ) : null}

          <SurveySections
            draft={survey.draft}
            isEditing={isEditing && !survey.isFrozen}
            onChange={survey.setDraft}
          />
        </>
      )}
    </section>
  );
}

/**
 * Sections Α–Ι, rendered from the order SSoT.
 *
 * ⚠️ The sequence is NOT written here. It lives in `SURVEY_CARD_ORDER`, because the
 * printed form interleaves scalar and repeating sections — Α′ sits between Α and Β —
 * and a sequence half in config and half in markup is a contract only half watched.
 * This function only knows how to draw each kind.
 *
 * Split out so the null-draft case is handled by an early return with a narrowed
 * type, instead of a non-null assertion inside the JSX.
 */
function SurveySections({
  draft,
  isEditing,
  onChange,
}: {
  readonly draft: SurveyRecord | null;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
}) {
  if (draft === null) return null;

  return (
    <>
      {SURVEY_CARD_ORDER.map((entry) => (
        <SurveyCardEntryView
          key={entryKey(entry)}
          entry={entry}
          draft={draft}
          isEditing={isEditing}
          onChange={onChange}
        />
      ))}
    </>
  );
}

/** Stable React key per entry, whatever its kind. */
function entryKey(entry: SurveyCardEntry): string {
  switch (entry.kind) {
    case 'scalar':
      return `scalar-${entry.section.id}`;
    case 'list':
      return `list-${entry.section.id}`;
    case 'listGroup':
      return `group-${entry.titleKey}`;
    default: {
      const never: never = entry;
      throw new Error(`entryKey: unhandled entry ${String(never)}`);
    }
  }
}

const SECTION_HEADING_CLASS = 'text-base font-semibold border-b pb-1';

/** What every entry renderer needs: the draft, whether it is editable, and the sink. */
interface EntryViewContext {
  readonly draft: SurveyRecord;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
}

function SurveyCardEntryView({
  entry,
  ...context
}: EntryViewContext & { readonly entry: SurveyCardEntry }) {
  switch (entry.kind) {
    case 'scalar':
      return <ScalarSectionView section={entry.section} {...context} />;

    case 'list':
      return (
        <SurveyListSection
          record={context.draft}
          section={entry.section}
          isEditing={context.isEditing}
          onChange={context.onChange}
        />
      );

    case 'listGroup':
      return <ListGroupView titleKey={entry.titleKey} sections={entry.sections} {...context} />;

    default: {
      // Adding an entry kind to the order SSoT without teaching the card to draw it
      // must not silently render nothing.
      const never: never = entry;
      return <>{String(never)}</>;
    }
  }
}

function ScalarSectionView({
  section,
  draft,
  isEditing,
  onChange,
}: EntryViewContext & { readonly section: SurveyCardSection }) {
  const { t } = useTranslation('surveyRecord');
  return (
    <section className="space-y-1">
      <h4 className={SECTION_HEADING_CLASS}>{t(section.titleKey)}</h4>
      {section.fields.map((field) => (
        <SourcedFieldRow
          key={field.labelKey}
          record={draft}
          field={field}
          isEditing={isEditing}
          onChange={onChange}
        />
      ))}
    </section>
  );
}

/**
 * Section Α′ — one heading over three named act groups.
 *
 * The groups render a heading level deeper, so the Α′ / group relationship is in the
 * document outline and not only in the spacing.
 */
function ListGroupView({
  titleKey,
  sections,
  draft,
  isEditing,
  onChange,
}: EntryViewContext & {
  readonly titleKey: string;
  readonly sections: readonly SurveyListSectionConfig[];
}) {
  const { t } = useTranslation('surveyRecord');
  return (
    <section className="space-y-3">
      <h4 className={SECTION_HEADING_CLASS}>{t(titleKey)}</h4>
      {sections.map((section) => (
        <SurveyListSection
          key={section.id}
          record={draft}
          section={section}
          isEditing={isEditing}
          onChange={onChange}
          headingLevel={5}
        />
      ))}
    </section>
  );
}

export default SurveyDataTab;
