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

/** Η όψη χωρίς κωδικό (§28) — η απάντηση του GET είναι «landing» (§29). */
const OPEN = { access: 'open', view: VIEW };

function mockNetwork(
  view: Response,
  answer: Response = respond(200, { success: true, data: { answer: 'approve' } }),
  unlock: (body: { accessCode: string }) => Response = () => respond(500, { success: false, error: 'server-error' }),
): void {
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith('/unlock')) return unlock(JSON.parse(String(init?.body)) as { accessCode: string });
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
    mockNetwork(respond(200, { success: true, data: OPEN }));
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
    mockNetwork(respond(200, { success: true, data: OPEN }));
    render(<DocumentRequestGate />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'document-request:owner.approve' }));
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answers = calls.filter((call) => call.url.endsWith('/answer'));
    expect(answers).toHaveLength(1);
    const headers = answers[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok.secret-1');
    expect(headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(JSON.parse(String(answers[0]?.init.body))).toEqual({ answer: 'approve', note: null, accessCode: null });
  });

  it('ο επαγγελματίας βλέπει «Αναλαμβάνω / Δεν αναλαμβάνω» — και ΟΧΙ τα κουμπιά του ιδιοκτήτη', async () => {
    mockNetwork(respond(200, { success: true, data: { access: 'open', view: { ...VIEW, audience: 'professional', professional: null } } }));
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
    mockNetwork(respond(200, { success: true, data: OPEN }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:failure.missing.title')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('ADR-915 §29 — /document-request με κωδικό πρόσβασης', () => {
  const GATE = { access: 'code-required', gate: { audience: 'owner', recipientName: 'Άλφα Συνθετικός', officeName: 'Γραφείο Άλφα', attemptsLeft: 5 } };
  const unlockWith = (code: string) => (body: { accessCode: string }) => (body.accessCode === code
    ? respond(200, { success: true, data: { view: VIEW } })
    : respond(403, { success: false, error: 'code-wrong', remaining: 4 }));

  it('🔴 πριν τον κωδικό: μόνο «Για» και γραφείο — ΚΑΝΕΝΑ στοιχείο ακινήτου ή επαγγελματία, κανένα κουμπί απάντησης', async () => {
    mockNetwork(respond(200, { success: true, data: GATE }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:code.heading')).toBeTruthy();
    expect(screen.getByText(`document-request:code.intro ${JSON.stringify({ office: 'Γραφείο Άλφα' })}`)).toBeTruthy();
    expect(screen.queryByText('Διαμέρισμα Α1')).toBeNull();
    expect(screen.queryByText('Επιθεωρητής Συνθετικός')).toBeNull();
    expect(screen.queryByRole('button', { name: 'document-request:owner.approve' })).toBeNull();
    const input = screen.getByLabelText('document-request:code.label');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('λάθος ⇒ «απομένουν Ν» ανακοινώνεται· σωστός ⇒ η κάρτα, και η απάντηση φέρει τον κωδικό — ΠΟΤΕ σε URL ή storage', async () => {
    mockNetwork(respond(200, { success: true, data: GATE }), undefined, unlockWith('042917'));
    const user = userEvent.setup();
    render(<DocumentRequestGate />);
    const input = await screen.findByLabelText('document-request:code.label');
    await user.type(input, '111111');
    await user.click(screen.getByRole('button', { name: 'document-request:code.submit' }));
    expect((await screen.findByRole('alert')).textContent).toBe(`document-request:code.wrong ${JSON.stringify({ remaining: 4 })}`);
    await user.type(screen.getByLabelText('document-request:code.label'), '042 917');
    await user.click(screen.getByRole('button', { name: 'document-request:code.submit' }));
    await user.click(await screen.findByRole('button', { name: 'document-request:owner.approve' }));
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answer = calls.find((call) => call.url.endsWith('/answer'));
    expect(JSON.parse(String(answer?.init.body))).toEqual({ answer: 'approve', note: null, accessCode: '042917' });
    expect(window.location.href).not.toContain('042917');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('042917');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('042917');
  });

  it('κλειδωμένος σύνδεσμος ⇒ «κλειδώθηκε», κανένα πεδίο κωδικού', async () => {
    mockNetwork(respond(423, { success: false, error: 'code-locked', remaining: 0 }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:failure.locked.title')).toBeTruthy();
    expect(screen.queryByLabelText('document-request:code.label')).toBeNull();
  });
});
