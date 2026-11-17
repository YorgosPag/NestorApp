'use client';

/**
 * @fileoverview **«Υιοθέτηση ονόματος από τον λογαριασμό»** — κάτω από το «Διαφορετικό όνομα» του σήματος (ADR-915 §40.9).
 * @module components/contacts/details/AccountNameAdoption
 *
 * 🔑 Ρητή πράξη με επιβεβαίωση παλιό → νέο + επιπτώσεις (ADR-249) + προειδοποίηση ταυτότητας: το «διαφορετικό όνομα»
 *    μπορεί να σημαίνει **άλλο πρόσωπο**, και τότε η υιοθέτηση θα έκρυβε το λάθος αντί να το διορθώσει.
 * 🔑 Λογαριασμός χωρίς χωριστό όνομα **και** επώνυμο ⇒ ανενεργό κουμπί + **ορατή** εξήγηση (όχι tooltip — αφή,
 *    αναγνώστης οθόνης), ποτέ μαντεψιά διάσπασης.
 */

import React, { useState } from 'react';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { contactPersonFullName, type ContactPersonName } from '@/lib/engagements/contact-account-name-match';
import type { ContactLinkedAccount } from '@/types/contact-professional-link';
import { ACCOUNT_NAME_ADOPTION_KEYS } from './contact-professional-link-labels';
import { useAdoptAccountName, type NameAdoptionImpact } from './useAdoptAccountName';

function impactText(impact: NameAdoptionImpact, t: Translate): string {
  if (impact.state === 'loading') return t(ACCOUNT_NAME_ADOPTION_KEYS.impactLoading);
  if (impact.state === 'unavailable') return t(ACCOUNT_NAME_ADOPTION_KEYS.impactUnavailable);
  return impact.totalAffected === 0
    ? t(ACCOUNT_NAME_ADOPTION_KEYS.impactNone)
    : t(ACCOUNT_NAME_ADOPTION_KEYS.impact, { count: impact.totalAffected });
}

export interface AccountNameAdoptionProps {
  readonly contactId: string;
  readonly account: ContactLinkedAccount;
  /** Το όνομα της επαφής όπως το βλέπει τώρα το γραφείο — η τιμή του CAS. */
  readonly contactName: ContactPersonName;
  readonly t: Translate;
}

export function AccountNameAdoption({ contactId, account, contactName, t }: AccountNameAdoptionProps) {
  const [confirming, setConfirming] = useState(false);
  const { adopt, pending, impact, loadImpact } = useAdoptAccountName(contactId, t);
  const proposed = account.proposedName;

  if (proposed === null) {
    return <span className="text-muted-foreground">{t(ACCOUNT_NAME_ADOPTION_KEYS.unstructured)}</span>;
  }

  const open = () => {
    setConfirming(true);
    void loadImpact();
  };

  return (
    <>
      <span>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={open}>
          {t(ACCOUNT_NAME_ADOPTION_KEYS.button)}
        </Button>
      </span>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(ACCOUNT_NAME_ADOPTION_KEYS.title)}
        description={t(ACCOUNT_NAME_ADOPTION_KEYS.description, { next: contactPersonFullName(proposed), previous: contactPersonFullName(contactName) })}
        variant="warning"
        confirmText={t(ACCOUNT_NAME_ADOPTION_KEYS.button)}
        loading={pending}
        keepOpenWhilePending
        onConfirm={async () => {
          await adopt(contactName);
          setConfirming(false);
        }}
      >
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>{t(ACCOUNT_NAME_ADOPTION_KEYS.identityWarning)}</li>
          <li aria-live="polite">{impactText(impact, t)}</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
