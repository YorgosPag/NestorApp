'use client';

/**
 * Ο επεξεργαστής συμφωνητικού υπεργολαβίας (ADR-928 Φ3γ): φόρμα | ζωντανή προεπισκόπηση, όπως Figma/Procore.
 *
 * 🔑 Η κατάσταση ζει **ένα** επίπεδο πάνω (`useAgreementEditor`, στη σελίδα), ώστε η σελίδα να ξέρει αν υπάρχουν μη
 *    αποθηκευμένες αλλαγές (π.χ. «Έκδοση» ανενεργή ώσπου να αποθηκευτούν)· εδώ μόνο διάταξη.
 * 🔑 Η διάταξη φόρμα | προεπισκόπηση (και καρτέλες στο κινητό) είναι το κοινό `EditorSplitLayout` (ADR-928 §5.22).
 * 🔑 Enter μέσα στη φόρμα = Αποθήκευση (μία διαδρομή με το κουμπί, `useAgreementEditor.save`, που ξέρει πότε επιτρέπεται).
 * Φορτώνεται με `import()` (ADR-744 §34): μοντέλο εγγράφου, bundles και ολογράφως δεν μπαίνουν στο slice της σελίδας.
 */

import { useMemo, type FormEvent } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { LinesSection } from '../sections/lines/LinesSection';
import { PaymentPlanSection } from '../sections/plan/PaymentPlanSection';
import { TermsSection } from '../sections/terms/TermsSection';
import { EditorSectionNav } from './EditorSectionNav';
import { EditorSplitLayout } from './EditorSplitLayout';
import { useBoundTermsViews } from './useBoundTermsViews';
import { AgreementLivePreview } from './AgreementLivePreview';
import { ClausesSection } from './ClausesSection';
import { ConflictBanner, EditorToolbar } from './EditorToolbar';
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

function EditorForm({ editor }: AgreementEditorProps) {
  const { t } = useTranslation('procurement');
  const context = useSectionContext(editor);
  const { draft, update } = editor;
  const bound = useBoundTermsViews(editor);
  const referencedLineIds = useMemo(() => new Set(draft.terms.minimumOutputs.map((output) => output.lineId)), [draft.terms.minimumOutputs]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.save();
  };
  return (
    <form aria-label={t('subcontracts.editor.formLabel')} noValidate onSubmit={submit} className="space-y-6 p-4">
      <EditorSectionNav issues={editor.issues} />
      <IdentitySection editor={editor} />
      <PartiesSection editor={editor} />
      <LinesSection {...context} value={draft.lines} onChange={(lines) => update({ ...draft, lines })} path="lines" referencedLineIds={referencedLineIds} />
      <TermsSection {...context} value={draft.terms} onChange={(terms) => update({ ...draft, terms })} path="terms" bound={bound.terms} lines={draft.lines} />
      <PaymentPlanSection {...context} value={draft.terms.paymentPlan} onChange={(paymentPlan) => update({ ...draft, terms: { ...draft.terms, paymentPlan } })} path="terms.paymentPlan" bound={bound.plan} />
      <ClausesSection editor={editor} />
    </form>
  );
}

export default function AgreementEditor({ editor }: AgreementEditorProps) {
  return (
    <section className="space-y-3">
      <EditorToolbar editor={editor} />
      <ConflictBanner editor={editor} />
      <EditorSplitLayout form={<EditorForm editor={editor} />} preview={<AgreementLivePreview editor={editor} />} />
    </section>
  );
}
