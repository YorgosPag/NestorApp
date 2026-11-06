'use client';

/**
 * **Ο επεξεργαστής προτύπου ειδικότητας** (ADR-928 §5.22 · Φ3γ-0b-2): γραμμή εργαλείων · λωρίδα σύγκρουσης · φόρμα |
 * δείγμα εγγράφου.
 *
 * 🔑 Τα κοινά του επεξεργαστή συμφωνητικού (`EditorToolbar` · `ConflictBanner` · `EditorSplitLayout`).
 * 🔑 Η προεπισκόπηση είναι το **δείγμα εγγράφου** (`specimenAgreementOf`): το ίδιο μοντέλο εγγράφου με το συμφωνητικό,
 *    με κενά μέρη — ό,τι θα πάρει κάθε νέο συμφωνητικό. Από πάνω η υπενθύμιση: τα υπάρχοντα πρόχειρα **δεν** αλλάζουν.
 * Φορτώνεται με `import()` (ADR-744 §34).
 */

import { useCallback, useDeferredValue, useMemo } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { specimenAgreementOf } from '@/subapps/procurement/subcontracts/templates/template-edits';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from '../../document/AgreementDocumentColumns';
import type { DocumentEditHandler, DocumentEditTarget } from '../../document/EditInFormButton';
import { TEMPLATE_SECTION_MAP } from '../../editor/editor-sections';
import { EditorSplitLayout } from '../../editor/EditorSplitLayout';
import { DocumentZoomBar } from '../../document/DocumentZoomBar';
import { DocumentZoomProvider } from '../../document/DocumentZoomContext';
import { useEditorSection, type EditorSectionState } from '../../editor/useEditorSection';
import { ConflictBanner, EditorToolbar } from '../../editor/EditorToolbar';
import { useLibraryActions } from '../useLibraryActions';
import { TemplateEditorForm } from './TemplateEditorForm';
import { useTemplateEditor, type TemplateEditor as Editor, type TemplateEditorTarget } from './useTemplateEditor';

export interface TemplateEditorProps {
  readonly target: TemplateEditorTarget;
  readonly templates: readonly SubcontractTradeTemplate[];
  readonly clauses: readonly SubcontractClause[];
  readonly library: ApprovedLibrary;
  readonly authority: SubcontractLibraryAuthorityView;
}

interface SpecimenPreviewProps {
  readonly draft: SubcontractTradeTemplateDefinition;
  readonly library: ApprovedLibrary;
  readonly onEdit: DocumentEditHandler;
}

/** Ο τίτλος «Έγγραφο-δείγμα» ζει στην κεφαλίδα της στήλης (`EditorSplitLayout`, §5.23). */
function SpecimenPreview({ draft, library, onEdit }: SpecimenPreviewProps) {
  const { t } = useTranslation('procurement');
  const deferred = useDeferredValue(draft);
  const specimen = useMemo(() => specimenAgreementOf(deferred, library), [deferred, library]);
  return (
    <section aria-label={t('subcontracts.library.templateEditor.specimen')} className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.library.templateEditor.existingDraftsUnchanged')}</p>
      <AgreementDocumentColumns agreement={specimen} onEdit={onEdit} />
      <AgreementPaymentCalendar agreement={specimen} />
    </section>
  );
}

/** Μολύβι στο δείγμα ⇒ η καρτέλα της ενότητας· τα «Μέρη» δεν υπάρχουν στο πρότυπο (κενά στο δείγμα) ⇒ καμία κίνηση. */
function useEditFromSpecimen(sections: EditorSectionState): DocumentEditHandler {
  const { select } = sections;
  return useCallback((target: DocumentEditTarget) => {
    if (TEMPLATE_SECTION_MAP.sections.includes(target.section)) select(target.section, 'document');
  }, [select]);
}

export function TemplateEditor({ target, templates, clauses, library, authority }: TemplateEditorProps) {
  const actions = useLibraryActions();
  const takenCodes = useMemo(() => new Set(templates.map((template) => template.code)), [templates]);
  const titles = useMemo(() => new Map(clauses.map((clause) => [clause.clauseKey, clause.title])), [clauses]);
  const editor: Editor = useTemplateEditor({ target, takenCodes, library, authority, actions });
  const { t } = useTranslation('procurement');
  const copy = useMemo(() => ({ conflictMessage: t('subcontracts.library.templateEditor.conflict') }), [t]);
  const sections = useEditorSection(TEMPLATE_SECTION_MAP);
  const onEdit = useEditFromSpecimen(sections);
  return (
    <section className="space-y-3">
      <EditorToolbar editor={editor} copy={copy} />
      <ConflictBanner editor={editor} copy={copy} />
      <DocumentZoomProvider>
        <EditorSplitLayout
          form={<TemplateEditorForm editor={editor} library={library} titles={titles} takenCodes={takenCodes} sections={sections} />}
          preview={<SpecimenPreview draft={editor.draft} library={library} onEdit={onEdit} />}
          previewTitle={t('subcontracts.library.templateEditor.specimen')}
          previewTools={<DocumentZoomBar />}
          previewRequest={sections.previewRequest}
        />
      </DocumentZoomProvider>
    </section>
  );
}
