/**
 * @fileoverview Άγκυρα του ταιριαστή περιοχών (ADR-883) — πάνω στο **πραγματικό** ευρετήριο,
 * με ό,τι γράφει πραγματικά ο κόσμος: παλιά ονόματα, κλίση, greeklish, δηλωμένη βαθμίδα.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '../admin-area-index-file';
import { adminAreaLineage, buildAdminAreaIndex, searchAdminAreas } from '../admin-area-search';

const index = buildAdminAreaIndex(
  readAdminAreaIndex(JSON.parse(readFileSync(join(process.cwd(), 'public', ADMIN_AREA_INDEX_FILE), 'utf8'))),
);

const KORDELIO_EVOSMOS = 'municipality:0708';

function topIds(query: string, limit = 3): string[] {
  return searchAdminAreas(index, query, limit).map((area) => area.id);
}

describe('searchAdminAreas', () => {
  it('🔑 «Δήμος Ελευθερίου Κορδελιού Ευόσμου» — παλιό όνομα — βρίσκει ΠΡΩΤΟ τον σημερινό δήμο', () => {
    expect(topIds('Δήμος Ελευθερίου Κορδελιού Ευόσμου')[0]).toBe(KORDELIO_EVOSMOS);
  });

  it('και προτείνει ΚΑΙ τη δημοτική ενότητα Ελευθερίου-Κορδελιού (η γενεαλογία καλύπτει το «Ευόσμου»)', () => {
    const names = searchAdminAreas(index, 'Δήμος Ελευθερίου Κορδελιού Ευόσμου').map((area) => area.name);
    expect(names).toContain('ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΕΛΕΥΘΕΡΙΟΥ-ΚΟΡΔΕΛΙΟΥ');
  });

  it.each([
    ['χωρίς τόνους, πεζά', 'κορδελιου ευοσμου'],
    ['ονομαστική αντί για γενική (κλίση)', 'Κορδελιό Εύοσμος'],
    ['greeklish', 'kordelio evosmos'],
  ])('%s ⇒ ο δήμος στην κορυφή', (_, query) => {
    expect(topIds(query)).toContain(KORDELIO_EVOSMOS);
  });

  it('η δηλωμένη βαθμίδα μετρά: «Περιφερειακή Ενότητα Θεσσαλονίκης» ⇒ Π.Ε. πρώτη, όχι ο δήμος', () => {
    const first = searchAdminAreas(index, 'Περιφερειακή Ενότητα Θεσσαλονίκης', 1)[0];
    expect(first.level).toBe(4);
  });

  it('χωρίς δηλωμένη βαθμίδα, το «Θεσσαλονίκη» δίνει πρώτα ΔΗΜΟ (πρότυπο: πόλη πρώτα)', () => {
    const first = searchAdminAreas(index, 'Θεσσαλονίκη', 1)[0];
    expect(first.name).toBe('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
  });

  it('greeklish με άλλη γραφή ήχου: «Pireas» βρίσκει τον Πειραιά', () => {
    expect(searchAdminAreas(index, 'Pireas', 3).map((area) => area.name)).toContain('ΔΗΜΟΣ ΠΕΙΡΑΙΩΣ');
  });

  it('σκέτη λέξη βαθμίδας («Δήμος») ⇒ τίποτα — δεν είναι τόπος', () => {
    expect(searchAdminAreas(index, 'Δήμος')).toEqual([]);
  });

  it('άσχετο κείμενο ⇒ τίποτα', () => {
    expect(searchAdminAreas(index, 'ξξξψψψ')).toEqual([]);
  });
});

describe('adminAreaLineage', () => {
  it('δήμος → Π.Ε. → Περιφέρεια, με τη σειρά από τον άμεσο γονέα', () => {
    expect(adminAreaLineage(index, KORDELIO_EVOSMOS).map((area) => area.level)).toEqual([4, 3]);
  });
});
