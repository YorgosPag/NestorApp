'use client';

/**
 * @fileoverview **«ΕΠΙΒΕΒΑΙΩΣΤΕ ΤΟ ΟΝΟΜΑ»** — η καρτέλα που γεννήθηκε από λογαριασμό με ενιαίο όνομα (ADR-884 §9.1 Α1).
 * @related `lib/contacts/contact-name-review.ts` (το σήμα + η πρόταση) · `services/contacts.service.ts` (ο γραφέας)
 * @module components/contacts/details/ContactNameReviewNotice
 *
 * 🔑 **Το σύστημα προτείνει, ο άνθρωπος αποφασίζει**: η πρόταση (1η λέξη όνομα / υπόλοιπο επώνυμο) έχει **αντιστροφή** με
 * ένα κλικ για το «Παπαδοπούλου Μαρία»· «Κράτα ως έχει» σβήνει μόνο το σήμα. Καμία εγγραφή χωρίς πάτημα.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nameReviewFromDocument, proposeNameSplit, type NameSplitProposal } from '@/lib/contacts/contact-name-review';
import { createModuleLogger } from '@/lib/telemetry';
import { ContactsService } from '@/services/contacts.service';
import type { Contact } from '@/types/contacts';

const logger = createModuleLogger('contact-name-review');

const KEYS = {
  title: 'contacts:nameReview.title',
  fromAccount: 'contacts:nameReview.fromAccount',
  fromEmail: 'contacts:nameReview.fromEmail',
  proposal: 'contacts:nameReview.proposal',
  swap: 'contacts:nameReview.swap',
  apply: 'contacts:nameReview.apply',
  keep: 'contacts:nameReview.keep',
  failed: 'contacts:nameReview.failed',
} as const;

/** `split` ⇒ γράφονται όνομα + επώνυμο· `keep` ⇒ τα ονόματα μένουν ως έχουν, σβήνει **μόνο** το σήμα. */
type Decision = { readonly kind: 'split'; readonly proposal: NameSplitProposal } | { readonly kind: 'keep' };

async function confirmName(contactId: string, decision: Decision): Promise<boolean> {
  const names = decision.kind === 'keep' ? {} : {
    firstName: decision.proposal.givenName,
    lastName: decision.proposal.familyName,
    displayName: `${decision.proposal.givenName} ${decision.proposal.familyName}`,
  };
  try {
    await ContactsService.updateContact(contactId, { ...names, nameReview: null });
    return true;
  } catch (error) {
    logger.error('Η επιβεβαίωση ονόματος επαφής απέτυχε', { contactId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function Proposal({ proposal, onSwap }: { readonly proposal: NameSplitProposal; readonly onSwap: () => void }) {
  const { t } = useTranslation(['contacts']);
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span>{t(KEYS.proposal, { given: proposal.givenName, family: proposal.familyName })}</span>
      <Button type="button" variant="link" size="sm" onClick={onSwap}>{t(KEYS.swap)}</Button>
    </p>
  );
}

export function ContactNameReviewNotice({ contact, onConfirmed }: {
  readonly contact: Contact;
  readonly onConfirmed?: () => void;
}) {
  const { t } = useTranslation(['contacts']);
  const [swapped, setSwapped] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'done'>('idle');
  const review = contact.type === 'individual' ? nameReviewFromDocument(contact.nameReview) : null;
  if (review === null || state === 'done' || contact.id === undefined) return null;
  const contactId = contact.id;
  const proposal = proposeNameSplit(review, swapped);
  const decide = async (decision: Decision) => {
    setState('saving');
    const ok = await confirmName(contactId, decision);
    setState(ok ? 'done' : 'failed');
    if (ok) onConfirmed?.();
  };
  return (
    <aside aria-labelledby="contact-name-review-title" className="space-y-2 rounded-md border border-dashed p-3 text-sm">
      <h3 id="contact-name-review-title" className="font-medium">{t(KEYS.title)}</h3>
      <p className="text-muted-foreground">{t(review.source === 'account-email' ? KEYS.fromEmail : KEYS.fromAccount, { raw: review.raw })}</p>
      {proposal !== null && <Proposal proposal={proposal} onSwap={() => setSwapped((value) => !value)} />}
      <footer className="flex flex-wrap gap-2">
        {proposal !== null && (
          <Button type="button" size="sm" disabled={state === 'saving'}
            onClick={() => void decide({ kind: 'split', proposal })}>{t(KEYS.apply)}</Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={state === 'saving'}
          onClick={() => void decide({ kind: 'keep' })}>{t(KEYS.keep)}</Button>
      </footer>
      {state === 'failed' && <p className="text-destructive" role="alert">{t(KEYS.failed)}</p>}
    </aside>
  );
}
