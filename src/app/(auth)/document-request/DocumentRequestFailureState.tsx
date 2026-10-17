'use client';

/**
 * @fileoverview ADR-915 §28 — **ο λόγος**, όταν ο σύνδεσμος δεν απαντά: κάθε άρνηση με όνομα («έληξε» · «αντικαταστάθηκε» ·
 *   «απαντήθηκε ήδη» · «άλλαξε ο υπεύθυνος»), ποτέ ένα γενικό «άκυρος σύνδεσμος».
 * @related DocumentRequestGate.tsx · DocumentRequestCard.tsx (οι δύο καταναλωτές) · document-request-api.ts (οι κωδικοί)
 * @module app/(auth)/document-request/DocumentRequestFailureState
 */

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { DocumentRequestFailure } from './document-request-api';

/** Τίτλος + εξήγηση ανά αποτυχία — κυριολεκτικά κλειδιά στο ίδιο module με τις κλήσεις (CHECK 3.34). */
const FAILURE_TITLE_KEYS: Readonly<Record<DocumentRequestFailure, string>> = {
  'link-invalid': 'document-request:failure.invalid.title',
  'link-foreign': 'document-request:failure.invalid.title',
  'invitation-unknown': 'document-request:failure.invalid.title',
  'wrong-recipient': 'document-request:failure.invalid.title',
  'missing-link': 'document-request:failure.missing.title',
  expired: 'document-request:failure.expired.title',
  'already-used': 'document-request:failure.used.title',
  revoked: 'document-request:failure.superseded.title',
  superseded: 'document-request:failure.superseded.title',
  'lead-changed': 'document-request:failure.leadChanged.title',
  'answer-mismatch': 'document-request:failure.server.title',
  unavailable: 'document-request:failure.server.title',
  'server-error': 'document-request:failure.server.title',
};

const FAILURE_BODY_KEYS: Readonly<Record<DocumentRequestFailure, string>> = {
  'link-invalid': 'document-request:failure.invalid.body',
  'link-foreign': 'document-request:failure.invalid.body',
  'invitation-unknown': 'document-request:failure.invalid.body',
  'wrong-recipient': 'document-request:failure.invalid.body',
  'missing-link': 'document-request:failure.missing.body',
  expired: 'document-request:failure.expired.body',
  'already-used': 'document-request:failure.used.body',
  revoked: 'document-request:failure.superseded.body',
  superseded: 'document-request:failure.superseded.body',
  'lead-changed': 'document-request:failure.leadChanged.body',
  'answer-mismatch': 'document-request:failure.server.body',
  unavailable: 'document-request:failure.server.body',
  'server-error': 'document-request:failure.server.body',
};

export function DocumentRequestFailureState({ failure }: { readonly failure: DocumentRequestFailure }) {
  const { t } = useTranslation(['document-request']);
  return (
    <AuthCardSection gap={2} role="alert">
      <h1 className="m-0 text-lg font-semibold text-card-foreground">{t(FAILURE_TITLE_KEYS[failure])}</h1>
      <p className="m-0 text-sm text-muted-foreground">{t(FAILURE_BODY_KEYS[failure])}</p>
    </AuthCardSection>
  );
}
