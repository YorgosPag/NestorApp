'use client';

/**
 * Ο επεξεργαστής συμφωνητικού υπεργολαβίας (ADR-928 Φ3γ): φόρμα σε καρτέλες | ζωντανή προεπισκόπηση, όπως
 * Procore/Ironclad/Figma (§5.23).
 *
 * 🔑 Η κατάσταση ζει **ένα** επίπεδο πάνω (`useAgreementEditor`, στη σελίδα), ώστε η σελίδα να ξέρει αν υπάρχουν μη
 *    αποθηκευμένες αλλαγές (π.χ. «Έκδοση» ανενεργή ώσπου να αποθηκευτούν)· η εργαλειοθήκη (Αποθήκευση) ζει στην
 *    κεφαλίδα της σελίδας, δίπλα στις μεταβάσεις κύκλου ζωής (§5.23 — μία γραμμή αντί για τρεις).
 * 🔑 Η ανοιχτή καρτέλα (`useEditorSection`) είναι **ένας** κάτοχος για δύο αναγνώστες: τις καρτέλες της φόρμας και τον
 *    συγχρονισμό της προεπισκόπησης. Το μολύβι στο έγγραφο γράφει στον ίδιο κάτοχο.
 * 🔑 Enter μέσα στη φόρμα = Αποθήκευση (μία διαδρομή με το κουμπί, `useAgreementEditor.save`, που ξέρει πότε επιτρέπεται).
 * Φορτώνεται με `import()` (ADR-744 §34): μοντέλο εγγράφου, bundles και ολογράφως δεν μπαίνουν στο slice της σελίδας.
 */

import { useCallback, useMemo, type FormEvent } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import type { DocumentEditTarget } from '../document/EditInFormButton';
import { LinesSection } from '../sections/lines/LinesSection';
import { PaymentPlanSection } from '../sections/plan/PaymentPlanSection';
import { TermsSection } from '../sections/terms/TermsSection';
import { AGREEMENT_SECTION_MAP } from './editor-sections';
import { EditorSectionTabs } from './EditorSectionTabs';
import { EditorSplitLayout } from './EditorSplitLayout';
import { useBoundTermsViews } from './useBoundTermsViews';
import { useEditorSection, type EditorSectionState } from './useEditorSection';
import { AgreementLivePreview } from './AgreementLivePreview';
import { ClausesSection, revealClauseCard } from './ClausesSection';
import { ConflictBanner } from './EditorToolbar';
import { IdentitySection } from './IdentitySection';
import { PartiesSection } from './PartiesSection';
import type { AgreementEditor as Editor } from './useAgreementEditor';

interface AgreementEditorProps {
  readonly editor: Editor;
}

/** Το κοινό των γενικών ενοτήτων: ευρήματα και γλώσσες. Το τμήμα και το `path` τα δίνει κάθε ενότητα. */
function useSectionContext(editor: Editor) {
  const { i18n } = useTranslation('procurement');
  return { issues: editor.issues, language: resolveHumanLanguage(i18n.language), secondaryLanguage: editor.draft.languages.secondary };
}

function EditorForm({ editor, sections }: AgreementEditorProps & { readonly sections: EditorSectionState }) {
  const { t } = useTranslation('procurement');
  const context = useSectionContext(editor);
  const { draft, update } = editor;
  const bound = useBoundTermsViews(editor);
  const referencedLineIds = useMemo(() => new Set(draft.terms.minimumOutputs.map((output) => output.lineId)), [draft.terms.minimumOutputs]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.save();
  };
  const panels = {
    identity: <IdentitySection editor={editor} />,
    parties: <PartiesSection editor={editor} />,
    lines: <LinesSection {...context} value={draft.lines} onChange={(lines) => update({ ...draft, lines })} path="lines" referencedLineIds={referencedLineIds} />,
    terms: <TermsSection {...context} value={draft.terms} onChange={(terms) => update({ ...draft, terms })} path="terms" bound={bound.terms} lines={draft.lines} />,
    plan: <PaymentPlanSection {...context} value={draft.terms.paymentPlan} onChange={(paymentPlan) => update({ ...draft, terms: { ...draft.terms, paymentPlan } })} path="terms.paymentPlan" bound={bound.plan} />,
    clauses: <ClausesSection editor={editor} />,
  };
  return (
    <form aria-label={t('subcontracts.editor.formLabel')} noValidate onSubmit={submit} className="p-4 pt-0">
      <EditorSectionTabs map={AGREEMENT_SECTION_MAP} issues={editor.issues} state={sections} panels={panels} />
    </form>
  );
}

export default function AgreementEditor({ editor }: AgreementEditorProps) {
  const { t } = useTranslation('procurement');
  const sections = useEditorSection(AGREEMENT_SECTION_MAP);
  const { select } = sections;
  const editFromDocument = useCallback((target: DocumentEditTarget) => {
    select(target.section, 'document');
    if (target.clauseKey) revealClauseCard(target.clauseKey);
  }, [select]);
  return (
    <section className="space-y-3">
      <ConflictBanner editor={editor} />
      <EditorSplitLayout
        form={<EditorForm editor={editor} sections={sections} />}
        preview={<AgreementLivePreview editor={editor} onEdit={editFromDocument} />}
        previewTitle={t('subcontracts.editor.preview.title')}
        previewRequest={sections.previewRequest}
      />
    </section>
  );
}
