/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΑΠΟΦΑΣΗΣ ΑΙΤΗΜΑΤΟΣ ΕΝΤΑΞΗΣ** (ADR-660 §6) — άγκυρες.
 */

jest.mock('server-only', () => ({}));

import { AUTH_ROUTES, PRIVATE_SPACE_HOME } from '@/lib/routes';

import {
  buildWorkspaceAccessDecisionEmail,
  everyLanguageHasDecisionWording,
} from '../workspace-access-decision-email';

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr'; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe('buildWorkspaceAccessDecisionEmail', () => {
  it('Ε1 — κάθε γλώσσα, κάθε απόφαση, όλα τα λόγια', () => {
    expect(everyLanguageHasDecisionWording()).toBe(true);
  });

  it('🔑 Ε2 — έγκριση ⇒ κουμπί προς τον ΧΩΡΟ ΕΡΓΑΣΙΑΣ· απόρριψη ⇒ προς τον ΔΙΚΟ του χώρο', () => {
    const approved = buildWorkspaceAccessDecisionEmail({ decision: 'approved', language: 'el', address: 'a@example.com' });
    const denied = buildWorkspaceAccessDecisionEmail({ decision: 'denied', language: 'el', address: 'a@example.com' });
    expect(approved?.text).toContain(`https://nestorconstruct.gr${AUTH_ROUTES.home}`);
    expect(denied?.text).toContain(`https://nestorconstruct.gr${PRIVATE_SPACE_HOME}`);
  });

  it('Ε3 — στη γλώσσα του παραλήπτη, με το `<html lang>` της', () => {
    const email = buildWorkspaceAccessDecisionEmail({ decision: 'denied', language: 'en', address: 'a@example.com' });
    expect(email?.subject).toBe('Your access request was not approved — Nestor App');
    expect(email?.html).toContain('<html lang="en">');
  });

  it('🔴 Ε4 — χωρίς δημόσια διεύθυνση ⇒ ΚΑΝΕΝΑ email (ποτέ σύνδεσμος που δεν ξέρουμε πού οδηγεί)', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildWorkspaceAccessDecisionEmail({ decision: 'approved', language: 'el', address: 'a@example.com' })).toBeNull();
  });
});
