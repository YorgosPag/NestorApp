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

import { useDeferredValue, useMemo } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractLibraryAuthorityView } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { specimenAgreementOf } from '@/subapps/procurement/subcontracts/templates/template-edits';
import type { SubcontractClause } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractTradeTemplate, SubcontractTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/types/trade-template';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from '../../document/AgreementDocumentColumns';
import { EditorSplitLayout } from '../../editor/EditorSplitLayout';
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

function SpecimenPreview({ draft, library }: { readonly draft: SubcontractTradeTemplateDefinition; readonly library: ApprovedLibrary }) {
  const { t } = useTranslation('procurement');
  const deferred = useDeferredValue(draft);
  const specimen = useMemo(() => specimenAgreementOf(deferred, library), [deferred, library]);
  return (
    <section aria-labelledby="template-preview" className="space-y-4">
      <h3 id="template-preview" className="text-base font-semibold">{t('subcontracts.library.templateEditor.specimen')}</h3>
      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t('subcontracts.library.templateEditor.existingDraftsUnchanged')}</p>
      <AgreementDocumentColumns agreement={specimen} />
      <AgreementPaymentCalendar agreement={specimen} />
    </section>
  );
}

export function TemplateEditor({ target, templates, clauses, library, authority }: TemplateEditorProps) {
  const actions = useLibraryActions();
  const takenCodes = useMemo(() => new Set(templates.map((template) => template.code)), [templates]);
  const titles = useMemo(() => new Map(clauses.map((clause) => [clause.clauseKey, clause.title])), [clauses]);
  const editor: Editor = useTemplateEditor({ target, takenCodes, library, authority, actions });
  const { t } = useTranslation('procurement');
  const copy = useMemo(() => ({ conflictMessage: t('subcontracts.library.templateEditor.conflict') }), [t]);
  return (
    <section className="space-y-3">
      <EditorToolbar editor={editor} copy={copy} />
      <ConflictBanner editor={editor} copy={copy} />
      <EditorSplitLayout
        form={<TemplateEditorForm editor={editor} library={library} titles={titles} takenCodes={takenCodes} />}
        preview={<SpecimenPreview draft={editor.draft} library={library} />}
      />
    </section>
  );
}
