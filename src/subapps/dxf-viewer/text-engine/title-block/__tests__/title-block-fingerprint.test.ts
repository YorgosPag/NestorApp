/**
 * ADR-651 Φάση Λ — **αποτύπωμα έκδοσης** πινακίδας (§5.11, §8 #8).
 *
 * Τα tests κλειδώνουν τις δύο εγγυήσεις της απόφασης:
 *  1. **Ντετερμινισμός**: ίδια έκδοση ⇒ ίδιο αποτύπωμα (μηδέν τυχαιότητα/timestamp), αλλαγή
 *     οποιουδήποτε fact ⇒ αλλαγή αποτυπώματος.
 *  2. **Δρόμος Γ** (Autodesk ACC): το payload είναι σύνδεσμος έργου **με** το αποτύπωμα στο query.
 */

import {
  buildTitleBlockFingerprint,
  buildTitleBlockQrPayload,
  hasTitleBlockVersionFacts,
  type TitleBlockVersionFacts,
} from '../title-block-fingerprint';

const BASE = 'https://nestor-app.vercel.app';

const FACTS: TitleBlockVersionFacts = {
  projectId: 'proj_ABC123',
  sheetNumber: 'Α-2',
  revisionNumber: 3,
};

describe('ADR-651 Φάση Λ — buildTitleBlockFingerprint (ντετερμινιστικό)', () => {
  it('idempotency: ίδια facts ⇒ ίδιο αποτύπωμα (καμία τυχαιότητα, κανένα Date.now)', () => {
    expect(buildTitleBlockFingerprint(FACTS)).toBe(buildTitleBlockFingerprint(FACTS));
  });

  it('αλλαγή αναθεώρησης ⇒ αλλάζει το αποτύπωμα', () => {
    const next = buildTitleBlockFingerprint({ ...FACTS, revisionNumber: 4 });
    expect(next).not.toBe(buildTitleBlockFingerprint(FACTS));
  });

  it('αλλαγή φύλλου ⇒ αλλάζει το αποτύπωμα (κάθε φύλλο σετ = δικό του QR)', () => {
    const next = buildTitleBlockFingerprint({ ...FACTS, sheetNumber: 'Α-3' });
    expect(next).not.toBe(buildTitleBlockFingerprint(FACTS));
  });

  it('αλλαγή έργου ⇒ αλλάζει το αποτύπωμα', () => {
    const next = buildTitleBlockFingerprint({ ...FACTS, projectId: 'proj_OTHER' });
    expect(next).not.toBe(buildTitleBlockFingerprint(FACTS));
  });

  it('αναγνώσιμο πρόθεμα: φέρει την αναθεώρηση (r3) και το φύλλο (Α2) + hash', () => {
    const fp = buildTitleBlockFingerprint(FACTS);
    expect(fp.startsWith('r3-Α2-')).toBe(true);
  });

  it('κανένα fact ⇒ κενό αποτύπωμα (ο καλών δεν παράγει QR)', () => {
    expect(buildTitleBlockFingerprint({})).toBe('');
    expect(hasTitleBlockVersionFacts({})).toBe(false);
  });

  it('μόνο αναθεώρηση (χωρίς έργο/φύλλο) ⇒ έγκυρο, σταθερό αποτύπωμα', () => {
    const fp = buildTitleBlockFingerprint({ revisionNumber: 1 });
    expect(fp).not.toBe('');
    expect(fp).toBe(buildTitleBlockFingerprint({ revisionNumber: 1 }));
    expect(hasTitleBlockVersionFacts({ revisionNumber: 1 })).toBe(true);
  });
});

describe('ADR-651 Φάση Λ — buildTitleBlockQrPayload (Δρόμος Γ: σύνδεσμος + έκδοση)', () => {
  it('με έργο + αποτύπωμα ⇒ deep-link προς το έργο με το αποτύπωμα στο query', () => {
    const payload = buildTitleBlockQrPayload({
      baseUrl: BASE,
      projectId: 'proj_ABC123',
      fingerprint: 'r3-Α2-7f4c9',
    });
    expect(payload).toBe(`${BASE}/projects/proj_ABC123?v=${encodeURIComponent('r3-Α2-7f4c9')}`);
  });

  it('χωρίς έργο αλλά με αποτύπωμα ⇒ υποβάθμιση σε «μόνο αποτύπωμα» (audit χωρίς σύνδεσμο)', () => {
    const payload = buildTitleBlockQrPayload({ baseUrl: BASE, fingerprint: 'r1-abc' });
    expect(payload).toBe(`${BASE}?v=r1-abc`);
  });

  it('χωρίς τίποτα να κωδικοποιηθεί ⇒ κενό (καθόλου QR)', () => {
    expect(buildTitleBlockQrPayload({ baseUrl: BASE, fingerprint: '' })).toBe('');
  });

  it('end-to-end: ίδια έκδοση ⇒ ίδιο payload (δύο εκτυπώσεις = ίδιο QR)', () => {
    const payloadOf = () =>
      buildTitleBlockQrPayload({
        baseUrl: BASE,
        projectId: FACTS.projectId,
        fingerprint: buildTitleBlockFingerprint(FACTS),
      });
    expect(payloadOf()).toBe(payloadOf());
  });
});
