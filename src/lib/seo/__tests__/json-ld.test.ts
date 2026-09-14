/**
 * ADR-841 §7 Α21.17 — το JSON-LD γράφεται μέσα σε `<script>`: καμία τιμή δεν επιτρέπεται να το κλείσει.
 */

import { serializeJsonLd } from '../json-ld';

/** Χτισμένοι από κωδικό σημείο — αόρατοι στην πηγή, δες την κεφαλίδα του `json-ld.ts`. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe('serializeJsonLd', () => {
  it('🔴 επωνυμία με «</script>» ΔΕΝ κλείνει το στοιχείο — και η τιμή μένει ίδια', () => {
    const value = { name: 'ΑΦΟΙ </script><script>alert(1)</script>' };
    const out = serializeJsonLd(value);

    expect(out).not.toContain('<');
    expect(out).not.toMatch(/<\/script/i);
    expect(JSON.parse(out)).toEqual(value);
  });

  it('& > και οι διαχωριστές γραμμής/παραγράφου διαφεύγουν — και το JSON μένει έγκυρο', () => {
    const value = { a: `Α & Β > Γ ${LINE_SEPARATOR} ${PARAGRAPH_SEPARATOR}` };
    const out = serializeJsonLd(value);

    expect(out).not.toContain('&');
    expect(out).not.toContain('>');
    expect(out).not.toContain(LINE_SEPARATOR);
    expect(out).not.toContain(PARAGRAPH_SEPARATOR);
    expect(out).toContain('\\u2028');
    expect(JSON.parse(out)).toEqual(value);
  });

  it('🔑 το απλό κενό ΔΕΝ αγγίζεται (φρουρός κλάσης regex με αόρατους χαρακτήρες)', () => {
    expect(serializeJsonLd({ a: 'α β' })).toBe('{"a":"α β"}');
  });
});
