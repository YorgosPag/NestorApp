'use client';

/**
 * @fileoverview Οι επαφές που έχουν ήδη ένα στοιχείο (ΑΦΜ · email), ως σύνδεσμοι (ADR-944 §9).
 * @module components/contacts/fields/ContactHolderLinks
 *
 * 🔑 **Νέα καρτέλα**: εμφανίζεται πάντα δίπλα σε φόρμα με μη αποθηκευμένες αλλαγές — ο άνθρωπος κοιτά την άλλη
 *    επαφή χωρίς να χάσει ό,τι γράφει.
 */

import React from 'react';

import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IdentifierHolder } from '@/lib/contacts/contact-identifier-duplicate-policy';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';

const UNNAMED_CONTACT_KEY = 'contacts-form:validation.emailDuplicate.unnamedContact';

export function ContactHolderLinks({ holders }: { readonly holders: readonly IdentifierHolder[] }) {
  const { t } = useTranslation(['contacts-form']);
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 p-0">
      {holders.map((holder) => (
        <li key={holder.id}>
          <Link
            href={ENTITY_ROUTES.contacts.withId(holder.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(TOUCH_TARGET_MIN, 'underline underline-offset-4')}
          >
            {holder.name !== '' ? holder.name : t(UNNAMED_CONTACT_KEY)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
