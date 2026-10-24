/**
 * ΑΓΚΥΡΕΣ — η πόρτα εγγραφής της δήλωσης (ADR-919 §11 · ADR-842 Α7).
 *
 * 🔴 Οι δύο γραφείς έχουν σχήμα `.passthrough()`. Αυτές οι άγκυρες ρωτούν: μπορεί ο πελάτης να γράψει **γεγονός**
 * (πλαστό `confirmedAt`, δικό του `at`) αντί για **πρόθεση**;
 */

import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { readAvailabilityDeclaration } from '@/lib/listings/listing-availability';

import {
  availabilityDeclarationFromIntent,
  availabilityDeclarationPatch,
  SCHEDULE_PROPOSAL_CONFIDENCE,
} from '../availability-declaration-write';

const NOW = '2026-10-23T09:00:00.000Z';

describe('Π — πρόθεση → γεγονός, με την ώρα του ΔΙΑΚΟΜΙΣΤΗ', () => {
  it('Π1 — «δηλώνω» ⇒ `declared` με `at` = τώρα, δημοσιεύσιμο', () => {
    const fact = availabilityDeclarationFromIntent({ precision: 'quarter', anchor: '2027-07-01', origin: 'declared' }, NOW);
    expect(fact).toEqual({ provenance: 'declared', value: { precision: 'quarter', anchor: '2027-07-01' }, at: NOW });
    expect(fact !== null && isPubliclyPresentable(fact)).toBe(true);
  });

  it('Π2 — «αποδέχομαι την πρόταση» ⇒ `inferred` + `confirmedAt` = τώρα (Α7), και ο επιλυτής το διαβάζει', () => {
    const fact = availabilityDeclarationFromIntent(
      { precision: 'quarter', anchor: '2027-01-01', origin: 'schedule-proposal', isLowerBound: true }, NOW,
    );
    expect(fact).toMatchObject({ provenance: 'inferred', confirmedAt: NOW, confidence: SCHEDULE_PROPOSAL_CONFIDENCE.lowerBound });
    expect(readAvailabilityDeclaration(fact)).toEqual(fact);
    expect(fact !== null && isPubliclyPresentable(fact)).toBe(true);
  });

  it('Π3 — `null` πάνω σε υπάρχουσα υπόσχεση = ανάκληση', () => {
    expect(availabilityDeclarationPatch({ completionDeclaration: null }, 'completionDeclaration', NOW, STORED))
      .toEqual({ kind: 'ok', patch: { completionDeclaration: null } });
  });
});

const STORED = { provenance: 'declared', value: { precision: 'quarter', anchor: '2027-07-01' }, at: '2026-10-01T00:00:00.000Z' };

describe('Ι — idempotent απέναντι στην αμετάβλητη επαναποστολή', () => {
  it('Ι1 — η αυτόματη αποθήκευση ξαναστέλνει το ΑΠΟΘΗΚΕΥΜΕΝΟ γεγονός ⇒ τίποτα (ούτε 400, ούτε νέα ώρα)', () => {
    const resent = { at: STORED.at, value: { anchor: '2027-07-01', precision: 'quarter' }, provenance: 'declared' };
    expect(availabilityDeclarationPatch({ completionDeclaration: resent }, 'completionDeclaration', NOW, STORED))
      .toEqual({ kind: 'ok', patch: {} });
  });

  it('Ι2 — «γεγονός» που ΔΙΑΦΕΡΕΙ από το αποθηκευμένο ⇒ πλαστογραφία, άκυρο', () => {
    const tampered = { ...STORED, value: { precision: 'quarter', anchor: '2027-10-01' } };
    expect(availabilityDeclarationPatch({ completionDeclaration: tampered }, 'completionDeclaration', NOW, STORED))
      .toEqual({ kind: 'invalid' });
  });
});

describe('Α — άρνηση ό,τι δεν είναι πρόθεση', () => {
  it('Α1 — πλαστό γεγονός (`provenance` + `confirmedAt`) ⇒ άκυρο, ποτέ αυτούσιο', () => {
    const forged = { provenance: 'inferred', value: { precision: 'quarter', anchor: '2027-07-01' }, at: NOW, confidence: 1, confirmedAt: NOW };
    expect(availabilityDeclarationPatch({ completionDeclaration: forged }, 'completionDeclaration', NOW, null)).toEqual({ kind: 'invalid' });
  });

  it('Α2 — ξένο κλειδί μέσα στην πρόθεση ⇒ άκυρο (`strict`)', () => {
    const smuggled = { precision: 'day', anchor: '2027-07-01', origin: 'declared', confirmedAt: NOW };
    expect(availabilityDeclarationPatch({ availabilityDeclaration: smuggled }, 'availabilityDeclaration', NOW, null)).toEqual({ kind: 'invalid' });
  });

  it('Α3 — ανύπαρκτη ημέρα (30 Φεβρουαρίου) ⇒ άκυρο, όχι «2 Μαρτίου»', () => {
    const intent = { precision: 'day', anchor: '2027-02-30', origin: 'declared' };
    expect(availabilityDeclarationPatch({ availabilityDeclaration: intent }, 'availabilityDeclaration', NOW, null)).toEqual({ kind: 'invalid' });
  });

  it('Α4 — απόν πεδίο ⇒ κανένα άγγιγμα του εγγράφου', () => {
    expect(availabilityDeclarationPatch({}, 'completionDeclaration', NOW, null)).toEqual({ kind: 'ok', patch: {} });
  });
});
