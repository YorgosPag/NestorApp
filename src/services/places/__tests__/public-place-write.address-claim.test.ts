/**
 * @fileoverview Άγκυρα του φρουρού «διεύθυνση πολύ αδρή για τον στόχο» στη μοναδική πόρτα γραφής (ADR-332 D28 Δ).
 * @related services/places/public-place-write.service.ts · lib/places/place-claim.ts (`addressClaimAdmissible`)
 *
 * 🔴 Η οθόνη προσφέρει «Χρησιμοποίησε τη διεύθυνση που βρέθηκε» μόνο όταν η ακρίβεια αρκεί — αλλά ο πελάτης
 * **δεν είναι αρχή**. Εδώ φρουρείται ότι ο διακομιστής ξανακρίνει με τον **ίδιο** κριτή, με την ακρίβεια που
 * βρήκε **ο ίδιος**, και ότι η άρνηση **δεν γράφει τίποτα**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { ResolvedPlaceFacts } from '@/lib/places/place-facts';
import { FakeFirestore } from './fake-firestore';

jest.mock('../place-source-verification', () => ({
  verifyPlaceClaim: jest.fn(),
}));

import { verifyPlaceClaim } from '../place-source-verification';
import { resolvePlace } from '../public-place-write.service';

const mockedVerify = verifyPlaceClaim as jest.MockedFunction<typeof verifyPlaceClaim>;

const AT = '2026-09-15T10:00:00.000Z';
const ADDRESS = { gesture: 'typed-address', query: 'Σαμοθράκης 16, 56334, Θεσσαλονίκη' } as const;
const PIN = { gesture: 'dropped-pin', point: { lat: 40.6643, lng: 22.8976 } } as const;

function geocoded(accuracy: GeocodingAccuracy | null): ResolvedPlaceFacts {
  return {
    provenance: accuracy === null ? 'manual' : 'geocoded',
    point: { lat: 40.6643092, lng: 22.8976016 },
    outline: null,
    osmRef: null,
    accuracy,
    displayAddress: 'Σαμοθράκης, 56334',
    floorsAboveGround: null,
    constructionYear: null,
  };
}

let db: FakeFirestore;
const asAdmin = (): AdminFirestore => db as unknown as AdminFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  mockedVerify.mockReset();
});

describe('resolvePlace — το σκαλοπάτι 1 γίνεται τόπος ΜΟΝΟ με αρκετή ακρίβεια', () => {
  it('Δ1 — γη + οδός (`interpolated`): ο τόπος γεννιέται, χωρίς κτίριο', async () => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded('interpolated') });

    const result = await resolvePlace(asAdmin(), { claim: ADDRESS, target: 'land' }, AT);

    expect(result.kind).toBe('resolved');
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(1);
    expect(db.all(COLLECTIONS.PUBLIC_BUILDINGS)).toHaveLength(0);
  });

  it('🔴 Δ2 — κτίριο + οδός: ΑΡΝΗΣΗ και καμία εγγραφή — αλλιώς ένα «κτίριο» ανά ιδιοκτήτη του ίδιου δρόμου', async () => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded('interpolated') });

    const result = await resolvePlace(asAdmin(), { claim: ADDRESS, target: 'building' }, AT);

    expect(result).toEqual({ kind: 'rejected', reason: 'address-too-coarse' });
    expect(db.all(COLLECTIONS.PUBLIC_LANDS)).toHaveLength(0);
  });

  it('Δ3 — κτίριο + ακριβής διεύθυνση: γη και κτίριο', async () => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded('exact') });

    const result = await resolvePlace(asAdmin(), { claim: ADDRESS, target: 'building' }, AT);

    expect(result.kind).toBe('resolved');
    expect(db.all(COLLECTIONS.PUBLIC_BUILDINGS)).toHaveLength(1);
  });

  it.each(['approximate', 'center'] as const)('Δ4 — γη + `%s`: άρνηση, όχι τόπος στο κέντρο περιοχής', async (accuracy) => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded(accuracy) });

    const result = await resolvePlace(asAdmin(), { claim: ADDRESS, target: 'land' }, AT);

    expect(result).toEqual({ kind: 'rejected', reason: 'address-too-coarse' });
  });

  it('Δ5 — διεύθυνση χωρίς ακρίβεια: άρνηση — η απουσία δεν διαβάζεται ως «αρκεί»', async () => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded(null) });

    const result = await resolvePlace(asAdmin(), { claim: ADDRESS, target: 'land' }, AT);

    expect(result).toEqual({ kind: 'rejected', reason: 'address-too-coarse' });
  });

  it('Δ6 — παρονομαστής: πινέζα ανθρώπου χωρίς ακρίβεια ΔΕΝ αγγίζεται από τον φρουρό', async () => {
    mockedVerify.mockResolvedValue({ kind: 'verified', facts: geocoded(null) });

    const result = await resolvePlace(asAdmin(), { claim: PIN, target: 'building' }, AT);

    expect(result.kind).toBe('resolved');
  });
});
