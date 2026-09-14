/**
 * ADR-841 §7 Α21.16 — ένα τηλέφωνο, μία μορφή: E.164 από κάθε ελληνική γραφή.
 */

import { normalisePhone, revealablePhone } from '../channel-phone';

describe('normalisePhone', () => {
  it.each([
    '2310 123456',
    '+30 2310123456',
    '0030 2310 123456',
    '(2310) 12 34 56',
  ])('%s → ο ΙΔΙΟΣ αριθμός', (raw) => {
    const result = normalisePhone(raw);
    expect(result).toMatchObject({ ok: true, e164: '+302310123456', href: 'tel:+302310123456' });
  });

  it('κινητό', () => {
    expect(normalisePhone('694 123 4567')).toMatchObject({ ok: true, e164: '+306941234567' });
  });

  it('ξένος αριθμός με + δεν ερμηνεύεται ως ελληνικός', () => {
    expect(normalisePhone('+44 20 7946 0958')).toMatchObject({ ok: true, e164: '+442079460958' });
  });

  it('🔴 αριθμός σωστού μήκους που ΔΕΝ μπορεί να καλεστεί → invalid (isValid, όχι isPossible)', () => {
    expect(normalisePhone('1234567890')).toEqual({ ok: false, defect: 'phone-invalid' });
    expect(normalisePhone('abc')).toEqual({ ok: false, defect: 'phone-invalid' });
  });

  it('κενό → ονομασμένο', () => {
    expect(normalisePhone('   ')).toEqual({ ok: false, defect: 'phone-empty' });
  });
});

describe('revealablePhone', () => {
  it('με εσωτερικό — RFC 3966 `;ext=`', () => {
    expect(revealablePhone('+302310123456', '12')).toEqual({
      display: '+30 231 012 3456 (12)',
      href: 'tel:+302310123456;ext=12',
    });
  });

  it('σκουπίδι στον δίσκο → null, ποτέ αριθμός που δεν καλείται', () => {
    expect(revealablePhone('not-a-phone', null)).toBeNull();
  });
});
