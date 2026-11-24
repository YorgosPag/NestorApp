'use client';

/**
 * @fileoverview **«Αυτό το ΑΦΜ / email το έχει ήδη άλλη επαφή»** — ο διάλογος του φρουρού αποθήκευσης (ADR-944 §9).
 * @module components/contacts/dialogs/IdentifierDuplicateDialog
 *
 * Δύο όψεις της ίδιας απόφασης (`contact-identifier-duplicate-policy`):
 * - `block` — δύο φυσικά πρόσωπα με το ίδιο ΑΦΜ: **καμία** συνέχεια, μόνο «Κατάλαβα» και σύνδεσμος στην άλλη επαφή·
 * - `confirm` — κάθε άλλη συνύπαρξη: «Αποθήκευση παρ' όλα αυτά» ή «Ακύρωση».
 */

import React from 'react';

import { ContactHolderLinks } from '@/components/contacts/fields/ContactHolderLinks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IdentifierDuplicateDialogState } from '@/types/contact-submission-dialog.types';
import type { IdentifierDuplicateEntry } from '@/utils/contactForm/identifier-duplicate-guard';

/** Κλειστός πίνακας κλειδιών — μέλη, ποτέ δυναμικό `${…}` (ο εξαγωγέας του slice, ADR-744). */
const KEYS = {
  holdersLabel: 'contacts-form:validation.identifierDuplicate.holdersLabel',
  vatHeading: 'contacts-form:validation.identifierDuplicate.vatHeading',
  blockTitle: 'contacts-form:validation.identifierDuplicate.blockTitle',
  blockBody: 'contacts-form:validation.identifierDuplicate.blockBody',
  blockClose: 'contacts-form:validation.identifierDuplicate.blockClose',
  confirmTitle: 'contacts-form:validation.identifierDuplicate.confirmTitle',
  confirmBody: 'contacts-form:validation.identifierDuplicate.confirmBody',
  confirmSave: 'contacts-form:validation.identifierDuplicate.confirmSave',
  emailHeading: 'contacts-form:validation.emailDuplicate.heading',
} as const;

interface IdentifierDuplicateDialogProps {
  readonly state: IdentifierDuplicateDialogState;
  /** «Αποθήκευση παρ' όλα αυτά» — καλείται **μόνο** στην όψη `confirm`. */
  readonly onConfirm: () => void | Promise<void>;
  /** Κλείσιμο χωρίς αποθήκευση: «Ακύρωση», «Κατάλαβα», Escape. */
  readonly onDismiss: () => void;
}

function HolderEntry({ heading, entry }: { readonly heading: string; readonly entry: IdentifierDuplicateEntry }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
      <span className="font-medium text-foreground">{heading}</span>
      <ContactHolderLinks holders={entry.holders} />
    </li>
  );
}

export function IdentifierDuplicateDialog({ state, onConfirm, onDismiss }: IdentifierDuplicateDialogProps) {
  const { t } = useTranslation(['contacts-form']);
  const blocked = state.decision === 'block';
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onDismiss(); }}
      title={t(blocked ? KEYS.blockTitle : KEYS.confirmTitle)}
      description={t(blocked ? KEYS.blockBody : KEYS.confirmBody)}
      variant={blocked ? 'destructive' : 'warning'}
      confirmText={t(blocked ? KEYS.blockClose : KEYS.confirmSave)}
      hideCancelButton={blocked}
      onConfirm={blocked ? onDismiss : onConfirm}
    >
      <ul aria-label={t(KEYS.holdersLabel)} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {state.vat !== null && (
          <HolderEntry heading={t(KEYS.vatHeading, { vatNumber: state.vat.value })} entry={state.vat} />
        )}
        {state.emails.map((entry) => (
          <HolderEntry key={entry.value} heading={t(KEYS.emailHeading, { email: entry.value })} entry={entry} />
        ))}
      </ul>
    </ConfirmDialog>
  );
}
