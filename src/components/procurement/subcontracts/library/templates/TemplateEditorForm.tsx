'use client';

/**
 * **Η φόρμα του προτύπου ειδικότητας** (ADR-928 §5.3 · §5.22): ταυτότητα · γραμμές · όροι · σχέδιο πληρωμών · ρήτρες.
 *
 * 🔑 Οι **ίδιες** γενικές ενότητες με τον επεξεργαστή συμφωνητικού (Φ3γ-2), με `path` = `lines` · `defaultTerms` ·
 *    `defaultTerms.paymentPlan`: τα ευρήματα του `validateTradeTemplateDefinition` πέφτουν στο πεδίο τους χωρίς αντίγραφο.
 * 🔑 Η ζώνη της ρήτρας φαίνεται **στο πεδίο του όρου** (`templateBoundTermsOf`), χωρίς πεδίο λόγου: το πρότυπο δεν
 *    δέχεται αποκλίσεις (`setReason: null`) — θέλει **ελεύθερη** ζώνη.
 * 🔑 Κωδικός: γεννιέται από τον τίτλο στο νέο πρότυπο, **αμετάβλητος** μετά (ο γραφέας τον κρατά· το id είναι από αυτόν).
 * 🔑 §5.23: οι ενότητες σε **καρτέλες** (`EditorSectionTabs`), όπως στο συμφωνητικό· η ανοιχτή καρτέλα έρχεται από τον
 *    `TemplateEditor`, που τη μοιράζεται με τον συγχρονισμό του δείγματος.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { templateCodeFromTitle } from '@/subapps/procurement/subcontracts/templates/template-edits';
import type { LocalizedText } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { AGREEMENT_DOCUMENT_MODES } from '@/subapps/procurement/subcontracts/types/trade-template';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { EditorField, issuesIdOf } from '../../editor/EditorField';
import { EditorSectionTabs } from '../../editor/EditorSectionTabs';
import { TEMPLATE_SECTION_MAP } from '../../editor/editor-sections';
import type { EditorSectionState } from '../../editor/useEditorSection';
import { useTemplateBoundTermsViews } from '../../editor/useBoundTermsViews';
import { LinesSection } from '../../sections/lines/LinesSection';
import { LocalizedTextFields } from '../../sections/LocalizedTextFields';
import { PaymentPlanSection } from '../../sections/plan/PaymentPlanSection';
import { TermsSection } from '../../sections/terms/TermsSection';
import { TemplateClausesSection } from './TemplateClausesSection';
import type { TemplateEditor } from './useTemplateEditor';

export interface TemplateEditorFormProps {
  readonly editor: TemplateEditor;
  readonly library: ApprovedLibrary;
  readonly titles: ReadonlyMap<string, LocalizedText>;
  readonly takenCodes: ReadonlySet<string>;
}

function CodeField({ editor, onTouch }: Pick<TemplateEditorFormProps, 'editor'> & { readonly onTouch: () => void }) {
  const { t } = useTranslation('procurement');
  const { draft, update, issues } = editor;
  if (editor.mode === 'edit') {
    return (
      <EditorField id="template-code" label={t('subcontracts.library.templates.code')}>
        <p className="m-0 flex items-center gap-1 font-mono text-sm"><Lock className="h-3 w-3" aria-hidden />{draft.code}</p>
      </EditorField>
    );
  }
  return (
    <EditorField id="template-code" label={t('subcontracts.library.templates.code')} issues={issuesAt(issues, 'code')}>
      <Input id="template-code" className="font-mono" value={draft.code} aria-describedby={issuesIdOf('template-code')} onChange={(event) => { onTouch(); update({ ...draft, code: event.target.value }); }} />
    </EditorField>
  );
}

function IdentitySection(props: TemplateEditorFormProps) {
  const { t, i18n } = useTranslation(['procurement', 'quotes']);
  const { editor, takenCodes } = props;
  const { draft, update, issues } = editor;
  const [keyTouched, setKeyTouched] = useState(editor.mode === 'edit');
  const setTitle = (title: LocalizedText) =>
    update({ ...draft, title, code: keyTouched ? draft.code : templateCodeFromTitle(title.el ?? '', takenCodes) });
  return (
    <section aria-labelledby="editor-identity" className="space-y-3">
      <h3 id="editor-identity" className="text-base font-semibold">{t('subcontracts.editor.sections.identity')}</h3>
      <fieldset className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-3">
        <LocalizedTextFields id="template-title" label={t('subcontracts.library.templateEditor.title')} value={draft.title} onChange={setTitle} path="title" issues={issues} language={resolveHumanLanguage(i18n.language)} secondaryLanguage="en" />
        <CodeField editor={editor} onTouch={() => setKeyTouched(true)} />
        <EditorField id="template-trade" label={t('subcontracts.library.templates.trade')} issues={issuesAt(issues, 'trade')}>
          <EnumSelect id="template-trade" value={draft.trade} values={TRADE_CODES} getLabel={(trade) => t(`quotes:trades.${trade}`)} onValueChange={(trade) => update({ ...draft, trade })} />
        </EditorField>
        <EditorField id="template-mode" label={t('subcontracts.editor.identity.mode')} issues={issuesAt(issues, 'defaultDocumentMode')}>
          <EnumSelect id="template-mode" value={draft.defaultDocumentMode} values={AGREEMENT_DOCUMENT_MODES} getLabel={(mode) => t(`subcontracts.editor.identity.modes.${mode}`)} onValueChange={(defaultDocumentMode) => update({ ...draft, defaultDocumentMode })} />
        </EditorField>
      </fieldset>
    </section>
  );
}

export function TemplateEditorForm(props: TemplateEditorFormProps & { readonly sections: EditorSectionState }) {
  const { t, i18n } = useTranslation('procurement');
  const { editor, library, titles, sections } = props;
  const { draft, update, issues } = editor;
  const context = { issues, language: resolveHumanLanguage(i18n.language), secondaryLanguage: null };
  const bound = useTemplateBoundTermsViews(draft, library, titles);
  const referencedLineIds = useMemo(() => new Set(draft.defaultTerms.minimumOutputs.map((output) => output.lineId)), [draft.defaultTerms.minimumOutputs]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.save();
  };
  return (
    <form aria-label={t('subcontracts.library.templateEditor.formLabel')} noValidate onSubmit={submit} className="p-4 pt-0">
      <EditorSectionTabs map={TEMPLATE_SECTION_MAP} issues={issues} state={sections} panels={{
        identity: <IdentitySection {...props} />,
        lines: <LinesSection {...context} value={draft.lines} onChange={(lines) => update({ ...draft, lines })} path="lines" referencedLineIds={referencedLineIds} />,
        terms: <TermsSection {...context} value={draft.defaultTerms} onChange={(defaultTerms) => update({ ...draft, defaultTerms })} path="defaultTerms" bound={bound.terms} lines={draft.lines} />,
        plan: <PaymentPlanSection {...context} value={draft.defaultTerms.paymentPlan} onChange={(paymentPlan) => update({ ...draft, defaultTerms: { ...draft.defaultTerms, paymentPlan } })} path="defaultTerms.paymentPlan" bound={bound.plan} />,
        clauses: <TemplateClausesSection value={draft} onChange={update} library={library} titles={titles} issues={issues} language={context.language} />,
      }} />
    </form>
  );
}
