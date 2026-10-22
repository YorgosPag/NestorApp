/**
 * 🔴 ΑΓΚΥΡΑ — **Η ΓΚΑΛΕΡΙ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΑΓΟΡΑΣΤΗ ΔΕΙΧΝΕΙ ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ, ΚΑΙ ΔΕΝ ΤΗ ΘΥΜΑΤΑΙ ΑΝΘΡΩΠΟΣ** (ADR-916 Φ-Β2).
 * @related components/handover-invite/testing/* · πρότυπο `components/contact/__tests__/first-contact-proof-gallery.test.tsx`
 *
 * Ρωτά **μόνο** όσα δεν μπορούν να ρωτήσουν οι άλλες άγκυρες (η αποκωδικοποίηση είναι ήδη αγκυρωμένη στο
 * `lib/invitations/__tests__/invitation-link-refusal.test.ts` και η ροή στο fake Firestore στις Β11–Β26):
 *   Α — υπάρχει πάνελ για **κάθε** μέλος κάθε κλειστού συνόλου; (ο αριθμός **παράγεται**, δεν γράφεται)
 *   Β — δείχνει το κάθε πάνελ **το δικό του** κείμενο, αφού **πατηθεί** όπως από άνθρωπο;
 *   Γ — ο ψεύτικος μεταφορέας **επαναφέρεται** (αλλιώς η γκαλερί θα μόλυνε το κέλυφος).
 *
 * Μεταλλάξεις που πρέπει να ρίξουν αυτό το αρχείο: χειρόγραφη λίστα αρνήσεων που ξεχνά μία (Α1) · ο μεταφορέας αγνοεί
 * το token (Β1 — όλα τα πάνελ ίδια) · το πάνελ πατά πριν το `armed` (Β1) · χωρίς επαναφορά στο unmount (Γ1).
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    // ⚠️ Αντικείμενο, ΠΟΤΕ read-only mock: η γκαλερί το **μπαλώνει** — αυτή είναι η ραφή που ελέγχουμε.
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    ApiClientError: types.ApiClientError,
    apiErrorBodyOf: types.apiErrorBodyOf,
  };
});
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: jest.fn() }));
jest.mock('@/lib/intl-formatting', () => ({ formatDateTime: (iso: string) => `abs(${iso})` }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/lib/browser/document-navigation', () => ({ navigateDocument: jest.fn() }));
jest.mock('@/auth', () => ({ useAuthOptional: () => ({ signOut: jest.fn(), refreshToken: jest.fn() }) }));
// ADR-916 §5.13 — η λήψη περνά από τον ΠΡΑΓΜΑΤΙΚΟ `useFileDownload` ως τον μεταφορέα της γκαλερί· εδώ μόνο η ειδοποίηση.
const mockDownloadError = jest.fn();
jest.mock('@/hooks/notifications/useFilesNotifications', () => ({
  useFilesNotifications: () => ({ list: { downloadError: mockDownloadError } }),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { dossierDetailHref, MY_DOSSIERS_ROUTE } from '@/lib/property-dossier/property-dossier-routes';
import { HANDOVER_PROTOCOL_LEGAL_DOCUMENT } from '@/lib/property-handover/handover-protocol-terms';
import { legalDocumentVersionHref } from '@/lib/routes/legalRoutes';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';
import { PROPERTY_HANDOVER_INVITATION_OCCASIONS, PROPERTY_HANDOVER_LIFECYCLES } from '@/types/property-handover';
import { PROPERTY_HANDOVER_INVITATION_REFUSALS } from '@/types/property-handover-invitation';

import {
  HANDOVER_INVITE_ACCEPTED_BODY_KEY,
  HANDOVER_INVITE_KEYS,
  HANDOVER_INVITE_REFUSAL_KEY,
} from '../handover-invite-labels';
import { HandoverInviteHarness } from '../testing/HandoverInviteHarness';
import {
  ANSWER_SCENARIOS,
  HARNESS_PROTOCOL_DOWNLOADS,
  HARNESS_PROTOCOL_REVISIONS,
  ORIGIN_SCENARIOS,
  SERVER_SCENARIOS,
} from '../testing/handover-invite-scenarios';

/** Ταβάνι, όχι χρονισμός: η αναμονή σταματά στο **δηλωμένο σήμα** της οθόνης (ADR-844 §11). */
const SETTLE_TIMEOUT_MS = 8000;
const ids = (list: readonly { readonly id: string }[]) => list.map((scenario) => scenario.id);
const panel = (id: string) => screen.getByTestId(`harness-panel-${id}`);
const PROTOCOL_PANEL_COUNT = HARNESS_PROTOCOL_REVISIONS.length * HARNESS_PROTOCOL_DOWNLOADS.length;

/**
 * **Αποδίδει και περιμένει να ΚΑΤΑΣΤΑΛΑΞΕΙ κάθε πάνελ απάντησης** — σήμα της οθόνης, όχι χρόνος: όσο ένα πάνελ έχει ακόμη
 * κουμπί πράξης (`data-invite-action`), η απάντησή του δεν έχει φτάσει. Χωρίς αυτό, τα σκέλη που δεν περιμένουν
 * τελειώνουν πριν τα αυτόματα κλικ και ο React διαμαρτύρεται (`act`).
 */
async function renderSettled(): Promise<ReturnType<typeof render>> {
  const view = render(<HandoverInviteHarness />);
  await waitFor(() => {
    for (const scenario of ANSWER_SCENARIOS) expect(panel(scenario.id).querySelector('[data-invite-action]')).toBeNull();
  }, { timeout: SETTLE_TIMEOUT_MS });
  return view;
}

describe('Α — κάθε μέλος κάθε κλειστού συνόλου έχει πάνελ', () => {
  it('🔴 Α1 — κάθε κοινή άρνηση (διακομιστής) ΚΑΙ κάθε άρνηση της πόρτας (μετά το κλικ) έχει το ΔΙΚΟ της πάνελ', () => {
    for (const reason of CORE_INVITATION_REFUSALS) expect(ids(SERVER_SCENARIOS)).toContain(`server-${reason}`);
    for (const reason of PROPERTY_HANDOVER_INVITATION_REFUSALS) expect(ids(ANSWER_SCENARIOS)).toContain(`answer-${reason}`);
  });

  it('🔴 Α2 — κάθε θεατής × κάθε αφορμή · κάθε αφορμή αποδοχής · κάθε κατάσταση κύκλου ζωής (με και χωρίς εκδότη)', () => {
    for (const occasion of PROPERTY_HANDOVER_INVITATION_OCCASIONS) {
      for (const viewer of ['sign-in', 'other-account', 'ready']) expect(ids(SERVER_SCENARIOS)).toContain(`view-${viewer}-${occasion}`);
      expect(ids(ANSWER_SCENARIOS)).toContain(`answer-accepted-${occasion}`);
    }
    expect(ORIGIN_SCENARIOS).toHaveLength(PROPERTY_HANDOVER_LIFECYCLES.length * 2 + PROTOCOL_PANEL_COUNT);
  });

  it('🔑 Α3 — καμία ταυτότητα δύο φορές (ο μεταφορέας δρομολογεί σε αυτήν)', () => {
    const all = [...ids(SERVER_SCENARIOS), ...ids(ANSWER_SCENARIOS), ...ids(ORIGIN_SCENARIOS)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Β — κάθε πάνελ δείχνει ΤΟ ΔΙΚΟ ΤΟΥ κείμενο, αφού πατηθεί όπως από άνθρωπο', () => {
  it('🔴 Β1 — κάθε άρνηση της πόρτας περνά από τον ΠΡΑΓΜΑΤΙΚΟ αποκωδικοποιητή και βγάζει το δικό της κλειδί', async () => {
    await renderSettled();
    for (const reason of PROPERTY_HANDOVER_INVITATION_REFUSALS) {
      await waitFor(() => expect(panel(`answer-${reason}`)).toHaveTextContent(HANDOVER_INVITE_REFUSAL_KEY[reason]), { timeout: SETTLE_TIMEOUT_MS });
    }
  });

  it('🔴 Β2 — αποδοχή ⇒ ένα κλικ στον φάκελο (ανά αφορμή) · άρνηση ⇒ «απορρίφθηκε» · παροδικό/άγνωστο ⇒ «δοκιμάστε ξανά»', async () => {
    await renderSettled();
    for (const occasion of PROPERTY_HANDOVER_INVITATION_OCCASIONS) {
      const accepted = panel(`answer-accepted-${occasion}`);
      await waitFor(() => expect(accepted).toHaveTextContent(HANDOVER_INVITE_ACCEPTED_BODY_KEY[occasion]), { timeout: SETTLE_TIMEOUT_MS });
      expect(within(accepted).getByRole('link', { name: HANDOVER_INVITE_KEYS.openDossier })).toHaveAttribute('href', dossierDetailHref('pdos_harness'));
    }
    await waitFor(() => expect(panel('answer-declined')).toHaveTextContent(HANDOVER_INVITE_KEYS.declinedBody), { timeout: SETTLE_TIMEOUT_MS });
    // Κάθε έκβαση έχει έξοδο — και η άρνηση.
    expect(within(panel('answer-declined')).getByRole('link', { name: HANDOVER_INVITE_KEYS.home })).toHaveAttribute('href', '/');
    for (const id of ['answer-unavailable', 'answer-unknown-code']) {
      await waitFor(() => expect(within(panel(id)).getByRole('button', { name: HANDOVER_INVITE_KEYS.retry })).toBeInTheDocument(), { timeout: SETTLE_TIMEOUT_MS });
      // Η αποτυχία ΜΕΤΑ το κλικ δεν λέει «δεν άνοιξε η πρόσκληση» — λέει ότι η απάντηση δεν καταχωρίστηκε.
      expect(panel(id)).toHaveTextContent(HANDOVER_INVITE_KEYS.answerFailed);
    }
  });

  it('🔴 Β3 — οι αρνήσεις του διακομιστή · «ήδη απαντημένη» δίνει έξοδο στους φακέλους', async () => {
    await renderSettled();
    for (const reason of CORE_INVITATION_REFUSALS) expect(panel(`server-${reason}`)).toHaveTextContent(HANDOVER_INVITE_REFUSAL_KEY[reason]);
    expect(within(panel('server-already-used')).getByRole('link', { name: HANDOVER_INVITE_KEYS.myDossiers })).toHaveAttribute('href', MY_DOSSIERS_ROUTE);
    expect(panel('server-unavailable')).toHaveTextContent(HANDOVER_INVITE_KEYS.unavailable);
  });

  it('🔴 Β4 — η προέλευση λέει την κατάσταση με ΛΕΞΗ σε κάθε πάνελ', async () => {
    await renderSettled();
    for (const scenario of ORIGIN_SCENARIOS) {
      expect(panel(scenario.id)).toHaveTextContent(`property-market:dossier.origin.lifecycle.${scenario.origin.handoverLifecycle}`);
      expect(panel(scenario.id)).toHaveTextContent(`property-market:dossier.origin.explain.${scenario.origin.handoverLifecycle}`);
    }
  });
});

describe('Γ — ο μεταφορέας δεν διαρρέει', () => {
  it('🔴 Γ1 — μετά το unmount τα `apiClient.post` ΚΑΙ `apiClient.get` είναι ΞΑΝΑ τα αληθινά', async () => {
    const original = { post: apiClient.post, get: apiClient.get };
    const { unmount } = await renderSettled();
    expect(apiClient.post).not.toBe(original.post);
    expect(apiClient.get).not.toBe(original.get);
    unmount();
    expect(apiClient.post).toBe(original.post);
    expect(apiClient.get).toBe(original.get);
  });
});

describe('Δ — Σ5: το Πρωτόκολλο στον φάκελο (Γ40)', () => {
  const P = 'property-market:dossier.origin.protocol';
  const withProtocol = ORIGIN_SCENARIOS.filter((scenario) => scenario.origin.protocol !== null);
  const withoutProtocol = ORIGIN_SCENARIOS.filter((scenario) => scenario.origin.protocol === null);

  it('🔴 Δ1 — κάρτα + σήμα ΜΟΝΟ όπου ο γραφέας πρόβαλε Πρωτόκολλο· «αντικαθιστά» μόνο από την αναθ. 2', async () => {
    await renderSettled();
    expect(withProtocol).toHaveLength(PROTOCOL_PANEL_COUNT);
    for (const scenario of withoutProtocol) expect(panel(scenario.id)).not.toHaveTextContent(P);
    for (const scenario of withProtocol) {
      const card = within(panel(scenario.id));
      expect(card.getByRole('heading', { name: `${P}.title` })).toBeInTheDocument();
      expect(card.getByText(`${P}.sealed`)).toBeInTheDocument();
      expect(card.getByText(`${P}.short`)).toBeInTheDocument();
      expect(card.getByText(`${P}.meaning`)).toBeInTheDocument();
      const supersedes = card.queryByText(`${P}.supersedes`);
      if (scenario.origin.protocol?.revision === 1) expect(supersedes).toBeNull();
      else expect(supersedes).toBeInTheDocument();
    }
  });

  it('🔴 Δ2 — ο σύνδεσμος οδηγεί στο κείμενο που ΙΣΧΥΕ την ελληνική μέρα έκδοσης', async () => {
    await renderSettled();
    for (const scenario of withProtocol) {
      expect(within(panel(scenario.id)).getByRole('link', { name: `${P}.legalText` }))
        .toHaveAttribute('href', legalDocumentVersionHref(HANDOVER_PROTOCOL_LEGAL_DOCUMENT, 1));
    }
  });

  /**
   * 🔴 Δ3 — η «Λήψη» ζητά το **δικό της** `fileId` από το **προσωπικό** διαμέρισμα (ο μεταφορέας αρνείται κάθε άλλο, όπως ο
   * διακομιστής) · παραδόθηκε ⇒ PDF στον browser, καμία ειδοποίηση · 404 ⇒ **μία** ειδοποίηση αποτυχίας · και **τίποτα**
   * δεν φτάνει στον αληθινό μεταφορέα.
   */
  it('🔴 Δ3 — «Λήψη» = το ΔΙΚΟ ΤΟΥ αντίτυπο, ΠΡΟΣΩΠΙΚΟ διαμέρισμα· επιτυχία και αποτυχία ορατές, μηδέν κλήσεις στην παραγωγή', async () => {
    const realGet = jest.mocked(apiClient.get);
    realGet.mockClear();
    const createObjectURL = jest.fn((blob: Blob) => `blob:${blob.type}:${blob.size}`);
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    await renderSettled();
    for (const scenario of withProtocol) {
      mockDownloadError.mockClear();
      createObjectURL.mockClear();
      fireEvent.click(within(panel(scenario.id)).getByRole('button', { name: `${P}.download` }));
      if (scenario.id.endsWith('-delivered')) {
        await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
        const blob = createObjectURL.mock.calls[0][0];
        expect(blob.type).toBe('application/pdf');
        expect((await blob.text()).startsWith('%PDF-')).toBe(true);
        expect(mockDownloadError).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(mockDownloadError).toHaveBeenCalledTimes(1));
        expect(createObjectURL).not.toHaveBeenCalled();
      }
    }
    expect(realGet).not.toHaveBeenCalled();
  });

  it('🔒 Δ4 — κανένα στοιχείο επικοινωνίας στην κάρτα (κανένα «@»)', async () => {
    await renderSettled();
    for (const scenario of withProtocol) expect(panel(scenario.id).textContent ?? '').not.toContain('@');
  });
});
