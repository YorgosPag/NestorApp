'use client';

/**
 * @fileoverview ADR-915 §45.15 — **η φόρμα του υπευθύνου αυτοψίας**: ποιος (ο υπεύθυνος του ακινήτου §26 ή άλλη επαφή
 *   του γραφείου) + ιδιότητα. Φορτώνεται με `next/dynamic` **μόνο όταν ανοίξει ο διάλογος** (CHECK 3.34).
 * @related RegistryIssuanceDialogs.tsx (το κέλυφος) · lib/document-validity/issuance-inspection-contact.ts (ο κανόνας)
 * @module components/document-registry/RegistryIssuanceInspectionForm
 *
 * 🔑 **Επαφή, ποτέ ελεύθερο τηλέφωνο**: το τηλέφωνο είναι της επαφής. Επαφή χωρίς τηλέφωνο ⇒ η φόρμα το **λέει** πριν
 *    την αποθήκευση (ο μηχανικός θα δει «επικοινωνήστε με το γραφείο»).
 * 🔑 Ο ίδιος κανόνας με τον μειωτή: «Άλλο» μόνο με κείμενο· ίδιος ορισμός ⇒ τίποτα να σταλεί. Ο διακομιστής ξανακρίνει
 *    (CAS στο στάδιο · επαφή του γραφείου · `terms-refused`).
 */

import React, { useId, useState } from 'react';

import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { ChoiceField } from '@/components/document-registry/IssuanceChoiceField';
import { INSPECTION_ROLE_LABEL_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { INSPECTION_KEYS } from '@/components/document-registry/issuance-inspection-labels';
import { ISSUANCE_KEYS, PROPOSE_KEYS } from '@/components/document-registry/issuance-labels';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  INSPECTION_CONTACT_POLICY,
  INSPECTION_CONTACT_ROLES,
  type InspectionContactRole,
  type IssuanceInspectionContactEntry,
} from '@/lib/document-validity/issuance-inspection-contact';

const WHO = ['lead', 'other'] as const;
type Who = (typeof WHO)[number];

export interface InspectionContactFormProps {
  readonly view: RegistryIssuanceView;
  readonly close: () => void;
  /** Ο τρέχων ορισμός — `null` ⇒ πρώτος ορισμός. */
  readonly current: IssuanceInspectionContactEntry | null;
  /** Ο υπεύθυνος του ακινήτου (§26) — η **προεπιλογή**· `null` ⇒ κανείς ορισμένος. */
  readonly lead: { readonly contactId: string; readonly name: string } | null;
}

interface Draft {
  readonly who: Who;
  readonly other: ContactSummary | null;
  readonly role: InspectionContactRole | null;
  readonly roleOther: string;
}

/** Η αρχική κατάσταση: ο τρέχων ορισμός, αλλιώς ο υπεύθυνος του ακινήτου ως «Ιδιοκτήτης». */
function initialDraft(current: InspectionContactFormProps['current'], lead: InspectionContactFormProps['lead']): Draft {
  if (current !== null && (lead === null || current.contactId !== lead.contactId)) {
    return { who: 'other', other: null, role: current.role, roleOther: current.roleOther ?? '' };
  }
  if (current !== null) return { who: 'lead', other: null, role: current.role, roleOther: current.roleOther ?? '' };
  return lead === null ? { who: 'other', other: null, role: null, roleOther: '' } : { who: 'lead', other: null, role: 'owner', roleOther: '' };
}

/** Η επαφή της επιλογής — ο υπεύθυνος, η νέα αναζήτηση, ή (χωρίς νέα αναζήτηση) ο τρέχων άλλος. */
function chosenContactId(draft: Draft, props: InspectionContactFormProps): string | null {
  if (draft.who === 'lead') return props.lead?.contactId ?? null;
  return draft.other?.id ?? (props.current !== null && props.current.contactId !== props.lead?.contactId ? props.current.contactId : null);
}

type SetDraft = React.Dispatch<React.SetStateAction<Draft>>;

/** «Ποιος»: ο υπεύθυνος του ακινήτου ή άλλη επαφή του γραφείου (αναζήτηση) — με προειδοποίηση «χωρίς τηλέφωνο». */
function WhoFields({ draft, setDraft, lead }: { readonly draft: Draft; readonly setDraft: SetDraft; readonly lead: InspectionContactFormProps['lead'] }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  return (
    <>
      {lead === null ? null : (
        <ChoiceField
          legend={t(INSPECTION_KEYS.whoLegend)} options={WHO} value={draft.who}
          onChange={(who) => setDraft((d) => ({ ...d, who }))}
          labelOf={(who) => (who === 'lead' ? t(INSPECTION_KEYS.whoLead, { name: lead.name }) : t(INSPECTION_KEYS.whoOther))}
        />
      )}
      {draft.who === 'other' ? (
        <ContactSearchManager
          selectedContactId={draft.other?.id ?? ''} onContactSelect={(other) => setDraft((d) => ({ ...d, other }))}
          placeholder={t(INSPECTION_KEYS.searchPlaceholder)} label=""
        />
      ) : null}
      {draft.who === 'other' && draft.other !== null && !draft.other.phone ? (
        <p role="status" className="m-0 text-xs text-muted-foreground">{t(INSPECTION_KEYS.noPhone)}</p>
      ) : null}
    </>
  );
}

/** «Ιδιότητα»: ο κλειστός κατάλογος, και κείμενο **μόνο** για «Άλλο». */
function RoleFields({ draft, setDraft }: { readonly draft: Draft; readonly setDraft: SetDraft }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const otherId = useId();
  return (
    <>
      <ChoiceField
        legend={t(INSPECTION_KEYS.roleLegend)} options={INSPECTION_CONTACT_ROLES} value={draft.role}
        onChange={(role) => setDraft((d) => ({ ...d, role }))} labelOf={(role) => t(INSPECTION_ROLE_LABEL_KEYS[role])}
      />
      {draft.role === 'other' ? (
        <>
          <Label htmlFor={otherId} className="text-sm font-medium">{t(INSPECTION_KEYS.roleOtherLabel)}</Label>
          <Input
            id={otherId} value={draft.roleOther} maxLength={INSPECTION_CONTACT_POLICY.roleOtherMax} required
            onChange={(event) => setDraft((d) => ({ ...d, roleOther: event.target.value }))}
          />
        </>
      ) : null}
    </>
  );
}

export function InspectionContactForm(props: InspectionContactFormProps): React.ReactElement {
  const { view, close, current, lead } = props;
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(current, lead));
  const contactId = chosenContactId(draft, props);
  const roleOther = draft.role === 'other' ? draft.roleOther.trim() : '';
  const same = current !== null && current.contactId === contactId && current.role === draft.role && (current.roleOther ?? '') === roleOther;
  const valid = contactId !== null && draft.role !== null && (draft.role !== 'other' || roleOther !== '') && !same;
  const submit = () => {
    if (actions === null || !valid || contactId === null || draft.role === null) return;
    close();
    actions.act({ action: 'set-inspection-contact', ...issuanceTargetOf(view), contactId, role: draft.role, roleOther: roleOther === '' ? null : roleOther });
  };
  return (
    <>
      <WhoFields draft={draft} setDraft={setDraft} lead={lead} />
      <RoleFields draft={draft} setDraft={setDraft} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(INSPECTION_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={valid}
      />
    </>
  );
}
