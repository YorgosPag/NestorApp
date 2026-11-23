'use client';

/**
 * @fileoverview **Γιατί δεν έγινε ο «Έλεγχος στο μητρώο»** — η ΜΙΑ γραμμή αποτυχίας της πράξης, κοινή για το
 * ΓΕΜΗ της επαφής-εταιρείας (ADR-948 §8.7) και την άδεια επαγγελματία (ADR-915 §40.7 Φ2).
 * @module components/contacts/RegistryCheckActionFailureNotice
 *
 * 🔑 `role="alert"`: η αποτυχία έρχεται **μετά** από πάτημα — ο αναγνώστης οθόνης πρέπει να την ακούσει χωρίς να
 *    ψάξει. Η τελευταία γνωστή αναφορά μένει από πάνω (`useRegistryCheckReport`).
 * ⚠️ Μέλη αντικειμένου, ποτέ δυναμικό `${…}` (ο εξαγωγέας του slice, CHECK 3.34).
 */

import React from 'react';

import type { RegistryCheckActionFailure } from '@/hooks/useRegistryCheckReport';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const ACTION_FAILURE_KEYS: Readonly<Record<RegistryCheckActionFailure, string>> = {
  unavailable: 'contacts-form:registryAction.unavailable',
  'rate-limited': 'contacts-form:registryAction.rateLimited',
  forbidden: 'contacts-form:registryAction.forbidden',
  failed: 'contacts-form:registryAction.failed',
};

export function RegistryCheckActionFailureNotice({ failure }: { readonly failure: RegistryCheckActionFailure | null }) {
  const { t } = useTranslation('contacts-form');
  if (failure === null) return null;
  return <p className="m-0 text-xs text-destructive" role="alert">{t(ACTION_FAILURE_KEYS[failure])}</p>;
}
