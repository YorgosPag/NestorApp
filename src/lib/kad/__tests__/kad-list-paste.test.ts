/**
 * «Επικόλληση λίστας ΓΕΜΗ» (`src/lib/kad/kad-list-paste.ts`) — ADR-372 §8.5 a4 · ADR-ACC-013.
 */

import { extractKadTokens, planKadListPaste } from '../kad-list-paste';
import { FIXTURE_CATALOG } from './kad-fixture';

const NO_EXISTING = { primaryCode: '', secondaryCodes: [] } as const;

describe('extractKadTokens', () => {
  it('βρίσκει κωδικούς με κάθε διαχωριστή, ανάμεσα σε περιγραφές', () => {
    const text = '41001100 Κατασκευή κτιρίων\n43.22.10, 41.00 | 99000000';
    expect(extractKadTokens(text)).toEqual(['41001100', '43.22.10', '41.00', '99000000']);
  });

  it('αγνοεί θόρυβο με λιγότερα από 4 ψηφία (αρίθμηση γραμμών, έτη μισά)', () => {
    expect(extractKadTokens('1. 41.00\n2. 12 3')).toEqual(['41.00']);
  });

  it('κενό κείμενο ⇒ κανένας υποψήφιος', () => {
    expect(extractKadTokens('')).toEqual([]);
  });
});

describe('planKadListPaste', () => {
  it('επιλύσιμος και επιλέξιμος ⇒ add', () => {
    const plan = planKadListPaste(FIXTURE_CATALOG, '41001100', NO_EXISTING);
    expect(plan).toEqual([{ raw: '41001100', status: 'add', entry: FIXTURE_CATALOG.byCode.get('41.00.11') }]);
  });

  it('άγνωστος κωδικός ⇒ unresolved, χωρίς entry (φαίνεται ως ✗, δεν χάνεται)', () => {
    expect(planKadListPaste(FIXTURE_CATALOG, '12345678', NO_EXISTING)).toEqual([
      { raw: '12345678', status: 'unresolved' },
    ]);
  });

  it('επικεφαλίδα (ομάδα 99.0) ⇒ unresolved, γιατί δεν είναι δηλώσιμη δραστηριότητα', () => {
    expect(planKadListPaste(FIXTURE_CATALOG, '99000000', NO_EXISTING)[0]?.status).toBe('unresolved');
  });

  it('ο κύριος ΚΑΔ ⇒ primary', () => {
    const plan = planKadListPaste(FIXTURE_CATALOG, '41000000', { primaryCode: '41.00', secondaryCodes: [] });
    expect(plan[0]?.status).toBe('primary');
  });

  it('ήδη δευτερεύων ⇒ duplicate · επανάληψη στην ίδια επικόλληση ⇒ duplicate', () => {
    const existing = { primaryCode: '', secondaryCodes: ['43.22.1'] };
    const plan = planKadListPaste(FIXTURE_CATALOG, '43221000\n41.00.11\n41001100', existing);
    expect(plan.map((item) => item.status)).toEqual(['duplicate', 'add', 'duplicate']);
  });
});
