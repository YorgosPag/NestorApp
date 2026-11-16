'use client';

/**
 * @fileoverview ADR-915 §45.15 (1β-γ) — **οι ιδιοκτήτες στη σελίδα έγκρισης**: ο υπεύθυνος βεβαιώνει κάθε πρόσωπο
 *   («Σωστό») ή διορθώνει/συμπληρώνει το ΑΦΜ, και λέει αν λείπει κάποιος — πριν εγκρίνει.
 * @related DocumentRequestCard.tsx (ο γονέας — στέλνει το τεκμήριο με το `approve`) ·
 *   lib/document-validity/issuance-owner-attestation.ts (ο κανόνας) · server/issuance-invitations/issuance-link-owners.ts
 * @module app/(auth)/document-request/DocumentRequestOwners
 *
 * 🔑 **Ιδιωτικότητα εκ σχεδιασμού**: το ΑΦΜ τρίτου φτάνει μόνο ως τα τελευταία ψηφία· η «Διόρθωση» ανοίγει **κενό**
 *    πεδίο — ο άνθρωπος βεβαιώνει χωρίς να του αποκαλυφθεί ολόκληρο ΑΦΜ που δεν είναι δικό του.
 * 🔑 **Το λάθος ψηφίο πιάνεται εδώ** (`isValidGreekVat`, mod-11) — πριν φτάσει στο έντυπο. Ο διακομιστής το ξανακρίνει.
 * 🔑 **Ρητή κρίση για κάθε πρόσωπο**: καμία προεπιλογή «Σωστό» — το τεκμήριο λέει τι **είπε** ο άνθρωπος.
 */

import React, { useId } from 'react';

import { ChoiceField } from '@/components/document-registry/IssuanceChoiceField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { OWNER_ATTESTATION_POLICY, OWNER_VERDICTS, type OwnerVerdict } from '@/lib/document-validity/issuance-owner-attestation';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import type { IssuanceLinkOwnerView } from '@/types/issuance-invitation';

import { EMPTY_OWNER_DRAFT as EMPTY_OWNER, type OwnerDraft, type OwnersDraft } from './document-request-owners-draft';

/** Κυριολεκτικά κλειδιά ανά είδος (CHECK 3.34). */
function vatText(t: ReturnType<typeof useTranslation>['t'], vat: IssuanceLinkOwnerView['vat']): string {
  switch (vat.kind) {
    case 'none': return t('document-request:owners.vatNone');
    case 'full': return t('document-request:owners.vatFull', { vat: vat.value });
    case 'masked': return t('document-request:owners.vatMasked', { tail: vat.tail });
  }
}

function VatLine({ owner }: { readonly owner: IssuanceLinkOwnerView }) {
  const { t } = useTranslation(['document-request']);
  return <p className="m-0 text-xs text-muted-foreground">{vatText(t, owner.vat)}</p>;
}

interface OwnerRowProps {
  readonly owner: IssuanceLinkOwnerView;
  readonly draft: OwnerDraft;
  readonly onChange: (next: OwnerDraft) => void;
  readonly disabled: boolean;
}

function OwnerRow({ owner, draft, onChange, disabled }: OwnerRowProps) {
  const { t } = useTranslation(['document-request']);
  const vatId = useId();
  const errorId = useId();
  const none = owner.vat.kind === 'none';
  const name = owner.name ?? t('document-request:facts.unnamed');
  const typed = draft.vatNumber.trim();
  const invalid = draft.verdict === 'corrected' && typed.length >= 9 && !isValidGreekVat(typed);
  const labelOf = (verdict: OwnerVerdict): string => {
    if (verdict === 'confirmed') return none ? t('document-request:owners.confirmNoVat') : t('document-request:owners.confirm');
    return none ? t('document-request:owners.supply') : t('document-request:owners.correct');
  };
  return (
    <li className="flex flex-col gap-2">
      <ChoiceField
        legend={owner.self ? t('document-request:owners.selfName', { name }) : name}
        options={OWNER_VERDICTS} value={draft.verdict} labelOf={labelOf} disabled={disabled}
        onChange={(verdict) => onChange({ ...draft, verdict })}
      />
      <VatLine owner={owner} />
      {draft.verdict === 'corrected' ? (
        <>
          <Label htmlFor={vatId} className="text-sm font-medium">{t('document-request:owners.newVatLabel')}</Label>
          <Input
            id={vatId} value={draft.vatNumber} inputMode="numeric" autoComplete="off" maxLength={12} required disabled={disabled}
            aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => onChange({ ...draft, vatNumber: event.target.value })}
          />
          {invalid ? <p id={errorId} role="alert" className="m-0 text-xs text-destructive">{t('document-request:owners.vatInvalid')}</p> : null}
        </>
      ) : null}
    </li>
  );
}

export interface DocumentRequestOwnersProps {
  readonly owners: readonly IssuanceLinkOwnerView[];
  readonly draft: OwnersDraft;
  readonly onChange: (next: OwnersDraft) => void;
  readonly disabled: boolean;
  /** Υπάρχει κρίση για κάθε πρόσωπο (και έγκυρα ΑΦΜ); — αλλιώς λέμε γιατί το «Εγκρίνω» είναι ανενεργό. */
  readonly complete: boolean;
}

export function DocumentRequestOwners({ owners, draft, onChange, disabled, complete }: DocumentRequestOwnersProps) {
  const { t } = useTranslation(['document-request']);
  const missingId = useId();
  const setOwner = (contactId: string, next: OwnerDraft) => onChange({ ...draft, byId: { ...draft.byId, [contactId]: next } });
  return (
    <section className="flex flex-col gap-3" aria-label={t('document-request:owners.heading')}>
      <h2 className="m-0 text-base font-semibold text-card-foreground">{t('document-request:owners.heading')}</h2>
      <p className="m-0 text-sm text-card-foreground">{t('document-request:owners.intro')}</p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {owners.map((owner) => (
          <OwnerRow
            key={owner.contactId} owner={owner} draft={draft.byId[owner.contactId] ?? EMPTY_OWNER} disabled={disabled}
            onChange={(next) => setOwner(owner.contactId, next)}
          />
        ))}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:owners.correctionGoesToOffice')}</p>
      <Label htmlFor={missingId} className="text-sm font-medium">{t('document-request:owners.missingLabel')}</Label>
      <Textarea
        id={missingId} value={draft.missingNote} maxLength={OWNER_ATTESTATION_POLICY.missingNoteMax} disabled={disabled}
        placeholder={t('document-request:owners.missingHint')}
        onChange={(event) => onChange({ ...draft, missingNote: event.target.value })}
      />
      {complete ? null : <p role="status" className="m-0 text-xs text-muted-foreground">{t('document-request:owners.incomplete')}</p>}
    </section>
  );
}
