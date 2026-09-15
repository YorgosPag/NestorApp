/**
 * 🔴 **Η ΟΘΟΝΗ ΤΗΣ ΕΡΩΤΗΣΗΣ ΑΡΓΙΩΝ** (ADR-841 §7 Α21.21 Φάση Β).
 * @related components/mandate/HolidayQuestionContent.tsx · hooks/mandate/useHolidayQuestionDecision.ts
 *
 * Φυλάει: κάθε λόγος άρνησης έχει λέξη · η προεπιλογή του email είναι ΜΟΝΟ προσυμπλήρωση · «Ίδιο για όλες» · μερική
 * απάντηση που κρατά τις υπόλοιπες · η φόρμα κερδίζει **ορατά** · άγνωστος κωδικός ⇒ `unavailable`, ποτέ ωμό κλειδί ·
 * καμία «Άλλο ωράριο» προς 404.
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Στείλε όλες τις γραμμές αντί για τις επιλεγμένες → **Υ1**.
 * 2. Σβήσε το `formWon` → **Υ2**.
 * 3. Γύρνα το `refusalOf(...) ?? 'unavailable'` σε `String(body.reason)` → **Υ3**.
 * 4. Δείξε το «Άλλο ωράριο» με `cardFormPath === null` → **Φ3**.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}|${Object.values(options).join('|')}` : key,
  }),
}));
jest.mock('@/i18n/route-slice', () => ({ registerRouteSlice: jest.fn() }));
jest.mock('@/lib/intl-formatting', () => ({ formatCalendarDay: (dateKey: string) => `day(${dateKey})` }));

import { HolidayQuestionContent } from '../HolidayQuestionContent';
import { HOLIDAY_QUESTION_KEYS, HOLIDAY_QUESTION_REASON_KEYS } from '../holiday-question-labels';
import { SHOWCASE_SPECIAL_KIND_KEYS } from '../agency-showcase-special-hours-labels';
import type { HolidayQuestionRow, HolidayQuestionView } from '@/services/mandate/holiday-hours-question-decision';

const TOKEN = 'tok.en';
const CLOSED = SHOWCASE_SPECIAL_KIND_KEYS.closed;
const REGULAR = SHOWCASE_SPECIAL_KIND_KEYS.regular;

function row(date: string, overrides: Partial<HolidayQuestionRow> = {}): HolidayQuestionRow {
  return { locationId: 'loc_hq', date, holiday: 'christmas', locationLabel: null, locationRole: 'headquarters', lastYear: null, ...overrides };
}

function view(overrides: Partial<HolidayQuestionView> = {}): HolidayQuestionView {
  return {
    agencyName: 'ΒΑΦΕΣ ΠΑΓΩΝΗ',
    lastDate: '2027-01-06',
    rows: [row('2026-12-25'), row('2026-12-26', { holiday: 'boxing-day' })],
    cardFormPath: '/login?next=%2Fo%2Fpagonis%2Fsettings%2Fagency-profile%2Fcard',
    ...overrides,
  };
}

const fetchMock = jest.fn();

function respond(status: number, body: unknown): void {
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, json: async () => body });
}

function posted(): unknown {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { body: string }];
  return JSON.parse(init.body);
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('Α — άρνηση πριν από κάθε ερώτηση', () => {
  it.each(Object.keys(HOLIDAY_QUESTION_REASON_KEYS) as (keyof typeof HOLIDAY_QUESTION_REASON_KEYS)[])(
    'Α1 — «%s» έχει λέξη, και καμία φόρμα',
    (reason) => {
      render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: false, reason }} preset={null} />);
      expect(screen.getByRole('alert')).toHaveTextContent(HOLIDAY_QUESTION_REASON_KEYS[reason]);
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    },
  );
});

describe('Φ — η φόρμα', () => {
  it('Φ1 🔑 το κουμπί του email ΠΡΟΣΥΜΠΛΗΡΩΝΕΙ — τίποτα δεν στέλνεται με το άνοιγμα', () => {
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset="closed" />);
    const closed = screen.getAllByRole('radio', { name: CLOSED });
    expect(closed.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(closed.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Φ2 — χωρίς προεπιλογή ⇒ η αποθήκευση περιμένει έστω μία επιλογή', () => {
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset={null} />);
    expect(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit })).toBeDisabled();
  });

  it('Φ3 🔴 χώρος χωρίς διεύθυνση ⇒ ΚΑΝΕΝΑ «Άλλο ωράριο» προς 404 · με διεύθυνση ⇒ ο σύνδεσμος', () => {
    const { unmount } = render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view({ cardFormPath: null }) }} preset={null} />);
    expect(screen.queryByRole('link', { name: HOLIDAY_QUESTION_KEYS.otherHours })).not.toBeInTheDocument();
    unmount();
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset={null} />);
    expect(screen.getByRole('link', { name: HOLIDAY_QUESTION_KEYS.otherHours })).toHaveAttribute('href', view().cardFormPath);
  });

  it('Φ4 — «Ίδιο για όλες» γεμίζει κάθε γραμμή· με ΜΙΑ γραμμή δεν εμφανίζεται καν', async () => {
    const { unmount } = render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset={null} />);
    await userEvent.click(screen.getAllByRole('radio', { name: REGULAR })[0]);
    const regular = screen.getAllByRole('radio', { name: REGULAR });
    expect(regular.every((radio) => radio.getAttribute('aria-checked') === 'true')).toBe(true);
    unmount();
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view({ rows: [row('2026-12-25')] }) }} preset={null} />);
    expect(screen.queryByText(HOLIDAY_QUESTION_KEYS.sameForAll)).not.toBeInTheDocument();
  });

  it('Φ5 — «Πέρσι: …» με τη ΛΕΞΗ της φόρμας', () => {
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view({ rows: [row('2026-12-25', { lastYear: 'closed' })] }) }} preset={null} />);
    expect(screen.getByText(`${HOLIDAY_QUESTION_KEYS.lastYear}|${CLOSED}`)).toBeInTheDocument();
  });

  it('Φ6 — πολλά καταστήματα ⇒ επικεφαλίδα ανά κατάστημα', () => {
    const rows = [row('2026-12-25'), row('2026-12-25', { locationId: 'loc_b', locationLabel: 'Καλαμαριά', locationRole: 'branch' })];
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view({ rows }) }} preset={null} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Καλαμαριά' })).toBeInTheDocument();
  });
});

describe('Υ — η απάντηση', () => {
  it('Υ1 🔑 μερική απάντηση: στέλνεται ΜΟΝΟ η επιλεγμένη, φεύγει από τη λίστα, οι υπόλοιπες μένουν', async () => {
    respond(200, { ok: true, remaining: 1, outcomes: ['applied'] });
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view({ rows: [row('2026-12-25'), row('2026-12-26', { holiday: 'boxing-day' })] }) }} preset={null} />);
    // [0] = «Ίδιο για όλες», [1] = 25/12
    await userEvent.click(screen.getAllByRole('radio', { name: CLOSED })[1]);
    await userEvent.click(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`${HOLIDAY_QUESTION_KEYS.remaining}|1`));
    expect(posted()).toEqual({ answers: [{ locationId: 'loc_hq', date: '2026-12-25', kind: 'closed' }] });
    expect(screen.queryByText('day(2026-12-25)')).not.toBeInTheDocument();
    expect(screen.getByText('day(2026-12-26)')).toBeInTheDocument();
  });

  it('Υ2 🔴 Η ΦΟΡΜΑ ΚΕΡΔΙΣΕ ΣΤΟ ΜΕΤΑΞΥ — η σελίδα το ΛΕΕΙ· `remaining: 0` ⇒ «ευχαριστούμε»', async () => {
    respond(200, { ok: true, remaining: 0, outcomes: ['already-answered', 'applied'] });
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset="closed" />);
    await userEvent.click(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(HOLIDAY_QUESTION_KEYS.done));
    expect(screen.getByRole('status')).toHaveTextContent(HOLIDAY_QUESTION_KEYS.formWon);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('Υ3 🔴 άγνωστος κωδικός διακομιστή ⇒ `unavailable`, ΠΟΤΕ ωμό κλειδί', async () => {
    respond(418, { ok: false, reason: 'teapot' });
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset="regular" />);
    await userEvent.click(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(HOLIDAY_QUESTION_REASON_KEYS.unavailable));
  });

  it('Υ4 — γνωστή άρνηση (409) ⇒ η λέξη της· οι γραμμές μένουν', async () => {
    respond(409, { ok: false, reason: 'already-answered' });
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset="regular" />);
    await userEvent.click(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(HOLIDAY_QUESTION_REASON_KEYS['already-answered']));
    expect(screen.getByText('day(2026-12-25)')).toBeInTheDocument();
  });

  it('Υ5 — `200` χωρίς αριθμό/πίνακα ΔΕΝ είναι επιτυχία', async () => {
    respond(200, { ok: true });
    render(<HolidayQuestionContent token={TOKEN} lookup={{ ok: true, view: view() }} preset="closed" />);
    await userEvent.click(screen.getByRole('button', { name: HOLIDAY_QUESTION_KEYS.submit }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(HOLIDAY_QUESTION_REASON_KEYS.unavailable));
  });
});
