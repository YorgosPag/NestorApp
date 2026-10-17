/**
 * @fileoverview ADR-915 §28 — **η σελίδα του συνδέσμου**, όπως τη βλέπει ο ιδιοκτήτης: το διαπιστευτήριο από το fragment
 *   (ποτέ στη διεύθυνση μετά την ανάγνωση) · όψη με `Authorization: Bearer` · **καμία** πράξη χωρίς πάτημα · «Για: <όνομα>» ·
 *   μία απάντηση με `Idempotency-Key` · κάθε άρνηση με όνομα. Ψεύτικο μόνο το δίκτυο.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRequestGate } from '../DocumentRequestGate';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const VIEW = {
  audience: 'owner', recipientName: 'Άλφα Συνθετικός', officeName: 'Γραφείο Άλφα', propertyLabel: 'Διαμέρισμα Α1',
  documentKind: 'energy-certificate',
  professional: { name: 'Επιθεωρητής Συνθετικός', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7' },
  note: null, expiresAt: '2026-10-24T09:00:00.000Z',
};

type Call = { readonly url: string; readonly init: RequestInit };
let calls: Call[];

function respond(status: number, json: unknown): Response {
  return { ok: status < 400, status, json: async () => json } as Response;
}

function mockNetwork(view: Response, answer: Response = respond(200, { success: true, data: { answer: 'approve' } })): void {
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return String(url).endsWith('/answer') ? answer : view;
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/document-request#t=tok.secret-1');
});

describe('ADR-915 §28 — /document-request', () => {
  it('🔴 το διαπιστευτήριο φεύγει από τη διεύθυνση και ταξιδεύει ΜΟΝΟ σε κεφαλίδα — η όψη δεν κάνει πράξη', async () => {
    mockNetwork(respond(200, { success: true, data: VIEW }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:owner.heading')).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/issuance-link');
    expect(calls[0]?.init.method).toBe('GET');
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok.secret-1');
    expect(screen.getByText(`document-request:page.for ${JSON.stringify({ name: 'Άλφα Συνθετικός' })}`)).toBeTruthy();
  });

  it('«Εγκρίνω» ⇒ ΜΙΑ απάντηση, με κλειδί ιδεμποτίας και την απάντηση του ακροατηρίου του συνδέσμου', async () => {
    mockNetwork(respond(200, { success: true, data: VIEW }));
    render(<DocumentRequestGate />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'document-request:owner.approve' }));
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answers = calls.filter((call) => call.url.endsWith('/answer'));
    expect(answers).toHaveLength(1);
    const headers = answers[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok.secret-1');
    expect(headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(JSON.parse(String(answers[0]?.init.body))).toEqual({ answer: 'approve', note: null });
  });

  it('ο επαγγελματίας βλέπει «Αναλαμβάνω / Δεν αναλαμβάνω» — και ΟΧΙ τα κουμπιά του ιδιοκτήτη', async () => {
    mockNetwork(respond(200, { success: true, data: { ...VIEW, audience: 'professional', professional: null } }));
    render(<DocumentRequestGate />);
    expect(await screen.findByRole('button', { name: 'document-request:professional.accept' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'document-request:owner.approve' })).toBeNull();
  });

  it('κάθε άρνηση με όνομα: «αντικαταστάθηκε» ≠ «έληξε» ≠ «απαντήθηκε ήδη»', async () => {
    for (const [code, title] of [
      ['superseded', 'document-request:failure.superseded.title'],
      ['expired', 'document-request:failure.expired.title'],
      ['already-used', 'document-request:failure.used.title'],
      ['lead-changed', 'document-request:failure.leadChanged.title'],
    ] as const) {
      window.sessionStorage.clear();
      window.history.replaceState(null, '', '/document-request#t=tok.secret-1');
      mockNetwork(respond(410, { success: false, error: code }));
      const { unmount } = render(<DocumentRequestGate />);
      expect(await screen.findByText(title)).toBeTruthy();
      unmount();
    }
  });

  it('χωρίς σύνδεσμο ⇒ «λείπει ο σύνδεσμος», ΚΑΝΕΝΑ αίτημα δικτύου', async () => {
    window.history.replaceState(null, '', '/document-request');
    mockNetwork(respond(200, { success: true, data: VIEW }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:failure.missing.title')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
