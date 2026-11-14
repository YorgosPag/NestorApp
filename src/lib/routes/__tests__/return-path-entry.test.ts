/**
 * ADR-915 §39 — **το πλαίσιο της εισόδου**: `mode` μόνο από κλειστό σύνολο, `invitedAs` μόνο καλυμμένο, και χωρίς
 * πλαίσιο το `loginHref` μένει **ακριβώς** όπως ήταν.
 */

import { authEntryModeOf, invitedAsOf, loginHref } from '../return-path';

describe('loginHref με πλαίσιο εισόδου', () => {
  it('χωρίς πλαίσιο ⇒ η παλιά μορφή', () => {
    expect(loginHref('/case-invite/abc')).toBe('/login?next=%2Fcase-invite%2Fabc');
  });

  it('νέος παραλήπτης ⇒ mode=signup + καλυμμένη διεύθυνση', () => {
    const href = new URL(loginHref('/case-invite/abc', { mode: 'signup', invitedAs: 'g***1@gmail.com' }), 'https://x.invalid');
    expect(href.searchParams.get('next')).toBe('/case-invite/abc');
    expect(href.searchParams.get('mode')).toBe('signup');
    expect(href.searchParams.get('invitedAs')).toBe('g***1@gmail.com');
  });

  it('ΠΛΗΡΕΣ email δεν μπαίνει ποτέ στο URL', () => {
    const href = loginHref('/case-invite/abc', { mode: 'signin', invitedAs: 'georgios.pagonis@gmail.com' });
    expect(href).not.toContain('invitedAs');
  });

  it('άκυρη επιστροφή ⇒ σκέτο /login, το πλαίσιο δεν σώζει τίποτα', () => {
    expect(loginHref('https://evil.example', { mode: 'signup' })).toBe('/login');
  });
});

describe('authEntryModeOf / invitedAsOf', () => {
  it.each(['signin', 'signup', 'reset'])('δέχεται %s', (mode) => expect(authEntryModeOf(mode)).toBe(mode));
  it.each([null, '', 'admin', ['signup']])('απορρίπτει %p', (raw) => expect(authEntryModeOf(raw)).toBeNull());

  it.each(['g***1@gmail.com', 'a***@x.gr'])('δέχεται καλυμμένο %s', (raw) => expect(invitedAsOf(raw)).toBe(raw));
  it.each(['georgios@gmail.com', '***@gmail.com', 'g***1', '<script>***@x', null])('απορρίπτει %p', (raw) =>
    expect(invitedAsOf(raw)).toBeNull(),
  );
});
