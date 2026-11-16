/**
 * @fileoverview ADR-943 — **οι λέξεις της προκαταβολής** (πολιτική ακύρωσης · κατάσταση · γραμμή του πίνακα ακύρωσης),
 *   δεμένες στο κλειστό λεξιλόγιο του τομέα (`issuance-advance.ts`): νέα τιμή **δεν μεταγλωττίζεται** χωρίς λέξη.
 * @module components/document-registry/issuance-advance-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34 τα λύνει στατικά).
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AdvanceStateKind, CancellationPolicyId, CancellationScheduleRow } from '@/lib/document-validity/issuance-advance';

type Translate = ReturnType<typeof useTranslation>['t'];

export function policyText(t: Translate, policy: CancellationPolicyId): string {
  switch (policy) {
    case 'flexible': return t('document-registry:issuance.advance.policy.flexible');
    case 'moderate': return t('document-registry:issuance.advance.policy.moderate');
    case 'strict': return t('document-registry:issuance.advance.policy.strict');
  }
}

export function policyHintText(t: Translate, policy: CancellationPolicyId): string {
  switch (policy) {
    case 'flexible': return t('document-registry:issuance.advance.policyHint.flexible');
    case 'moderate': return t('document-registry:issuance.advance.policyHint.moderate');
    case 'strict': return t('document-registry:issuance.advance.policyHint.strict');
  }
}

export function advanceStateText(t: Translate, state: AdvanceStateKind): string {
  switch (state) {
    case 'none': return t('document-registry:issuance.advance.state.none');
    case 'awaiting-payment': return t('document-registry:issuance.advance.state.awaitingPayment');
    case 'held': return t('document-registry:issuance.advance.state.held');
    case 'release-pending': return t('document-registry:issuance.advance.state.releasePending');
    case 'disputed': return t('document-registry:issuance.advance.state.disputed');
    case 'released': return t('document-registry:issuance.advance.state.released');
    case 'refunded': return t('document-registry:issuance.advance.state.refunded');
  }
}

export function scheduleWhenText(t: Translate, when: CancellationScheduleRow['when']): string {
  switch (when) {
    case 'before-start': return t('document-registry:issuance.advance.schedule.before-start');
    case 'after-start-within-withdrawal': return t('document-registry:issuance.advance.schedule.after-start-within-withdrawal');
    case 'after-start-later': return t('document-registry:issuance.advance.schedule.after-start-later');
  }
}
