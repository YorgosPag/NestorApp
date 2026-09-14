/**
 * @fileoverview Άγκυρες της **νομικής ταυτότητας στο σύνορο ανάγνωσης** — ADR-841 §7 Α23 (Δ8).
 * @related lib/agency/showcase-read-legal-identity.ts · lib/agency/showcase-read.ts
 *
 * 🔴 Το έγγραφο το διαβάζει **ανώνυμος**. Φυλάγονται: η παλιά βιτρίνα **δεν σβήνει**, το σκουπίδι
 * **δεν μαντεύεται**, και η δημοσιευμένη έδρα **δεν είναι ποτέ μεγαλύτερη** από την επιλογή.
 */

import { readShowcase } from '../showcase-read';
import { readLegalIdentity } from '../showcase-read-legal-identity';

const IDENTITY = {
  publicName: 'legal-name',
  legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  legalForm: 'ae',
  gemiNumber: '123456789000',
  seat: { disclosure: 'full', streetLine: 'Σαμοθράκης 16', postalCode: '54248', locality: 'Θεσσαλονίκη' },
  attestation: { state: 'verified', issuer: 'gemi', checkedAt: '2026-09-14T09:00:00.000Z' },
};

const SHOWCASE = {
  alias: 'pagonis',
  displayName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  publishedAt: '2026-09-14T10:00:00.000Z',
  credentials: [
    {
      occupation: {
        escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
        label: { el: 'ελαιοχρωματιστής', en: 'painter' },
        iscoCode: '7131',
      },
      attestation: { state: 'unknown' },
    },
  ],
};

describe('Ν — η νομική ταυτότητα διαβάζεται αυστηρά', () => {
  it('🔑 Ν0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ό,τι γράφει ο γραφέας διαβάζεται αυτούσιο', () => {
    expect(readLegalIdentity(IDENTITY)).toEqual(IDENTITY);
  });

  it('🔴 Ν1 — ΠΑΛΙΑ βιτρίνα χωρίς `legalIdentity` ⇒ `null`, και η βιτρίνα ΜΕΝΕΙ αναγνώσιμη (καμία μετανάστευση)', () => {
    const read = readShowcase(SHOWCASE, 'comp_1');

    expect(read.outcome).toBe('showcase');
    if (read.outcome === 'showcase') expect(read.showcase.legalIdentity).toBeNull();
  });

  it('🔴 Ν2 — `municipality` με οδό στον δίσκο ⇒ διαβάζεται ΧΩΡΙΣ οδό (η κατοικία δεν κρέμεται από καθαρό δίσκο)', () => {
    const raw = { ...IDENTITY, seat: { ...IDENTITY.seat, disclosure: 'municipality' } };

    expect(readLegalIdentity(raw)?.seat).toEqual({
      disclosure: 'municipality',
      streetLine: null,
      postalCode: null,
      locality: 'Θεσσαλονίκη',
    });
  });

  it.each([
    ['«επαληθευμένη» χωρίς ημερομηνία ελέγχου', { ...IDENTITY, attestation: { state: 'verified', issuer: 'gemi' } }],
    ['«επαληθευμένη» από άγνωστο εκδότη', { ...IDENTITY, attestation: { ...IDENTITY.attestation, issuer: 'admin' } }],
    ['άγνωστη επιλογή ονόματος', { ...IDENTITY, publicName: 'nickname' }],
    ['άγνωστη επιλογή έδρας', { ...IDENTITY, seat: { ...IDENTITY.seat, disclosure: 'everything' } }],
    ['διεύθυνση επιλεγμένη αλλά κενή', { ...IDENTITY, seat: { ...IDENTITY.seat, streetLine: '  ' } }],
    ['χωρίς επωνυμία', { ...IDENTITY, legalName: '' }],
  ])('🔴 Ν3 — %s ⇒ `null`: δεν δείχνεται τίποτα νομικό, ποτέ μισή ταυτότητα', (_label, raw) => {
    expect(readLegalIdentity(raw)).toBeNull();
  });

  it('🔑 Ν4 — άγνωστη νομική μορφή ⇒ `legalForm: null`, η υπόλοιπη ταυτότητα μένει', () => {
    expect(readLegalIdentity({ ...IDENTITY, legalForm: 'ike' })).toEqual({ ...IDENTITY, legalForm: null });
  });
});
