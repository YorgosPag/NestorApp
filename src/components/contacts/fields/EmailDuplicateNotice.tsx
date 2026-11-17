'use client';

/**
 * @fileoverview **«Το email υπάρχει ήδη σε…»** κάτω από την ενότητα email της φόρμας επαφής (ADR-944).
 * @module components/contacts/fields/EmailDuplicateNotice
 *
 * Πρότυπο Salesforce «Allow with Alert»: **σύνδεσμος** σε κάθε υπάρχουσα επαφή, **καμία** άρνηση αποθήκευσης.
 * 🔑 `role="status"` (ευγενική ανακοίνωση), όχι `alert`: δεν είναι σφάλμα, είναι πληροφορία πριν την αποθήκευση.
 * 🔑 Κείμενο + εικονίδιο, ποτέ μόνο χρώμα (CHECK 3.41).
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { Link } from '@/lib/workspace/navigation';
import { cn } from '@/lib/utils';
import { useContactEmailUniqueness } from '@/hooks/useContactEmailUniqueness';
import type { EmailDuplicateWarning } from '@/lib/validation/contact-email-uniqueness';

/** Κλειστός πίνακας κλειδιών — μέλη, ποτέ δυναμικό `${…}` (ο εξαγωγέας του slice, ADR-744). */
const EMAIL_DUPLICATE_KEYS = {
  region: 'contacts-form:validation.emailDuplicate.region',
  heading: 'contacts-form:validation.emailDuplicate.heading',
  unnamedContact: 'contacts-form:validation.emailDuplicate.unnamedContact',
  hint: 'contacts-form:validation.emailDuplicate.hint',
} as const;

export interface EmailDuplicateNoticeProps {
  readonly emails: readonly string[];
  /** Η επαφή που επεξεργάζεται — δεν είναι «διπλή» του εαυτού της. */
  readonly excludeContactId?: string;
}

function WarningItem({ warning }: { readonly warning: EmailDuplicateWarning }) {
  const { t } = useTranslation(['contacts-form']);
  return (
    <li className="flex flex-col gap-0.5">
      <span>{t(EMAIL_DUPLICATE_KEYS.heading, { email: warning.email })}</span>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 p-0">
        {warning.contacts.map((contact) => (
          <li key={contact.id}>
            <Link href={ENTITY_ROUTES.contacts.withId(contact.id)} className={cn(TOUCH_TARGET_MIN, 'underline underline-offset-4')}>
              {contact.name !== '' ? contact.name : t(EMAIL_DUPLICATE_KEYS.unnamedContact)}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function EmailDuplicateNotice({ emails, excludeContactId }: EmailDuplicateNoticeProps) {
  const { t } = useTranslation(['contacts-form']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { warnings } = useContactEmailUniqueness(emails, excludeContactId);
  if (warnings.length === 0) return null;
  return (
    <section role="status" aria-label={t(EMAIL_DUPLICATE_KEYS.region)} className="flex gap-2 text-xs">
      <AlertTriangle className={cn(iconSizes.sm, colors.text.warning, 'shrink-0')} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {warnings.map((warning) => <WarningItem key={warning.email} warning={warning} />)}
        </ul>
        <p className={cn('m-0', colors.text.muted)}>{t(EMAIL_DUPLICATE_KEYS.hint)}</p>
      </div>
    </section>
  );
}
