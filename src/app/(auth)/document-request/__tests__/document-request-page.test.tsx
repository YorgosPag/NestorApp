/**
 * @fileoverview ADR-915 §28 — **η σελίδα του συνδέσμου**, όπως τη βλέπει ο ιδιοκτήτης: το διαπιστευτήριο από το fragment
 *   (ποτέ στη διεύθυνση μετά την ανάγνωση) · όψη με `Authorization: Bearer` · **καμία** πράξη χωρίς πάτημα · «Για: <όνομα>» ·
 *   μία απάντηση με `Idempotency-Key` · κάθε άρνηση με όνομα. Ψεύτικο μόνο το δίκτυο.
 */

import { render, screen, within } from '@testing-library/react';
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
  // §42 — ο υπεύθυνος κρίνει την ΠΡΟΣΦΟΡΑ (πρόσωπο και τιμή μαζί) και στέλνει την αναθεώρηση που είδε.
  step: 'approve-quote', brief: null, owners: null,
  quote: {
    basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31',
    scope: ['issuance'], note: null, deliveryBusinessDays: 5, revision: 1, previousTotalMinor: null, signingDay: null,
  },
};
/** Ο φάκελος προσφοράς του επαγγελματία — κλειστή λίστα, ποτέ ιδιοκτήτης ή ακριβής διεύθυνση. */
const BRIEF = { grossAreaSqm: 82, floor: 2, constructionYear: null, energyClass: 'B', energyValidUntil: '2026-11-01' };
const PROFESSIONAL_VIEW = { ...VIEW, audience: 'professional', professional: null, step: 'give-quote', brief: BRIEF, quote: null };

type Call = { readonly url: string; readonly init: RequestInit };
let calls: Call[];

function respond(status: number, json: unknown): Response {
  return { ok: status < 400, status, json: async () => json } as Response;
}

/** Η όψη χωρίς κωδικό (§28) — η απάντηση του GET είναι «landing» (§29). */
const OPEN = { access: 'open', view: VIEW };

function mockNetwork(
  view: Response,
  // Ο server επιστρέφει ΠΑΝΤΑ `space` (§39) — το fixture χωρίς αυτό έριχνε τη σελίδα «done».
  answer: Response = respond(200, { success: true, data: { answer: 'approve', space: { kind: 'none' } } }),
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
    await userEvent.setup().click(await screen.findByRole('button', { name: 'document-request:owner.approveQuote' }));
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answers = calls.filter((call) => call.url.endsWith('/answer'));
    expect(answers).toHaveLength(1);
    const headers = answers[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok.secret-1');
    expect(headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(JSON.parse(String(answers[0]?.init.body))).toEqual({ answer: 'approve', note: null, accessCode: null, quoteRevision: 1, ownerAttestation: null });
  });

  it('ο υπεύθυνος βλέπει την ΠΡΟΣΦΟΡΑ (σύνολο, ισχύ, τι περιλαμβάνει) πριν από το κουμπί — και «Δεν εγκρίνω» στέλνει την ίδια αναθεώρηση', async () => {
    mockNetwork(respond(200, { success: true, data: OPEN }), respond(200, { success: true, data: { answer: 'reject', space: { kind: 'none' } } }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:facts.quoteScope')).toBeTruthy();
    expect(screen.getByText('document-request:facts.quoteValid')).toBeTruthy();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'document-request:owner.rejectQuote' }));
    expect(await screen.findByText('document-request:done.rejected')).toBeTruthy();
    const answer = calls.find((call) => call.url.endsWith('/answer'));
    expect(JSON.parse(String(answer?.init.body))).toEqual({ answer: 'reject', note: null, accessCode: null, quoteRevision: 1 });
  });

  it('§45 Φ3 — η παράδοση πέφτει ΜΕΤΑ την ημέρα υπογραφής ⇒ ο υπεύθυνος το βλέπει ΠΡΙΝ εγκρίνει· χωρίς ημέρα υπογραφής ⇒ τίποτα', async () => {
    const signing = { ...OPEN, view: { ...VIEW, quote: { ...VIEW.quote, signingDay: '2000-01-03' } } };
    mockNetwork(respond(200, { success: true, data: signing }));
    const { unmount } = render(<DocumentRequestGate />);
    expect(await screen.findByText(/^document-registry:issuance\.delivery\.missesSigning/)).toBeTruthy();
    unmount();
    mockNetwork(respond(200, { success: true, data: OPEN }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:facts.quoteDelivery')).toBeTruthy();
    expect(screen.queryByText(/^document-registry:issuance\.delivery\.missesSigning/)).toBeNull();
  });

  it('ο επαγγελματίας βλέπει τον φάκελο προσφοράς και «Στείλτε προσφορά» — και ΟΧΙ τα κουμπιά του ιδιοκτήτη', async () => {
    mockNetwork(respond(200, { success: true, data: { access: 'open', view: PROFESSIONAL_VIEW } }));
    render(<DocumentRequestGate />);
    expect(await screen.findByRole('button', { name: 'document-request:professional.submitQuote' })).toBeTruthy();
    expect(screen.getByText('document-request:brief.heading')).toBeTruthy();
    expect(screen.getByText('document-request:brief.privacy')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'document-request:owner.approveQuote' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'document-request:professional.accept' })).toBeNull();
  });

  it('🔴 η προσφορά ανοίγει ΜΟΝΟ όταν είναι πλήρης (ποσό + είδος τιμής + χρόνος παράδοσης §45)· στέλνει όρους σε λεπτά — μία απάντηση, `quote`', async () => {
    mockNetwork(respond(200, { success: true, data: { access: 'open', view: PROFESSIONAL_VIEW } }), respond(200, { success: true, data: { answer: 'quote', space: { kind: 'none' } } }));
    const user = userEvent.setup();
    render(<DocumentRequestGate />);
    const submit = await screen.findByRole('button', { name: 'document-request:professional.submitQuote' });
    expect(submit.hasAttribute('disabled')).toBe(true);
    await user.type(screen.getByLabelText('document-registry:issuance.quoteForm.amountLabel'), '100,50');
    await user.click(screen.getByRole('radio', { name: 'document-registry:issuance.quoteForm.basis.firm' }));
    // §45 Φ2 — χωρίς χρόνο παράδοσης η προσφορά ΔΕΝ φεύγει: πρόσωπο + τιμή + χρόνος εγκρίνονται μαζί.
    expect(submit.hasAttribute('disabled')).toBe(true);
    await user.type(screen.getByLabelText('document-registry:issuance.quoteForm.deliveryDaysLabel'), '7');
    expect(submit.hasAttribute('disabled')).toBe(false);
    await user.click(submit);
    expect(await screen.findByText('document-request:done.quoted')).toBeTruthy();
    const answers = calls.filter((call) => call.url.endsWith('/answer'));
    expect(answers).toHaveLength(1);
    expect(JSON.parse(String(answers[0]?.init.body))).toEqual({
      answer: 'quote', note: null, accessCode: null,
      terms: { basis: 'firm', amountMinor: 10_050, vatRatePercent: 24, vatIncluded: false, validUntil: expect.any(String), scope: ['site-visit', 'issuance', 'registration'], deliveryBusinessDays: 7 },
    });
  });

  it('παλιά ανάθεση (§27) ⇒ «Αναλαμβάνω / Δεν αναλαμβάνω», χωρίς πεδία τιμής', async () => {
    mockNetwork(respond(200, { success: true, data: { access: 'open', view: { ...PROFESSIONAL_VIEW, step: 'legacy-accept', brief: null } } }));
    render(<DocumentRequestGate />);
    expect(await screen.findByRole('button', { name: 'document-request:professional.accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'document-request:professional.decline' })).toBeTruthy();
    expect(screen.queryByLabelText('document-registry:issuance.quoteForm.amountLabel')).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'document-request:owner.approveQuote' })).toBeNull();
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
    await user.click(await screen.findByRole('button', { name: 'document-request:owner.approveQuote' }));
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answer = calls.find((call) => call.url.endsWith('/answer'));
    expect(JSON.parse(String(answer?.init.body))).toEqual({ answer: 'approve', note: null, accessCode: '042917', quoteRevision: 1, ownerAttestation: null });
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

describe('ADR-915 §45.15 — οι ιδιοκτήτες στη σελίδα έγκρισης', () => {
  /** Ο ίδιος (ολόκληρο ΑΦΜ) · συνιδιοκτήτης με μάσκα · συνιδιοκτήτης χωρίς ΑΦΜ. */
  const OWNERS = [
    { contactId: 'cont_self', name: 'Άλφα Συνθετικός', self: true, vat: { kind: 'full', value: '090000045' } },
    { contactId: 'cont_co', name: 'Βήτα Συνθετική', self: false, vat: { kind: 'masked', tail: '666' } },
    { contactId: 'cont_none', name: 'Γάμμα Συνθετικός', self: false, vat: { kind: 'none' } },
  ];
  const WITH_OWNERS = { access: 'open', view: { ...VIEW, owners: OWNERS } };
  const approveButton = () => screen.getByRole('button', { name: 'document-request:owner.approveQuote' });

  it('🔴 ΑΦΜ τρίτου ΜΟΝΟ με μάσκα· «Εγκρίνω» ανενεργό μέχρι να κριθεί ΚΑΘΕ πρόσωπο· λάθος ψηφίο ⇒ ειδοποίηση, όχι αποστολή', async () => {
    mockNetwork(respond(200, { success: true, data: WITH_OWNERS }));
    render(<DocumentRequestGate />);
    expect(await screen.findByText('document-request:owners.heading')).toBeTruthy();
    expect(screen.getByText(`document-request:owners.vatFull ${JSON.stringify({ vat: '090000045' })}`)).toBeTruthy();
    expect(screen.getByText(`document-request:owners.vatMasked ${JSON.stringify({ tail: '666' })}`)).toBeTruthy();
    expect(approveButton()).toHaveProperty('disabled', true);
    const user = userEvent.setup();
    const groups = screen.getAllByRole('radiogroup');
    await user.click(within(groups[0]).getByRole('radio', { name: 'document-request:owners.confirm' }));
    await user.click(within(groups[1]).getByRole('radio', { name: 'document-request:owners.correct' }));
    await user.click(within(groups[2]).getByRole('radio', { name: 'document-request:owners.confirmNoVat' }));
    await user.type(screen.getByLabelText('document-request:owners.newVatLabel'), '123456789');
    expect(screen.getByRole('alert').textContent).toBe('document-request:owners.vatInvalid');
    expect(approveButton()).toHaveProperty('disabled', true);
    expect(calls.filter((call) => call.url.endsWith('/answer'))).toHaveLength(0);
  });

  it('έγκυρες κρίσεις ⇒ ΕΝΑ «Εγκρίνω» με την κρίση ανά πρόσωπο (ποτέ το ΑΦΜ που μόνο επιβεβαιώθηκε) + «λείπει κάποιος»', async () => {
    mockNetwork(respond(200, { success: true, data: WITH_OWNERS }));
    render(<DocumentRequestGate />);
    await screen.findByText('document-request:owners.heading');
    const user = userEvent.setup();
    const groups = screen.getAllByRole('radiogroup');
    await user.click(within(groups[0]).getByRole('radio', { name: 'document-request:owners.confirm' }));
    await user.click(within(groups[1]).getByRole('radio', { name: 'document-request:owners.correct' }));
    await user.click(within(groups[2]).getByRole('radio', { name: 'document-request:owners.supply' }));
    const vatFields = screen.getAllByLabelText('document-request:owners.newVatLabel');
    await user.type(vatFields[0], '998877666');
    await user.type(vatFields[1], '123456783');
    await user.type(screen.getByLabelText('document-request:owners.missingLabel'), 'Δέλτα Συνθετικός');
    await user.click(approveButton());
    expect(await screen.findByText('document-request:done.approved')).toBeTruthy();
    const answer = calls.find((call) => call.url.endsWith('/answer'));
    expect(JSON.parse(String(answer?.init.body))).toEqual({
      answer: 'approve', note: null, accessCode: null, quoteRevision: 1,
      ownerAttestation: {
        owners: [
          { contactId: 'cont_self', verdict: 'confirmed', vatNumber: null },
          { contactId: 'cont_co', verdict: 'corrected', vatNumber: '998877666' },
          { contactId: 'cont_none', verdict: 'corrected', vatNumber: '123456783' },
        ],
        missingNote: 'Δέλτα Συνθετικός',
      },
    });
  });

  it('η σελίδα δεν διάβασε ιδιοκτήτες (`owners: null`) ⇒ καμία ενότητα, «Εγκρίνω» όπως πριν', async () => {
    mockNetwork(respond(200, { success: true, data: OPEN }));
    render(<DocumentRequestGate />);
    await screen.findByRole('button', { name: 'document-request:owner.approveQuote' });
    expect(screen.queryByText('document-request:owners.heading')).toBeNull();
    expect(approveButton()).toHaveProperty('disabled', false);
  });

  it('οι ιδιοκτήτες άλλαξαν στο μεταξύ ⇒ ονομασμένη άρνηση `owners-changed`', async () => {
    mockNetwork(respond(200, { success: true, data: OPEN }), respond(409, { success: false, error: 'owners-changed' }));
    render(<DocumentRequestGate />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'document-request:owner.approveQuote' }));
    expect(await screen.findByText('document-request:failure.ownersChanged.title')).toBeTruthy();
  });
});
