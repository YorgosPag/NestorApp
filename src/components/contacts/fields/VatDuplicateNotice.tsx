'use client';

/**
 * @fileoverview **«Το ΑΦΜ το έχει ήδη…»** — η μία όψη του κανόνα διπλού ΑΦΜ, πριν από την αποθήκευση (ADR-944 §9).
 * @module components/contacts/fields/VatDuplicateNotice
 *
 * Ίδια γραμμή κάτω από το πεδίο ΑΦΜ της φόρμας και μέσα στον διάλογο «Διόρθωση ανάγνωσης»: ποιος έχει το ΑΦΜ (με
 * σύνδεσμο) και τι θα γίνει στην αποθήκευση — `block` ή `confirm`, όπως το κρίνει το `decideVatDuplicate`.
 *
 * 🔑 `block` ⇒ `role="alert"` (η αποθήκευση δεν θα γίνει)· `confirm` ⇒ `role="status"` (πληροφορία).
 * 🔑 Κείμενο + εικονίδιο, ποτέ μόνο χρώμα (CHECK 3.41).
 */

import React from 'react';
import { AlertTriangle, Ban } from 'lucide-react';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  IdentifierDuplicateDecision,
  IdentifierHolder,
} from '@/lib/contacts/contact-identifier-duplicate-policy';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { ContactHolderLinks } from './ContactHolderLinks';

/** Κλειστός πίνακας κλειδιών — μέλη, ποτέ δυναμικό `${…}` (ο εξαγωγέας του slice, ADR-744). */
const KEYS = {
  region: 'contacts-form:validation.identifierDuplicate.vatRegion',
  heading: 'contacts-form:validation.identifierDuplicate.vatHeading',
  blockHint: 'contacts-form:validation.identifierDuplicate.vatBlockHint',
  confirmHint: 'contacts-form:validation.identifierDuplicate.vatConfirmHint',
} as const;

export interface VatDuplicateNoticeProps {
  readonly vatNumber: string;
  readonly decision: IdentifierDuplicateDecision;
  readonly holders: readonly IdentifierHolder[];
}

export function VatDuplicateNotice({ vatNumber, decision, holders }: VatDuplicateNoticeProps) {
  const { t } = useTranslation(['contacts-form']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (decision === 'allow' || holders.length === 0) return null;
  const blocked = decision === 'block';
  const Icon = blocked ? Ban : AlertTriangle;
  return (
    <section role={blocked ? 'alert' : 'status'} aria-label={t(KEYS.region)} className="mt-1 flex gap-2 text-xs">
      <Icon className={cn(iconSizes.sm, blocked ? 'text-destructive' : colors.text.warning, 'shrink-0')} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <span className={cn(blocked && 'font-medium text-destructive')}>{t(KEYS.heading, { vatNumber })}</span>
        <ContactHolderLinks holders={holders} />
        <p className={cn('m-0', colors.text.muted)}>{t(blocked ? KEYS.blockHint : KEYS.confirmHint)}</p>
      </div>
    </section>
  );
}
