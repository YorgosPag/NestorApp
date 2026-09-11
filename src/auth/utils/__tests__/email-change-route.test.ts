/**
 * @fileoverview **Πώς αλλάζει το email — ανά πάροχο** (ADR-850).
 * @related auth/utils/authProviders.ts (`emailChangeRouteOf`)
 *
 * 🔴 Η σοβαρή γραμμή είναι η **μόνο-Google**: εκεί το `verifyBeforeUpdateEmail` γεννά
 * **διπλό** πάροχο `google.com` (firebase-android-sdk#4505). Ο δρόμος οφείλει να είναι
 * «πρώτα κωδικός» (πρότυπο Figma), ποτέ το κουμπί αλλαγής.
 */

import { emailChangeRouteOf, type EmailChangeRoute } from '../authProviders';

describe('Δ — ο δρόμος αλλαγής email ανά πάροχο', () => {
  it.each<[readonly string[], EmailChangeRoute]>([
    [['password'], 'password'],
    [['google.com', 'password'], 'password'],
    [['google.com'], 'provider-managed'],
    [[], 'needs-password'],
  ])('%j ⇒ %s', (providerIds, expected) => {
    expect(emailChangeRouteOf(providerIds)).toBe(expected);
  });
});
