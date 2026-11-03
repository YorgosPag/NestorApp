'use client';

/**
 * «Νέο συμφωνητικό» από ειδικότητα → πρότυπο (ADR-928 §5.3 · §5.9 δρόμος 1 · Φ3γ απόφαση 1).
 *
 * 🔑 **Πρώτα δημιουργία, μετά επεξεργασία** (Procore: το συμβόλαιο υπάρχει ως Draft από την πρώτη αποθήκευση): εδώ ο
 *    άνθρωπος λέει μόνο τα τέσσερα που δεν αλλάζουν εύκολα μετά — πρότυπο, εμβέλεια, υπεργολάβος — και ο γραφέας γράφει το
 *    πρόχειρο με αριθμό εγγράφου και **αληθινά** μέρη. Ο επεξεργαστής ανοίγει πάνω σε αυτό, με προεπισκόπηση που δείχνει
 *    ήδη τον εκδότη, τον ΑΦΜ και την άδεια.
 * 🔑 Η φόρμα **παράγεται** από το πρότυπο (`draftFromTemplate`): ρήτρα του προτύπου χωρίς έκδοση σε ισχύ λέγεται
 *    **πριν** τη δημιουργία, δεν χάνεται σιωπηλά.
 * 🔑 Εμβέλεια από το δικαίωμα (§5.15): συμφωνητικό του έργου ⇔ `canCreateForProject` · κύρια σύμβαση ⇔ μόνο εταιρεία.
 */

import { useId, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form/FormActions';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supplierContactsToOptions } from '@/hooks/procurement/usePOSupplierContacts';
import { usePersonaContacts } from '@/hooks/procurement/usePersonaContacts';
import { useSubcontractClauseLibrary, useSubcontractTradeTemplates } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getSubcontractAgreementUrl } from '@/lib/navigation/procurement-urls';
import { settledLeave } from '@/lib/unsaved-edits/leave-guard';
import { useRouter } from '@/lib/workspace/navigation';
import { createSubcontractAgreement } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { subcontractFailureOf } from '@/services/procurement/subcontracts/subcontract-failure';
import { draftFromTemplate } from '@/subapps/procurement/subcontracts/agreements/draft-from-template';
import type { AgreementScopeInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { PersonaType } from '@/types/contacts/personas';
import { useSubcontractFailureMessage, useSubcontractIssueMessage } from '../subcontract-messages';

const SUBCONTRACTOR_PERSONAS: readonly PersonaType[] = ['supplier'];
type ScopeKind = AgreementScopeInput['kind'];

export interface NewAgreementDialogProps {
  readonly projectId: string;
  readonly canCreateForProject: boolean;
  readonly canCreateMaster: boolean;
  readonly onClose: () => void;
}

/** Η άρνηση του γραφέα με τη λέξη του — το πρώτο εύρημα, αλλιώς το είδος. */
function useExplainFailure(): (cause: unknown) => Error {
  const issueMessage = useSubcontractIssueMessage(true);
  const failureMessage = useSubcontractFailureMessage(true);
  return (cause) => {
    const failure = subcontractFailureOf(cause);
    const [first] = failure.issues;
    return new Error(first ? issueMessage(first) : failureMessage(failure.kind));
  };
}

function useNewAgreementForm(props: NewAgreementDialogProps) {
  const [templateId, setTemplateId] = useState('');
  const [scopeKind, setScopeKind] = useState<ScopeKind>(props.canCreateForProject ? 'single_project' : 'multi_project');
  const [subcontractorContactId, setSubcontractor] = useState('');
  const { items: templates } = useSubcontractTradeTemplates();
  const { library, loading: libraryLoading } = useSubcontractClauseLibrary();
  const template = templates.find((candidate) => candidate.id === templateId) ?? null;
  const prepared = useMemo(() => {
    if (!template || libraryLoading) return null;
    const scope: AgreementScopeInput = scopeKind === 'single_project' ? { kind: 'single_project', projectId: props.projectId, buildingIds: [] } : { kind: 'multi_project' };
    return draftFromTemplate(template, library, { scope, subcontractorContactId });
  }, [template, libraryLoading, library, scopeKind, props.projectId, subcontractorContactId]);
  return { templates, templateId, setTemplateId, scopeKind, setScopeKind, subcontractorContactId, setSubcontractor, prepared };
}

function TemplateField({ form }: { readonly form: ReturnType<typeof useNewAgreementForm> }) {
  const { t, i18n } = useTranslation(['procurement', 'quotes']);
  const language = resolveHumanLanguage(i18n.language);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="new-agreement-template">{t('subcontracts.editor.new.template')}</Label>
      <Select value={form.templateId || undefined} onValueChange={form.setTemplateId}>
        <SelectTrigger id="new-agreement-template"><SelectValue placeholder={t('subcontracts.editor.new.chooseTemplate')} /></SelectTrigger>
        <SelectContent>
          {form.templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>{localizedIn(template.title, language)} · {t(`quotes:trades.${template.trade}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {form.templates.length === 0 && <p className="text-xs text-muted-foreground">{t('subcontracts.editor.new.noTemplates')}</p>}
    </div>
  );
}

function ScopeField({ form, props }: { readonly form: ReturnType<typeof useNewAgreementForm>; readonly props: NewAgreementDialogProps }) {
  const { t } = useTranslation('procurement');
  const choose = (value: string) => { if (value === 'single_project' || value === 'multi_project') form.setScopeKind(value); };
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{t('subcontracts.editor.new.scope')}</legend>
      <RadioGroup value={form.scopeKind} onValueChange={choose}>
        {props.canCreateForProject && <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="single_project" />{t('subcontracts.editor.new.scopeProject')}</Label>}
        {props.canCreateMaster && <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="multi_project" />{t('subcontracts.editor.new.scopeMaster')}</Label>}
      </RadioGroup>
    </fieldset>
  );
}

function SubcontractorField({ form }: { readonly form: ReturnType<typeof useNewAgreementForm> }) {
  const { t } = useTranslation('procurement');
  const { contacts, loading } = usePersonaContacts(SUBCONTRACTOR_PERSONAS);
  const options = useMemo(() => supplierContactsToOptions(contacts), [contacts]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="new-agreement-subcontractor">{t('subcontracts.editor.parties.subcontractor')}</Label>
      <SearchableCombobox id="new-agreement-subcontractor" value={form.subcontractorContactId} onValueChange={form.setSubcontractor} options={options} isLoading={loading} placeholder={t('subcontracts.editor.parties.chooseContact')} emptyMessage={t('subcontracts.editor.parties.noContacts')} />
    </div>
  );
}

export default function NewAgreementDialog(props: NewAgreementDialogProps) {
  const { t } = useTranslation('procurement');
  const formId = useId();
  const router = useRouter();
  const explain = useExplainFailure();
  const form = useNewAgreementForm(props);
  const { prepared } = form;
  const submission = useFormSubmission({
    submit: async () => {
      if (!prepared) throw new Error(t('subcontracts.actions.checking'));
      try { return await createSubcontractAgreement(prepared.draft); } catch (cause) { throw explain(cause); }
    },
    canSubmit: prepared !== null && form.subcontractorContactId.length > 0,
    onSuccess: (created) => settledLeave(() => router.push(getSubcontractAgreementUrl(props.projectId, created.id))),
    keepLockedOnSuccess: true,
    errorFallback: t('subcontracts.failure.unknown'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !submission.submitting && props.onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('subcontracts.editor.new.title')}</DialogTitle>
          <DialogDescription>{t('subcontracts.editor.new.description')}</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={submission.handleSubmit} className="space-y-4" noValidate>
          <TemplateField form={form} />
          <ScopeField form={form} props={props} />
          <SubcontractorField form={form} />
          {prepared && prepared.unresolved.length > 0 && <p role="alert" className="text-sm text-destructive">{t('subcontracts.editor.new.unresolved', { clauses: prepared.unresolved.join(', ') })}</p>}
        </form>
        <FormActions formId={formId} submitLabel={t('subcontracts.editor.new.create')} cancelLabel={t('subcontracts.editor.deviations.dialog.cancel')} onCancel={props.onClose} submitting={submission.submitting} submitDisabled={prepared === null || form.subcontractorContactId.length === 0} error={submission.error} />
      </DialogContent>
    </Dialog>
  );
}
