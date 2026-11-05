'use client';

/**
 * Η ενότητα «Μέρη» του επεξεργαστή (ADR-928 §5.4 · Φ2 απόφαση 4 · Φ3γ): υπεργολάβος, κύριος του έργου, κτίρια.
 *
 * 🔑 **Ids, όχι στιγμιότυπα**: ο άνθρωπος διαλέγει *ποια* επαφή / *ποια* κτίρια· τα τυπωμένα στοιχεία (ΑΦΜ, διεύθυνση,
 *    άδεια) τα λύνει ο γραφέας στην αποθήκευση. Η προεπισκόπηση το λέει όταν ένα μέρος περιμένει την αποθήκευση.
 * 🔑 Υπεργολάβος = επαφή με ρόλο **προμηθευτή** (η κατηγορία «υπεργολάβος» είναι κατηγορία προμηθευτή, `SupplierCategory`)·
 *    οικοπεδούχοι = επαφές με ρόλο **ιδιοκτήτη ακινήτων**. Μία ζωντανή ανάγνωση: `usePersonaContacts`.
 * 🔑 Το έργο **δεν** αλλάζει εδώ: πρόχειρο που «μετακομίζει» αλλάζει τον πόρο της εξουσιοδότησης (§5.15) — νέο έγγραφο.
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supplierContactsToOptions, supplierNamesById } from '@/hooks/procurement/usePOSupplierContacts';
import { usePersonaContacts } from '@/hooks/procurement/usePersonaContacts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuesAt, issuesUnder } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import type { ProjectOwnersInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import type { PersonaType } from '@/types/contacts/personas';
import { ProjectBuildingsChecklist } from '../ProjectBuildingsChecklist';
import { EditorField } from './EditorField';
import type { AgreementEditor } from './useAgreementEditor';

const SUBCONTRACTOR_PERSONAS: readonly PersonaType[] = ['supplier'];
const OWNER_PERSONAS: readonly PersonaType[] = ['property_owner'];
const OWNER_KINDS = ['none', 'collective', 'named'] as const satisfies readonly ProjectOwnersInput['kind'][];

interface SectionProps {
  readonly editor: AgreementEditor;
}

function SubcontractorField({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const { contacts, loading } = usePersonaContacts(SUBCONTRACTOR_PERSONAS);
  const options = useMemo(() => supplierContactsToOptions(contacts), [contacts]);
  return (
    <EditorField id="editor-subcontractor" label={t('subcontracts.editor.parties.subcontractor')} issues={issuesAt(editor.issues, 'subcontractorContactId')}>
      <SearchableCombobox
        id="editor-subcontractor"
        value={editor.draft.subcontractorContactId}
        onValueChange={(contactId) => editor.update({ ...editor.draft, subcontractorContactId: contactId })}
        options={options}
        isLoading={loading}
        placeholder={t('subcontracts.editor.parties.chooseContact')}
        emptyMessage={t('subcontracts.editor.parties.noContacts')}
      />
    </EditorField>
  );
}

function NamedOwners({ editor, contactIds }: SectionProps & { readonly contactIds: readonly string[] }) {
  const { t } = useTranslation('procurement');
  const { contacts, loading } = usePersonaContacts(OWNER_PERSONAS);
  const names = useMemo(() => supplierNamesById(contacts), [contacts]);
  const options = useMemo(() => supplierContactsToOptions(contacts, contactIds), [contacts, contactIds]);
  const set = (next: readonly string[]) => editor.update({ ...editor.draft, projectOwners: { kind: 'named', contactIds: next } });
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {contactIds.map((id) => (
          <li key={id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
            {names.get(id) ?? id}
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" aria-label={t('subcontracts.editor.parties.removeOwner', { owner: names.get(id) ?? id })} onClick={() => set(contactIds.filter((candidate) => candidate !== id))}>
              <X className="h-3 w-3" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <SearchableCombobox aria-label={t('subcontracts.editor.parties.addOwner')} value="" onValueChange={(id) => id && set([...contactIds, id])} options={options} isLoading={loading} placeholder={t('subcontracts.editor.parties.addOwner')} emptyMessage={t('subcontracts.editor.parties.noContacts')} />
    </>
  );
}

function OwnersField({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  const owners = editor.draft.projectOwners;
  const choose = (kind: string) => {
    if (kind === 'none' || kind === 'collective') editor.update({ ...editor.draft, projectOwners: { kind } });
    else if (kind === 'named') editor.update({ ...editor.draft, projectOwners: { kind: 'named', contactIds: owners.kind === 'named' ? owners.contactIds : [] } });
  };
  return (
    <EditorField id="editor-owners" label={t('subcontracts.editor.parties.owners')} issues={issuesUnder(editor.issues, 'projectOwners')}>
      <Select value={owners.kind} onValueChange={choose}>
        <SelectTrigger id="editor-owners"><SelectValue /></SelectTrigger>
        <SelectContent>{OWNER_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{t(`subcontracts.editor.parties.ownerKinds.${kind}`)}</SelectItem>)}</SelectContent>
      </Select>
      {owners.kind === 'named' && <NamedOwners editor={editor} contactIds={owners.contactIds} />}
    </EditorField>
  );
}

function BuildingsField({ editor }: SectionProps) {
  const scope = editor.draft.scope;
  if (scope.kind !== 'single_project') return null;
  return (
    <ProjectBuildingsChecklist
      idPrefix="editor-building"
      projectId={scope.projectId}
      value={scope.buildingIds}
      onChange={(buildingIds) => editor.update({ ...editor.draft, scope: { ...scope, buildingIds } })}
    />
  );
}

export function PartiesSection({ editor }: SectionProps) {
  const { t } = useTranslation('procurement');
  return (
    <section aria-labelledby="editor-parties" className="space-y-3">
      <h3 id="editor-parties" className="text-base font-semibold">{t('subcontracts.editor.sections.parties')}</h3>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <SubcontractorField editor={editor} />
        <OwnersField editor={editor} />
      </fieldset>
      <BuildingsField editor={editor} />
    </section>
  );
}
