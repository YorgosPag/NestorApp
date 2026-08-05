/**
 * @related ADR-759 §4.3.1 / Φ2β — THE ONE renderer for every repeating section
 *
 * Sections Α′, Η, Θ and Ι are lists. Written as four components they would be four
 * near-copies of "heading · add button · empty state · rows · remove button" — the
 * sibling clone N.18 exists to stop, and the one `ssot:discover` cannot see because
 * each copy would carry a different name. So it is written once and driven by
 * `SurveyListSection` from `survey-list-config`.
 *
 * 🔴 EMPTY IS RENDERED, NOT HIDDEN. ADR-759 §4.2 rule 3: the engineer must be able
 * to see **what is missing**. A section with no rows prints its `*.empty` line;
 * it never collapses to nothing, in edit mode or out of it.
 *
 * 🔴 IDENTITY IS MINTED IN THE HANDLER, NEVER IN RENDER. `section.appendRow` calls
 * `enterprise-id` (see `survey-list-rows.ts`). It is reached only from `onClick`.
 * If it ever moved into the render path, every frame would give the row a new id and
 * row identity would dissolve — React keys, input focus, and the notary link on a
 * deed all hang off it.
 */
'use client';

import dynamic from 'next/dynamic';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SurveyListSection as SurveyListSectionConfig } from '@/config/survey-list-config';
import type { SurveyRecord } from '@/types/project-survey-record';
import { GazetteRefList } from './GazetteRefList';
import { SourcedFieldRow } from './SourcedFieldRow';

/**
 * ⚠️ LAZY ON PURPOSE, AND IT IS NOT A MICRO-OPTIMISATION. The linked-contact control
 * searches contacts, so it imports `ContactsService` — which statically pulls
 * `services/realtime` → `firestore-query.service` → `firebase/auth` into whatever
 * imports it. Only ONE section of this card (Ι, the title deeds) has a linked
 * contact, and this component renders all of them; statically, every repeating
 * section would drag the auth and realtime graph into the projects bundle.
 *
 * The same shape was found in ADR-759 §4.5.1, where the contact dialog statically
 * dragged `maplibre-gl` into the DXF viewer bundle — and it was a **test** that
 * discovered it by failing to load, because a test asks the same question a bundler
 * does. `survey-list-section.test.tsx` is the anchor here for the same reason.
 */
const SurveyLinkedContactField = dynamic(
  () => import('./SurveyLinkedContactField').then((m) => m.SurveyLinkedContactField),
  { ssr: false }
);

interface SurveyListSectionProps {
  readonly record: SurveyRecord;
  readonly section: SurveyListSectionConfig;
  readonly isEditing: boolean;
  readonly onChange: (next: SurveyRecord) => void;
  /**
   * Heading level. The three act groups of section Α′ sit under one Α′ heading, so
   * they render a level deeper — an explicit level rather than relying on the HTML
   * outline algorithm, which assistive technology does not implement.
   */
  readonly headingLevel?: 4 | 5;
}

export function SurveyListSection({
  record,
  section,
  isEditing,
  onChange,
  headingLevel = 4,
}: SurveyListSectionProps) {
  const { t } = useTranslation('surveyRecord');
  const count = section.count(record);
  const Heading = headingLevel === 5 ? 'h5' : 'h4';
  const headingClass =
    headingLevel === 5
      ? 'text-sm font-semibold text-muted-foreground'
      : 'text-base font-semibold';

  return (
    <section className="space-y-2" data-section-id={section.id}>
      <header className="flex items-center justify-between gap-3 border-b pb-1">
        <Heading className={headingClass}>{t(section.titleKey)}</Heading>
        {isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="gap-1 shrink-0"
            onClick={() => onChange(section.appendRow(record))}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {t(section.addKey)}
          </Button>
        ) : null}
      </header>

      {count === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t(section.emptyKey)}</p>
      ) : (
        <ul className="space-y-3">
          {Array.from({ length: count }, (_unused, index) => {
            const rowKey = section.rowKey(record, index);
            return (
              <li key={rowKey} className="rounded-md border p-3">
                {section.rowFields(index).map((field) => (
                  <SourcedFieldRow
                    key={`${rowKey}-${field.labelKey}`}
                    record={record}
                    field={field}
                    isEditing={isEditing}
                    onChange={onChange}
                    idScope={rowKey}
                  />
                ))}

                {section.linkedContact ? (
                  <SurveyLinkedContactField
                    record={record}
                    field={section.linkedContact}
                    index={index}
                    scope={rowKey}
                    isEditing={isEditing}
                    onChange={onChange}
                  />
                ) : null}

                {section.gazettes ? (
                  <GazetteRefList
                    record={record}
                    gazettes={section.gazettes}
                    actIndex={index}
                    actScope={rowKey}
                    isEditing={isEditing}
                    onChange={onChange}
                  />
                ) : null}

                {isEditing ? (
                  <footer className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="gap-1 text-destructive"
                      onClick={() => onChange(section.removeRow(record, index))}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      {t(section.removeKey)}
                    </Button>
                  </footer>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
