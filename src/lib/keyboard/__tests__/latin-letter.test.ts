/**
 * ADR-927 §12 — ο ένας κριτής γράμματος συντόμευσης. Οι περιπτώσεις είναι οι μετρημένες της παραγωγής
 * (ελληνική διάταξη, Caps Lock) και του DXF (AZERTY).
 */

import { latinLetterOf } from '../latin-letter';
import { inboxIntentOf } from '@/components/crm/notifications/useInboxKeyboard';

const key = (k: string, code: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  key: k, code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods,
});

describe('latinLetterOf', () => {
  it('λατινικό γράμμα ⇒ το ίδιο, πεζό', () => {
    expect(latinLetterOf(key('j', 'KeyJ'))).toBe('j');
    expect(latinLetterOf(key('I', 'KeyI'))).toBe('i');
  });

  it('ελληνική διάταξη ⇒ η φυσική θέση (ξ στο KeyJ ⇒ j)', () => {
    expect(latinLetterOf(key('ξ', 'KeyJ'))).toBe('j');
    expect(latinLetterOf(key('Ι', 'KeyI'))).toBe('i');
  });

  it('AZERTY: το λατινικό key κερδίζει τη φυσική θέση (φυσικό Q γράφει a ⇒ a, όχι q)', () => {
    expect(latinLetterOf(key('a', 'KeyQ'))).toBe('a');
  });

  it('όχι γράμμα ⇒ null', () => {
    expect(latinLetterOf(key('Enter', 'Enter'))).toBeNull();
    expect(latinLetterOf(key('5', 'Digit5'))).toBeNull();
  });
});

describe('inboxIntentOf', () => {
  it('j/k με ελληνική διάταξη μετακινούν', () => {
    expect(inboxIntentOf(key('ξ', 'KeyJ'))).toBe('next');
    expect(inboxIntentOf(key('κ', 'KeyK'))).toBe('prev');
    expect(inboxIntentOf(key('ε', 'KeyE'))).toBe('dismiss');
  });

  it('Shift+I/U και με ελληνική διάταξη', () => {
    expect(inboxIntentOf(key('Ι', 'KeyI', { shiftKey: true }))).toBe('read');
    expect(inboxIntentOf(key('Θ', 'KeyU', { shiftKey: true }))).toBe('unread');
  });

  it('Caps Lock χωρίς Shift (key «I») ΔΕΝ σημαίνει «αναγνωσμένη»', () => {
    expect(inboxIntentOf(key('I', 'KeyI'))).toBeNull();
  });

  it('Shift+J δεν μετακινεί· Ctrl/Alt/Meta ανήκουν στον browser', () => {
    expect(inboxIntentOf(key('J', 'KeyJ', { shiftKey: true }))).toBeNull();
    expect(inboxIntentOf(key('j', 'KeyJ', { ctrlKey: true }))).toBeNull();
    expect(inboxIntentOf(key('e', 'KeyE', { metaKey: true }))).toBeNull();
  });

  it('ονομασμένα πλήκτρα', () => {
    expect(inboxIntentOf(key('ArrowDown', 'ArrowDown'))).toBe('next');
    expect(inboxIntentOf(key('End', 'End'))).toBe('last');
    expect(inboxIntentOf(key('Enter', 'Enter'))).toBe('open');
  });
});
