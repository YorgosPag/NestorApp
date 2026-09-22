/**
 * @jest-environment jsdom
 *
 * @fileoverview **Ε-Η (ADR-853 §18) — Ο ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΔΕΝ ΔΕΙΧΝΕΙ ΠΟΥΘΕΝΑ ΑΠΑΝΤΑ 404.**
 * @related app/(auth)/invite/[token]/page.tsx · not-found.tsx · REFUSAL_IS_NOT_FOUND
 *
 * 🔴 **Το εύρημα**: η σελίδα απαντούσε **200** σε **κάθε** άρνηση — ακόμη και σε σύνδεσμο με
 * χαλασμένη υπογραφή — ενώ το API της ίδιας όψης απαντά σωστά 400/421.
 *
 *   Σ1  Κάθε άρνηση του κλειστού συνόλου έχει **απάντηση δικτύου** (καμία σιωπή)
 *   Σ2  🔴 Η γραμμή είναι **«υπάρχει πρόσκληση;»**, όχι «σφάλμα;» — ονομαστικά και στα δύο σκέλη
 *   Σ3  Η σελίδα **καλεί** `notFound()`, και **πίσω από τον πίνακα** (όχι με δικό της `if`)
 *   Σ4  Το 404 της διαδρομής **μιλά για πρόσκληση**, ποτέ γυμνό «η σελίδα δεν βρέθηκε»
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/intl-formatting', () => ({
  formatDeadlineRelative: () => 'σε 7 ημέρες',
  formatDateShort: () => '19/09/2026',
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock('@/services/workspace/workspace-invitation.client', () => ({
  redeemWorkspaceInvitationFromScreen: jest.fn(),
}));
jest.mock('@/lib/browser/document-navigation', () => ({ navigateDocument: jest.fn() }));
jest.mock('@/auth', () => ({ useAuthOptional: () => null }));
jest.mock('server-only', () => ({}));

import WorkspaceInviteNotFound from '@/app/(auth)/invite/[token]/not-found';
import { REFUSAL_IS_NOT_FOUND, REFUSAL_KEY } from '../workspace-invite-labels';
import { WORKSPACE_INVITATION_REFUSALS } from '@/types/workspace-invitation';

const PAGE = path.join(process.cwd(), 'src/app/(auth)/invite/[token]/page.tsx');

describe('Σ — τι απαντά το δίκτυο για κάθε άρνηση', () => {
  it('Σ1 — κάθε άρνηση του κλειστού συνόλου έχει απάντηση (καμία σιωπή)', () => {
    expect(WORKSPACE_INVITATION_REFUSALS.length).toBeGreaterThan(0); // παρονομαστής
    for (const reason of WORKSPACE_INVITATION_REFUSALS) {
      expect(typeof REFUSAL_IS_NOT_FOUND[reason]).toBe('boolean');
    }
  });

  it('🔴 Σ2 — η γραμμή είναι «υπάρχει πρόσκληση;», όχι «σφάλμα;»', () => {
    // Ο σύνδεσμος δεν αντιστοιχεί σε τίποτα ⇒ 404.
    expect(REFUSAL_IS_NOT_FOUND['link-invalid']).toBe(true);
    expect(REFUSAL_IS_NOT_FOUND['link-foreign']).toBe(true);
    expect(REFUSAL_IS_NOT_FOUND['invitation-unknown']).toBe(true);
    // Η πρόσκληση **υπάρχει** και το σώμα είναι η κατάστασή της ⇒ 200 (πρότυπο Slack/GitHub).
    expect(REFUSAL_IS_NOT_FOUND.expired).toBe(false);
    expect(REFUSAL_IS_NOT_FOUND.revoked).toBe(false);
    expect(REFUSAL_IS_NOT_FOUND['already-used']).toBe(false);
    expect(REFUSAL_IS_NOT_FOUND['wrong-recipient']).toBe(false);
    expect(REFUSAL_IS_NOT_FOUND['already-member']).toBe(false);
  });

  it('🔴 Σ3 — η σελίδα καλεί `notFound()` ΠΙΣΩ ΑΠΟ ΤΟΝ ΠΙΝΑΚΑ, όχι με δικό της κριτήριο', () => {
    const page = readFileSync(PAGE, 'utf8');

    expect(page).toContain("import { notFound } from 'next/navigation'");
    expect(page).toContain('REFUSAL_IS_NOT_FOUND[outcome.reason]');
    expect(page).toContain('notFound();');
    // ⛔ Κανένα ονομαστικό `if (reason === 'expired')` στη σελίδα: δεύτερο κριτήριο εδώ
    //    σημαίνει ότι ο πίνακας λέει άλλα από ό,τι κάνει το δίκτυο.
    expect(page).not.toMatch(/reason === '(expired|revoked|link-invalid|invitation-unknown)'/);
  });

  it('Σ4 — το 404 της διαδρομής ΜΙΛΑ για πρόσκληση, ποτέ γυμνό «δεν βρέθηκε»', () => {
    render(<WorkspaceInviteNotFound />);

    expect(screen.getByText(REFUSAL_KEY['invitation-unknown'])).toBeInTheDocument();
  });
});
