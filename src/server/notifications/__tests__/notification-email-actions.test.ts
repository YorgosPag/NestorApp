/**
 * @jest-environment node
 *
 * ADR-841 §7 Α21.21 Φάση Β — γεγονότα → κουμπιά τη στιγμή της αποστολής, και τα λόγια του email στη γλώσσα του παραλήπτη.
 *
 *   • Κ1 — τρία κουμπιά (Κλειστά · Κανονικό ωράριο · Άλλο ωράριο) που οδηγούν στη ΣΕΛΙΔΑ, ποτέ στην πόρτα απόφασης
 *   • Κ2 — ο σύνδεσμος είναι ΑΝΑ ΠΑΡΑΛΗΠΤΗ και αποκωδικοποιείται στα ίδια γεγονότα
 *   • Κ3 — χωρίς μυστικό · χωρίς παραλήπτη · χωρίς γεγονότα ⇒ ΚΑΝΕΝΑ κουμπί (ποτέ κουμπί προς «άκυρο»)
 *   • Α1 — το μεμονωμένο email δείχνει τα κουμπιά ΑΝΤΙ για το ένα «Άνοιγμα»· χωρίς ενέργειες ⇒ ό,τι πριν
 *   • Λ1 — ημερομηνία και όνομα αργίας στη γλώσσα ΤΟΥ ΠΑΡΑΛΗΠΤΗ, όνομα από το locale της κάρτας
 */

jest.mock('@/lib/http/public-origin', () => ({
  ...jest.requireActual<typeof import('@/lib/http/public-origin')>('@/lib/http/public-origin'),
  publicUrl: (path: string) => `https://nestor.test${path}`,
}));

const TEST_SECRET = '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { liveEmailActions } = require('../notification-email-actions') as typeof import('../notification-email-actions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderSoloHtml, renderSoloText, NO_LINKS } = require('../notification-email-render') as
  typeof import('../notification-email-render');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readHolidayQuestionLink } = require('@/services/mandate/holiday-hours-question-token') as
  typeof import('@/services/mandate/holiday-hours-question-token');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { holidayQuestionBody } = require('@/services/mandate/holiday-question-email-texts') as
  typeof import('@/services/mandate/holiday-question-email-texts');

const MESSAGE = {
  subject: 'ΒΑΦΕΣ: θα είστε ανοιχτά στις επόμενες αργίες;',
  content: 'σώμα',
  recipientId: 'uid_admin',
  notificationId: 'ntf_1',
  eventType: 'properties.holidayHoursQuestion',
  facts: { kind: 'holiday-hours-question' as const, questionId: 'hhq_q1', nonce: 'n0nce' },
};

function tokenOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
}

describe('liveEmailActions', () => {
  beforeEach(() => {
    process.env.HOLIDAY_HOURS_QUESTION_SECRET = TEST_SECRET;
  });

  it('Κ1 🔑 τρία κουμπιά προς τη ΣΕΛΙΔΑ — η απάντηση προεπιλεγμένη, ποτέ η πόρτα απόφασης', () => {
    const buttons = liveEmailActions(MESSAGE, 'el');
    expect(buttons.map(({ label }) => label)).toEqual(['Κλειστά', 'Κανονικό ωράριο', 'Άλλο ωράριο']);
    expect(buttons.map(({ url }) => new URL(url).search)).toEqual(['?answer=closed', '?answer=regular', '']);
    expect(buttons.every(({ url }) => new URL(url).pathname.startsWith('/hours-question/'))).toBe(true);
  });

  it('Κ2 — ο σύνδεσμος κουβαλά (ερώτηση, nonce, ΠΑΡΑΛΗΠΤΗ) και αποδεικνύεται με το ίδιο μυστικό', () => {
    const [first] = liveEmailActions(MESSAGE, 'en');
    expect(readHolidayQuestionLink(TEST_SECRET,tokenOf(first?.url ?? ''))).toEqual({ id: 'hhq_q1', nonce: 'n0nce', recipientUid: 'uid_admin' });
    expect(first?.label).toBe('Closed');
  });

  it('Κ3 🔴 χωρίς μυστικό · χωρίς παραλήπτη · χωρίς γεγονότα ⇒ ΚΑΝΕΝΑ κουμπί', () => {
    expect(liveEmailActions({ ...MESSAGE, recipientId: undefined }, 'el')).toEqual([]);
    expect(liveEmailActions({ ...MESSAGE, facts: undefined }, 'el')).toEqual([]);
    delete process.env.HOLIDAY_HOURS_QUESTION_SECRET;
    expect(liveEmailActions(MESSAGE, 'el')).toEqual([]);
  });
});

describe('renderSolo* με ενέργειες', () => {
  const withActions = { ...NO_LINKS, permalink: () => 'https://nestor.test/n/ntf_1', actions: () => [
    { url: 'https://nestor.test/hours-question/t?answer=closed', label: 'Κλειστά' },
    { url: 'https://nestor.test/hours-question/t', label: 'Άλλο ωράριο' },
  ] };

  it('Α1 🔑 τα κουμπιά ΑΝΤΙ για το «Άνοιγμα» — και στο HTML και στο απλό κείμενο', () => {
    const html = renderSoloHtml(MESSAGE, 'el', MESSAGE.subject, withActions);
    expect(html).toContain('answer=closed');
    expect(html).not.toContain('/n/ntf_1');
    const text = renderSoloText(MESSAGE, 'el', withActions);
    expect(text).toContain('Κλειστά: https://nestor.test/hours-question/t?answer=closed');
    expect(text).not.toContain('/n/ntf_1');
  });

  it('χωρίς ενέργειες ⇒ ό,τι πριν: ένα κουμπί προς τον προορισμό', () => {
    const html = renderSoloHtml(MESSAGE, 'el', MESSAGE.subject, { ...withActions, actions: () => [] });
    expect(html).toContain('/n/ntf_1');
  });
});

describe('holidayQuestionBody — στη γλώσσα του παραλήπτη', () => {
  const items = [
    { locationId: 'sloc_a', date: '2026-12-25', holiday: 'christmas' as const },
    { locationId: 'sloc_b', date: '2026-12-25', holiday: 'christmas' as const },
    { locationId: 'sloc_a', date: '2027-01-06', holiday: 'epiphany' as const },
  ];

  it('Λ1 🔑 μία γραμμή ανά ΗΜΕΡΟΜΗΝΙΑ (δύο καταστήματα, ένα email) · όνομα από το locale της κάρτας', () => {
    const el = holidayQuestionBody('el', 'ΒΑΦΕΣ', items);
    expect(el.split('\n').filter((line) => line.startsWith('  • '))).toHaveLength(2);
    expect(el).toContain('Χριστούγεννα');
    expect(el).toContain('Θεοφάνεια');
    const en = holidayQuestionBody('en', 'VAFES', items);
    expect(en).not.toContain('Χριστούγεννα');
    expect(en).toContain('Dec');
  });

  it('άγνωστη γλώσσα (ψευδο-locale, απούσα) ⇒ η προεπιλογή, ποτέ σφάλμα', () => {
    expect(holidayQuestionBody('pseudo', 'ΒΑΦΕΣ', items)).toContain('Χριστούγεννα');
  });
});
