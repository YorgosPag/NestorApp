/**
 * ADR-916 Φ-Ε1 — η ανανέωση που ΔΕΝ αλλάζει την ημέρα λήξης ΔΕΝ γίνεται.
 *
 * 🔴 Ζωντανή επαλήθευση 2026-11-18: πρόσβαση ανανεωμένη το ίδιο πρωί ⇒ ο διάλογος έγραφε
 * «Λήξη: Τρί 16 Φεβ 2027 → Τρί 16 Φεβ 2027» με ενεργό «Ανανέωση» — πράξη χωρίς ορατή αλλαγή που ΕΙΔΟΠΟΙΕΙ τον
 * επαγγελματία. Η κοκκοποίηση είναι η **ημέρα** (ώρα Ελλάδας), όπως τη δείχνει ο διάλογος — όχι το χιλιοστό.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { dossierShareExpiresAt } from '@/config/engagement-policy';
import type { DossierEngagementSummary } from '@/types/dossier-access';
import { DossierRenewDialog } from '../DossierEngagementDialogs';

const K = 'property-market:dossier.access.renewDialog';
/** Τετάρτη 18/11/2026, 12:00 ώρα Ελλάδας. */
const NOW_MS = Date.parse('2026-11-18T10:00:00.000Z');
const HOUR_MS = 3_600_000;

function engagementExpiringAt(expiresAt: string): DossierEngagementSummary {
  return {
    engagementId: 'eng_test',
    role: 'owner_lawyer',
    state: 'active',
    verdict: 'engaged',
    email: 'lawyer@example.test',
    reach: { tabs: ['floorplan', 'documents'], excludedFileIds: [] },
    shareDays: 90,
    offeredAt: '2026-11-17T08:00:00.000Z',
    respondedAt: '2026-11-17T09:00:00.000Z',
    closedAt: null,
    expiresAt,
    declaredCredential: null,
  };
}

function renderRenew(expiresAt: string, busy = false) {
  render(<DossierRenewDialog engagement={engagementExpiringAt(expiresAt)} busy={busy} onCancel={jest.fn()} onRenew={jest.fn()} />);
  return screen.getByRole('button', { name: busy ? `${K}.confirming` : `${K}.confirm` }) as HTMLButtonElement;
}

beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW_MS); });
afterEach(() => { jest.restoreAllMocks(); });

describe('Φ-Ε1 — ανανέωση χωρίς αλλαγή ημέρας λήξης', () => {
  it('ανανεωμένη πριν από 2 ώρες, ίδια διάρκεια ⇒ «δεν αλλάζει» · κουμπί κλειδωμένο · ΚΑΜΙΑ «Συντόμευση»', () => {
    const confirm = renderRenew(dossierShareExpiresAt(90, NOW_MS - 2 * HOUR_MS));
    expect(screen.getByText(`${K}.unchanged`)).toBeTruthy();
    expect(confirm.disabled).toBe(true);
    expect(screen.queryByText(`${K}.shortens`)).toBeNull();
  });

  it('η λήξη μετακινείται ⇒ καμία γραμμή «δεν αλλάζει» · κουμπί ενεργό', () => {
    const confirm = renderRenew(dossierShareExpiresAt(90, NOW_MS - 5 * 24 * HOUR_MS));
    expect(screen.queryByText(`${K}.unchanged`)).toBeNull();
    expect(confirm.disabled).toBe(false);
  });

  it('αλλαγή ενώ τρέχει ήδη η αποστολή ⇒ κουμπί κλειδωμένο (το `canSubmit` δεν παρακάμπτει το `busy`)', () => {
    const confirm = renderRenew(dossierShareExpiresAt(90, NOW_MS - 5 * 24 * HOUR_MS), true);
    expect(confirm.disabled).toBe(true);
  });
});
