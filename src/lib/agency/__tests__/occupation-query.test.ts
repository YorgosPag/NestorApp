/**
 * @fileoverview Άγκυρες ADR-896 §8 — γρήγορες ειδικότητες: **ΕΝΑ** φίλτρο, οικογένειες ESCO, πλήθη.
 * @related config/occupation-families.ts · lib/agency/occupation-query.ts · lib/agency/occupation-family-tallies.ts
 */

import { OCCUPATION_FAMILIES } from '@/config/occupation-families';
import { escoDocIdOf, escoOccupationUri } from '@/lib/esco/esco-uri';
import { NO_FOOTPRINTS } from '@/types/geo/admin-footprint';
import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';

import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import type { CoverageResolvers } from '../coverage-match';
import { occupationFamilyTallies } from '../occupation-family-tallies';
import { familyToken, readOccupationQuery } from '../occupation-query';
import {
  applyShowcaseFilters,
  parseShowcaseFilters,
  serializeShowcaseFilters,
  type ShowcaseFilters,
} from '../showcase-filter';

const PLUMBER = escoOccupationUri('ed3cf43d-c2c1-4c46-82fc-1375e27e0290');
const GAS_TECH = escoOccupationUri('97b3cab1-f4f0-41ed-8c80-e65e6c067e95');
const BUILDING_ELECTRICIAN = escoOccupationUri('33960bab-4423-4808-af6c-ec2b485dba41');
const ELECTRICAL_ENGINEER = escoOccupationUri('86ca306c-ab99-420a-9e2a-aa73c5c4de22');
const LAWYER = escoOccupationUri('00000000-0000-0000-0000-00000000aaaa');

function credential(escoUri: string, iscoCode: string): ShowcaseCredential {
  return {
    standing: 'self-declared',
    occupation: { escoUri, label: { el: escoUri, en: escoUri }, iscoCode },
    attestation: { state: 'unknown' },
  };
}

const THESSALONIKI = { lat: 40.6403, lng: 22.9439 };
const ATHENS = { lat: 37.9838, lng: 23.7275 };

function showcase(
  companyId: string,
  credentials: readonly ShowcaseCredential[],
  position: PublicShowcase['position'] = THESSALONIKI,
): PublicShowcase {
  return showcaseFixture({ companyId, alias: companyId, credentials, position });
}

const NO_GEO: CoverageResolvers = { lineageOf: () => [], footprintOf: NO_FOOTPRINTS };

const ORDERED: readonly PublicShowcase[] = [
  showcase('c1', [credential(PLUMBER, '7126')]),
  // ⚠️ ΔΥΟ πιστοποιήσεις της ΙΔΙΑΣ οικογένειας ⇒ μετρά ΜΙΑ φορά (γραφεία, όχι πιστοποιήσεις).
  showcase('c2', [credential(GAS_TECH, '7126'), credential(PLUMBER, '7126')]),
  showcase('c3', [credential(PLUMBER, '7126')], ATHENS),
  showcase('c4', [credential(BUILDING_ELECTRICIAN, '7411')]),
  showcase('c5', [credential(LAWYER, '2611')]),
];

const NEAR_THESSALONIKI: ShowcaseFilters['where'] = {
  circle: { center: THESSALONIKI, radiusKm: 10 },
};

describe('ADR-896 §8 — το μητρώο οικογενειών', () => {
  it('Μ1: κάθε URI ανήκει σε ΜΙΑ οικογένεια το πολύ', () => {
    const all = OCCUPATION_FAMILIES.flatMap((family) => [...family.escoUris]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('Μ2: κάθε URI είναι πραγματικό ESCO occupation URI (κανένας επινοημένος κωδικός)', () => {
    for (const family of OCCUPATION_FAMILIES) {
      expect(family.escoUris.length).toBeGreaterThan(0);
      for (const uri of family.escoUris) {
        expect(uri.startsWith('http://data.europa.eu/esco/occupation/')).toBe(true);
        expect(escoDocIdOf(uri)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    }
  });

  it('Μ3: η σειρά του Giorgio — 6 μηχανικοί πρώτα, μετά 11 συνεργεία, μοναδικά ids', () => {
    const groups = OCCUPATION_FAMILIES.map((family) => family.group);
    expect(groups).toEqual([...Array(6).fill('engineering'), ...Array(11).fill('trades')]);
    const ids = OCCUPATION_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 3)).toEqual(['surveyor', 'architect', 'interiorDesigner']);
  });
});

describe('ADR-896 §8 — η τιμή `?occupation=`', () => {
  it('Τ1: URI ESCO = ακριβής ειδικότητα· `family:<id>` = οικογένεια· άγνωστη οικογένεια = τίποτα', () => {
    expect(readOccupationQuery(PLUMBER)).toEqual({ kind: 'esco', uri: PLUMBER });
    expect(readOccupationQuery(familyToken('plumber'))).toMatchObject({
      kind: 'family',
      family: { id: 'plumber' },
    });
    expect(readOccupationQuery('family:astronaut')).toBeNull();
    expect(readOccupationQuery('  ')).toBeNull();
  });

  it('Τ2: το URL κάνει πλήρη κύκλο για οικογένεια, και μια αποσυρμένη ΔΕΝ φιλτράρει', () => {
    const filters: ShowcaseFilters = { occupation: familyToken('electrician'), where: null };
    expect(parseShowcaseFilters(serializeShowcaseFilters(filters))).toEqual(filters);
    expect(parseShowcaseFilters(new URLSearchParams('occupation=family:astronaut')).occupation).toBeNull();
  });

  it('Τ3: η οικογένεια πιάνει τους ΣΤΕΝΟΥΣ τίτλους — και ΜΟΝΟ τους δικούς της', () => {
    const plumbers = applyShowcaseFilters(
      ORDERED,
      { occupation: familyToken('plumber'), where: null },
      NO_GEO,
    );
    expect(plumbers.map((s) => s.companyId)).toEqual(['c1', 'c2', 'c3']);

    // «Ηλεκτρολόγος» ≠ «Ηλεκτρολόγος Μηχανικός»: δύο οικογένειες, κανένα κοινό URI.
    const electricians = applyShowcaseFilters(
      ORDERED,
      { occupation: familyToken('electricalEngineer'), where: null },
      NO_GEO,
    );
    expect(electricians).toEqual([]);
    expect(
      OCCUPATION_FAMILIES.find((f) => f.id === 'electricalEngineer')?.escoUris,
    ).toContain(ELECTRICAL_ENGINEER);
  });

  it('Τ4: η ακριβής ειδικότητα (dropdown) μένει ακριβής', () => {
    const exact = applyShowcaseFilters(ORDERED, { occupation: GAS_TECH, where: null }, NO_GEO);
    expect(exact.map((s) => s.companyId)).toEqual(['c2']);
  });
});

describe('ADR-896 §8 — τα πλήθη των τσιπ', () => {
  it('Π1: μετρά ΓΡΑΦΕΙΑ — δύο πιστοποιήσεις της ίδιας οικογένειας μετρούν μία φορά', () => {
    const tallies = occupationFamilyTallies(ORDERED, { occupation: null, where: null }, NO_GEO);
    expect(tallies.get('plumber')).toBe(3);
    expect(tallies.get('electrician')).toBe(1);
    expect(tallies.get('roofer')).toBe(0);
    expect(tallies.size).toBe(OCCUPATION_FAMILIES.length);
  });

  it('Π2: σέβεται την περιοχή, αγνοεί τον δικό του άξονα', () => {
    const tallies = occupationFamilyTallies(
      ORDERED,
      // ήδη επιλεγμένη ΑΛΛΗ ειδικότητα — δεν πρέπει να μηδενίσει τα άλλα τσιπ
      { occupation: familyToken('electrician'), where: NEAR_THESSALONIKI },
      NO_GEO,
    );
    expect(tallies.get('plumber')).toBe(2); // c3 είναι στην Αθήνα
    expect(tallies.get('electrician')).toBe(1);
  });

  it('Π3: το «3» του τσιπ οδηγεί σε 3 κάρτες — ίδιος κριτής με το φίλτρο', () => {
    const filters: ShowcaseFilters = { occupation: null, where: NEAR_THESSALONIKI };
    const tallies = occupationFamilyTallies(ORDERED, filters, NO_GEO);
    for (const family of OCCUPATION_FAMILIES) {
      const shown = applyShowcaseFilters(
        ORDERED,
        { ...filters, occupation: familyToken(family.id) },
        NO_GEO,
      );
      expect(shown.length).toBe(tallies.get(family.id));
    }
  });
});
