/**
 * ADR-877 §6 — η ώρα που γράφει ο διακομιστής σε άνθρωπο είναι ΠΑΝΤΑ ώρα του φορέα.
 *
 * 🔴 Ο διακομιστής τρέχει σε **UTC** (Docker)· ο υπολογιστής ανάπτυξης σε **Αθήνα**. Ένας μορφοποιητής
 * χωρίς `timeZone` είναι **σωστός στο γραφείο και λάθος στην παραγωγή** — άρα μια άγκυρα που απλώς
 * συγκρίνει κείμενο είναι **τυφλή** εδώ. ⚠️ ΜΕΤΡΗΜΕΝΟ: η αλλαγή `process.env.TZ` μέσα σε jest **δεν
 * φτάνει** στο ICU (το `process.env` του sandbox είναι αντίγραφο) — δοκιμάστηκε και απορρίφθηκε. Γι' αυτό η
 * Α0 ελέγχει την **αιτία** (κάθε `Intl.DateTimeFormat` με `timeZone: Europe/Athens`) και η Α7 ότι κανείς
 * δεν την παρακάμπτει.
 *
 * Α0 η ζώνη ζητείται ρητά · Α1 στιγμή → ώρα Αθήνας · Α2 «σήμερα» μετά τις 21:00 UTC · Α3 ημερολογιακή
 * μέρα σε κάθε ζώνη · Α4 μέρα εβδομάδας · Α5 αδιάβαστη τιμή · Α6 οι καταναλωτές (πρόσκληση προμηθευτή:
 * HTML = κείμενο, `lang`, υποσέλιδο ανά γλώσσα · Telegram · βασικό πρότυπο) · Α7 ο παρονομαστής: κανένας
 * κώδικας μηνυμάτων του διακομιστή δεν μορφοποιεί ώρα μόνος του.
 */

jest.mock('server-only', () => ({}));

const mockSendThroughChain = jest.fn();
jest.mock('@/server/comms/email-provider-chain', () => ({
  ...jest.requireActual('@/server/comms/email-provider-chain'),
  sendThroughChain: (...args: unknown[]) => mockSendThroughChain(...args),
}));

import fs from 'fs';
import path from 'path';

import { formatOperatorDate, formatOperatorDateTime, formatOperatorWeekdayDate } from '../operator-time-format';

const EXPIRES = '2026-10-01T11:17:41.389Z'; // 14:17 ώρα Αθήνας (θερινή, UTC+3)

describe('Α0 — ΚΑΘΕ μορφοποίηση του SSoT ζητά ρητά τη ζώνη του φορέα', () => {
  it.each([
    ['formatOperatorDate', () => formatOperatorDate(EXPIRES)],
    ['formatOperatorDateTime', () => formatOperatorDateTime(EXPIRES, 'en')],
    ['formatOperatorWeekdayDate', () => formatOperatorWeekdayDate('2026-10-01')],
  ])('%s ⇒ `timeZone: Europe/Athens`', (_name, run) => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat');
    try {
      run();
      expect(spy).toHaveBeenCalled();
      for (const [, options] of spy.mock.calls) expect(options).toMatchObject({ timeZone: 'Europe/Athens' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Α1-Α4 — η γραφή', () => {
  it('Α1 — στιγμή ⇒ ώρα Αθήνας, 24ωρο, ίδια γραφή σε el και en (en-GB: μέρα/μήνας)', () => {
    expect(formatOperatorDateTime(EXPIRES, 'el')).toBe('01/10/2026, 14:17');
    expect(formatOperatorDateTime(EXPIRES, 'en')).toBe('01/10/2026, 14:17');
  });

  it('Α2 — 22:30 UTC είναι ήδη ΑΥΡΙΟ στην Αθήνα', () => {
    expect(formatOperatorDate(new Date('2026-09-24T22:30:00Z'))).toBe('25/09/2026');
  });

  it('Α3 — ημερολογιακή μέρα `YYYY-MM-DD` μένει η ίδια μέρα', () => {
    expect(formatOperatorDate('2026-02-09', 'el')).toBe('09/02/2026');
    expect(formatOperatorDate('2026-12-31', 'en')).toBe('31/12/2026');
  });

  it('Α4 — μέρα εβδομάδας (Telegram) στο ημερολόγιο της Αθήνας', () => {
    expect(formatOperatorWeekdayDate('2026-10-01')).toBe('Πέμπτη 1/10');
    expect(formatOperatorWeekdayDate(new Date('2026-09-30T22:30:00Z'))).toBe('Πέμπτη 1/10');
  });
});

it('Α5 — αδιάβαστη τιμή επιστρέφεται ως έχει, ποτέ RangeError μέσα σε πρότυπο', () => {
  expect(formatOperatorDate('όχι-ημερομηνία')).toBe('όχι-ημερομηνία');
});

describe('Α6 — οι καταναλωτές ρωτούν το SSoT', () => {
  beforeEach(() => {
    mockSendThroughChain.mockReset();
    mockSendThroughChain.mockResolvedValue({ kind: 'delivered', messageId: 'm1' });
  });

  /* eslint-disable @typescript-eslint/no-require-imports */
  const channel = () => require('@/subapps/procurement/services/channels/email-channel') as typeof import('@/subapps/procurement/services/channels/email-channel');
  /* eslint-enable @typescript-eslint/no-require-imports */

  const invite = (locale: 'el' | 'en') => ({
    inviteId: 'vi_1', vendorName: 'Προμηθευτής Α', recipient: 'vendor@golden.local', rfqTitle: 'Σκυρόδεμα',
    projectName: null, portalUrl: 'https://nestor.example/vendor/quote#t=x', expiresAt: EXPIRES, locale, declineUrl: null,
  });

  it.each([
    ['el', 'Με την επιφύλαξη παντός δικαιώματος.'],
    ['en', 'All rights reserved.'],
  ] as const)('πρόσκληση προμηθευτή (%s): ώρα Αθήνας σε HTML ΚΑΙ κείμενο · `lang` · υποσέλιδο', async (locale, rights) => {
    await channel().emailVendorInviteChannel.send(invite(locale));
    const { html, text } = mockSendThroughChain.mock.calls[0][1] as { html: string; text: string };
    expect(html).toContain('01/10/2026, 14:17');
    expect(text).toContain('01/10/2026, 14:17');
    expect(text).not.toContain(EXPIRES);
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(rights);
  });

  it('Telegram κράτηση · βασικό πρότυπο email', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { formatTelegramBookingDate } = require('@/app/api/communications/webhooks/telegram/booking/booking-codec');
    const { formatEmailDateGreek } = require('@/services/email-templates/base-email-template');
    /* eslint-enable @typescript-eslint/no-require-imports */
    expect(formatTelegramBookingDate('2026-10-01')).toBe('Πέμπτη 1/10');
    expect(formatEmailDateGreek(new Date('2026-09-24T22:30:00Z'))).toBe('25/09/2026');
  });
});

describe('Α7 — ο παρονομαστής: ο κώδικας μηνυμάτων του διακομιστή ΔΕΝ μορφοποιεί ώρα μόνος του', () => {
  const SRC = path.join(__dirname, '..', '..');
  /** Ό,τι συνθέτει κείμενο για άνθρωπο ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ (email · PDF · Telegram · prompt AI). */
  const MESSAGE_ROOTS = [
    'services/email-templates', 'subapps/procurement/services/channels', 'subapps/accounting/services/email',
    'services/procurement', 'services/sales-accounting', 'app/api/communications/webhooks/telegram/booking',
    'services/ai-pipeline/agentic-system-prompt.ts',
  ];
  const RAW_TIME = /toLocale(?:Date|Time)?String\(|new Intl\.DateTimeFormat\(|\.get(?:Day|Date|Hours)\(\)/;

  const filesUnder = (rel: string): string[] => {
    const abs = path.join(SRC, rel);
    if (fs.statSync(abs).isFile()) return [abs];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === '__tests__') return [];
      const child = path.join(rel, entry.name);
      return entry.isDirectory() ? filesUnder(child) : /\.tsx?$/.test(entry.name) ? [path.join(SRC, child)] : [];
    });
  };
  const offenders = (files: readonly string[]): string[] =>
    files.filter((file) => RAW_TIME.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

  it('θετικός έλεγχος: ο σαρωτής ΒΛΕΠΕΙ — βρίσκει το ίδιο το SSoT και σαρώνει πραγματικά αρχεία', () => {
    expect(offenders([path.join(SRC, 'lib/operator-time-format.ts')])).toEqual(['lib/operator-time-format.ts']);
    expect(MESSAGE_ROOTS.flatMap(filesUnder).length).toBeGreaterThan(30);
  });

  it('κανένας παραβάτης — νέα ώρα σε μήνυμα ⇒ `@/lib/operator-time-format`', () => {
    expect(offenders(MESSAGE_ROOTS.flatMap(filesUnder))).toEqual([]);
  });
});
