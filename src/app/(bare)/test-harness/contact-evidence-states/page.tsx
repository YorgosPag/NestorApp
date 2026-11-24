import { notFound } from 'next/navigation';

import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';

import ContactEvidenceStatesHarness from './ContactEvidenceStatesHarness';

/**
 * ADR-950 §8.19 — σελίδα καταστάσεων του πίνακα «Το έγγραφο ↔ η επαφή».
 * Ίδιο μοτίβο με το `/test-harness/address-field-width`: φρουρός έκθεσης = το SSoT `isTestHarnessRouteEnabled()`.
 * **404 σε παραγωγή.**
 */
export default function ContactEvidenceStatesHarnessPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <ContactEvidenceStatesHarness />;
}
