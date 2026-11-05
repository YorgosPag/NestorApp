'use client';

/**
 * «Νέα εντολή εργασίας» — ανάθεση εργοταξίου σε κύρια σύμβαση (ADR-928 §5.24 · AIA A422 · ConsensusDocs 756).
 *
 * Δύο είσοδοι, **ένας** διάλογος:
 *   - από τη σελίδα της κύριας σύμβασης ⇒ σταθερή σύμβαση, επιλογή έργου·
 *   - από την καρτέλα ενός έργου ⇒ σταθερό έργο, επιλογή ανάμεσα στις κύριες που **δέχονται** εντολή τώρα.
 * 🔑 Πέρα από τους μεγάλους: το δικαίωμα στο **έργο-στόχο** κρίνεται ζωντανά με αιτία πριν την υποβολή, και λέμε αν το
 *    έργο έχει ήδη εντολή από την ίδια σύμβαση (ενημέρωση — ο γραφέας δέχεται και δεύτερη).
 * 🔑 Καμία αισιόδοξη εγγραφή: η εντολή φαίνεται όταν τη γράψει ο γραφέας (η σύμβαση είναι ζωντανή ανάγνωση).
 */

import { useId, useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FormActions } from '@/components/ui/form/FormActions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompanyMasterSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import { formatCalendarDate } from '@/lib/intl-utils';
import { projectsToOptions } from '@/lib/procurement/scope-options';
import { assignSubcontractAgreement } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { assignableMasters, type WorkOrderBlock } from '@/subapps/procurement/subcontracts/agreements/work-orders';
import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '@/subapps/procurement/subcontracts/types/clause';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { ProjectBuildingsChecklist } from '../ProjectBuildingsChecklist';
import { useSubcontractFailureExplainer } from '../subcontract-messages';
import { useWorkOrderForm, type WorkOrderForm } from './useWorkOrderForm';

interface NewWorkOrderDialogProps {
  /** Σταθερή κύρια σύμβαση (η σελίδα της, ζωντανή)· `null` ⇒ επιλογή. */
  readonly agreement: SubcontractAgreement | null;
  /** Σταθερό έργο-στόχος (η καρτέλα του)· `null` ⇒ επιλογή. */
  readonly fixedProjectId: string | null;
  readonly onClose: () => void;
}

/** Η αιτία με τη λέξη της οθόνης — ποτέ σιωπηλά ανενεργό κουμπί (ADR-928 §5.16 απόφαση 4). */
function useWorkOrderBlockReason(): (block: WorkOrderBlock) => string {
  const { t } = useTranslation('procurement');
  return (block) => {
    switch (block.kind) {
      case 'refusal': return t('subcontracts.workOrders.blocked.notAssignable');
      case 'noTarget': return t('subcontracts.workOrders.blocked.chooseProject');
      case 'checking': return t('subcontracts.actions.checking');
      case 'denied': return t('subcontracts.workOrders.blocked.denied');
    }
  };
}

/** Αριθμός · τίτλος (στη γλώσσα του εγγράφου, §5.20 #1) · υπεργολάβος — όπως η κεφαλίδα της σελίδας του. */
const masterLabel = (agreement: SubcontractAgreement): string =>
  [agreement.documentNumber, agreement.title[CLAUSE_AUTHORITATIVE_LANGUAGE], agreement.parties.subcontractor.name].filter(Boolean).join(' · ');

function MasterField({ masters, loading, value, onChange }: { masters: readonly SubcontractAgreement[]; loading: boolean; value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation('procurement');
  return (
    <section className="space-y-1.5">
      <Label htmlFor="work-order-master">{t('subcontracts.workOrders.dialog.master')}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={loading || masters.length === 0}>
        <SelectTrigger id="work-order-master"><SelectValue placeholder={t(loading ? 'subcontracts.actions.checking' : 'subcontracts.workOrders.dialog.chooseMaster')} /></SelectTrigger>
        <SelectContent>{masters.map((master) => <SelectItem key={master.id} value={master.id}>{masterLabel(master)}</SelectItem>)}</SelectContent>
      </Select>
      {!loading && masters.length === 0 && <p className="text-xs text-muted-foreground">{t('subcontracts.workOrders.dialog.noMasters')}</p>}
    </section>
  );
}

function ProjectField({ form, fixed }: { form: WorkOrderForm; fixed: boolean }) {
  const { t } = useTranslation('procurement');
  const { projects, loading } = useFirestoreProjects();
  const options = useMemo(() => projectsToOptions(projects), [projects]);
  return (
    <section className="space-y-1.5">
      <Label htmlFor="work-order-project">{t('subcontracts.workOrders.dialog.project')}</Label>
      <SearchableCombobox id="work-order-project" value={form.fields.projectId} onValueChange={(projectId) => form.setFields({ projectId })} options={options} isLoading={loading} disabled={fixed} placeholder={t('subcontracts.workOrders.dialog.chooseProject')} emptyMessage={t('subcontracts.workOrders.dialog.noProjects')} />
      {form.previous && (
        <p role="note" className="text-xs text-muted-foreground">
          {t('subcontracts.workOrders.dialog.previous', { number: form.previous.number, date: form.previous.assignment.startDate ? formatCalendarDate(form.previous.assignment.startDate) : '—' })}
        </p>
      )}
    </section>
  );
}

function TimingFields({ form }: { form: WorkOrderForm }) {
  const { t } = useTranslation('procurement');
  const { fields, setFields } = form;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <section className="space-y-1.5">
        <Label htmlFor="work-order-start">{t('subcontracts.workOrders.dialog.start')}</Label>
        <DatePickerField id="work-order-start" value={pickerDateOfKey(fields.startDate)} onSelect={(date) => setFields({ startDate: dateKeyOfPicker(date) })} placeholder={t('subcontracts.workOrders.dialog.noStart')} />
      </section>
      <section className="space-y-1.5">
        <Label htmlFor="work-order-duration">{t('subcontracts.workOrders.dialog.duration')}</Label>
        <Input id="work-order-duration" type="number" inputMode="numeric" min={1} step={1} value={fields.durationDays} onChange={(event) => setFields({ durationDays: event.target.value })} />
      </section>
    </fieldset>
  );
}

function WorkOrderFormFields({ form, fixedProjectId }: { form: WorkOrderForm; fixedProjectId: string | null }) {
  const { t } = useTranslation('procurement');
  return (
    <>
      <ProjectField form={form} fixed={fixedProjectId !== null} />
      {form.fields.projectId && (
        <ProjectBuildingsChecklist idPrefix="work-order-building" projectId={form.fields.projectId} value={form.fields.buildingIds} onChange={(buildingIds) => form.setFields({ buildingIds })} />
      )}
      <TimingFields form={form} />
      <section className="space-y-1.5">
        <Label htmlFor="work-order-note">{t('subcontracts.workOrders.dialog.note')}</Label>
        <Textarea id="work-order-note" rows={2} value={form.fields.note} onChange={(event) => form.setFields({ note: event.target.value })} />
      </section>
    </>
  );
}

interface BodyProps extends NewWorkOrderDialogProps {
  /** Η σύμβαση που δέχεται την εντολή — σταθερή ή επιλεγμένη. */
  readonly target: SubcontractAgreement | null;
  readonly picker: ReactNode;
}

function WorkOrderDialogBody({ target, picker, fixedProjectId, onClose }: BodyProps) {
  const { t } = useTranslation('procurement');
  const formId = useId();
  const explain = useSubcontractFailureExplainer();
  const reason = useWorkOrderBlockReason();
  const { success } = useNotifications();
  const form = useWorkOrderForm(target, fixedProjectId);
  const ready = target !== null && form.block === null && form.body !== null;
  const submission = useFormSubmission({
    submit: async () => {
      if (!target || !form.body) throw new Error(t('subcontracts.workOrders.blocked.incomplete'));
      try { return await assignSubcontractAgreement(target.id, form.body); } catch (cause) { throw explain(cause); }
    },
    canSubmit: ready,
    onSuccess: () => { success(t('subcontracts.workOrders.dialog.created')); onClose(); },
    errorFallback: t('subcontracts.failure.unknown'),
  });
  const blockedReason = form.block ? reason(form.block) : null;
  return (
    <>
      <form id={formId} onSubmit={submission.handleSubmit} className="space-y-4" noValidate>
        {picker}
        <WorkOrderFormFields form={form} fixedProjectId={fixedProjectId} />
        {blockedReason && form.block?.kind !== 'noTarget' && <p role="alert" className="text-sm text-destructive">{blockedReason}</p>}
      </form>
      <FormActions formId={formId} submitLabel={t('subcontracts.workOrders.dialog.submit')} cancelLabel={t('subcontracts.editor.deviations.dialog.cancel')} onCancel={onClose} submitting={submission.submitting} submitDisabled={!ready} error={submission.error} />
    </>
  );
}

/** Από την καρτέλα έργου: επιλογή ανάμεσα στις κύριες συμβάσεις που δέχονται εντολή — η ανάγνωση γίνεται **μόνο** εδώ. */
function ChooseMasterBody(props: NewWorkOrderDialogProps) {
  const { items, loading } = useCompanyMasterSubcontractAgreements();
  const masters = useMemo(() => assignableMasters(items), [items]);
  const [masterId, setMasterId] = useState('');
  const target = masters.find((candidate) => candidate.id === masterId) ?? null;
  const picker = <MasterField masters={masters} loading={loading} value={masterId} onChange={setMasterId} />;
  return <WorkOrderDialogBody {...props} target={target} picker={picker} />;
}

export default function NewWorkOrderDialog(props: NewWorkOrderDialogProps) {
  const { t } = useTranslation('procurement');
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('subcontracts.workOrders.dialog.title')}</DialogTitle>
          <DialogDescription>{t('subcontracts.workOrders.dialog.description')}</DialogDescription>
        </DialogHeader>
        {props.agreement
          ? <WorkOrderDialogBody {...props} target={props.agreement} picker={null} />
          : <ChooseMasterBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}
