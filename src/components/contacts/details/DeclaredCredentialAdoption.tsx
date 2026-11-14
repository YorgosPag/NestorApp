'use client';

/**
 * @fileoverview **Δήλωση του ίδιου ↔ τιμή στην επαφή, και η «Υιοθέτηση»** — μέσα στο σήμα του λογαριασμού (ADR-915 §40.6).
 * @module components/contacts/details/DeclaredCredentialAdoption
 *
 * 🔑 «Στην επαφή: — / <τιμή>» δίπλα στη δήλωση · «Υιοθέτηση» **μόνο** όταν λείπει ή διαφέρει · πάντα με επιβεβαίωση
 *    παλιό → νέο (Salesforce Data.com Clean: ποτέ αυτόματη αντικατάσταση γεμάτου πεδίου).
 * 🔑 «Έλεγχος στο μητρώο» δίπλα, όπου η άδεια έχει δημόσια αναζήτηση — ο έλεγχος **πριν** από την υιοθέτηση.
 * Φορτώνεται μαζί με το σήμα (τεμπέλικα, `ContactLinkSurfaces`).
 */

import React, { useState } from 'react';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RegistryLookupLink } from '@/components/mandate/RegistryLookupLink';
import { REGISTRY_AUTHORITY_PRESENTATION, type RegistryAuthorityId } from '@/constants/professional-registries';
import {
  compareDeclaredCredential,
  declaredValueOf,
  type ComparableContact,
  type CredentialValue,
} from '@/lib/contacts/declared-credential-comparison';
import type { ContactDeclaredCredential } from '@/types/contact-professional-link';
import { ADOPTION_KEYS, PROFESSIONAL_LINK_KEYS } from './contact-professional-link-labels';
import { useAdoptDeclaredCredential } from './useAdoptDeclaredCredential';

/** «ΥΠΕΝ 2600» ή «Περιφέρεια 4521 · ΠΕ Θεσσαλονίκης» — η ΜΙΑ μορφή τιμής για δήλωση και επαφή. */
export function credentialText(t: Translate, authority: RegistryAuthorityId, value: CredentialValue): string {
  const registry = t(REGISTRY_AUTHORITY_PRESENTATION[authority].abbreviationKey);
  return value.chapter === null
    ? t(PROFESSIONAL_LINK_KEYS.declaredValue, { registry, number: value.number })
    : t(ADOPTION_KEYS.valueWithChapter, { registry, number: value.number, chapter: value.chapter });
}

export interface DeclaredCredentialAdoptionProps {
  readonly contactId: string;
  readonly declared: ContactDeclaredCredential;
  readonly contact: ComparableContact;
  readonly t: Translate;
}

/** Δύο κελιά του `<dl>` του σήματος: «Στην επαφή» + η πράξη. `null` όταν η δήλωση δεν υιοθετείται (ΓΕΜΗ). */
export function DeclaredCredentialAdoption({ contactId, declared, contact, t }: DeclaredCredentialAdoptionProps) {
  const [confirming, setConfirming] = useState(false);
  const { adopt, pending } = useAdoptDeclaredCredential(contactId, t);
  const comparison = compareDeclaredCredential(declared, contact);
  if (comparison.state === 'not-adoptable') return null;

  const current = comparison.current;
  const previous = current === null ? t(ADOPTION_KEYS.currentNone) : credentialText(t, declared.authority, current);
  const next = credentialText(t, declared.authority, declaredValueOf(declared));
  const canAdopt = comparison.state === 'absent' || comparison.state === 'different';
  const licence = comparison.target.kind === 'licence' ? comparison.target.licence : null;

  return (
    <>
      <dt className="text-muted-foreground">{t(ADOPTION_KEYS.currentLabel)}</dt>
      <dd className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{comparison.state === 'same' ? t(ADOPTION_KEYS.same) : previous}</span>
        {canAdopt && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
            {t(ADOPTION_KEYS.adopt)}
          </Button>
        )}
        {licence !== null && <RegistryLookupLink licence={licence} />}
      </dd>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(ADOPTION_KEYS.adoptTitle)}
        description={t(ADOPTION_KEYS.adoptDescription, { next, previous })}
        confirmText={t(ADOPTION_KEYS.adopt)}
        loading={pending}
        keepOpenWhilePending
        onConfirm={async () => {
          await adopt(current);
          setConfirming(false);
        }}
      />
    </>
  );
}
