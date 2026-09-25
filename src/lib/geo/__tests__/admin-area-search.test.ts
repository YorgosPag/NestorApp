/**
 * @fileoverview Άγκυρα του ταιριαστή περιοχών (ADR-883) — πάνω στο **πραγματικό** ευρετήριο,
 * με ό,τι γράφει πραγματικά ο κόσμος: παλιά ονόματα, κλίση, greeklish, δηλωμένη βαθμίδα.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '../admin-area-index-file';
import { adminAreaLineage, buildAdminAreaIndex, resolveTypedAdminArea, searchAdminAreas } from '../admin-area-search';

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

describe('resolveTypedAdminArea — «Θεσσαλονίκη» + Enter (ADR-883 §5.8)', () => {
  const resolve = (query: string) => resolveTypedAdminArea(index, query);
  const areaId = (query: string) => {
    const outcome = resolve(query);
    return outcome.kind === 'area' ? outcome.area.id : outcome.kind;
  };

  it.each([
    ['Θεσσαλονίκη', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'],
    ['θεσσαλονικη', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'],
    ['thessaloniki', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'],
    ['Δήμος Θεσσαλονίκης', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'],
  ])('«%s» ⇒ %s (ίδιος τόπος σε πολλές βαθμίδες ⇒ ο δήμος)', (query, name) => {
    const outcome = resolve(query);
    expect(outcome.kind === 'area' && outcome.area.name).toBe(name);
  });

  it('η δηλωμένη βαθμίδα φιλτράρει: «Περιφερειακή Ενότητα Θεσσαλονίκης» ⇒ η Π.Ε.', () => {
    const outcome = resolve('Περιφερειακή Ενότητα Θεσσαλονίκης');
    expect(outcome.kind === 'area' && outcome.area.level).toBe(4);
  });

  it('κλίση και παύλα: «Κορδελιό Εύοσμος» ⇒ ο δήμος Κορδελιού-Ευόσμου', () => {
    expect(areaId('Κορδελιό Εύοσμος')).toBe(KORDELIO_EVOSMOS);
  });

  it.each([
    ['οδός με αριθμό', 'Τσιμισκή 45'],
    ['ταχυδρομικός κώδικας', '54621'],
    ['πρόθεμα, όχι λέξη', 'Θεσ'],
    ['μέρος ονόματος', 'Κορδελιού'],
    ['άγνωστη λέξη δίπλα στο όνομα', 'Θεσσαλονίκη λιμάνι'],
    ['σκέτη βαθμίδα', 'Δήμος'],
  ])('%s («%s») ⇒ geocoder', (_, query) => {
    expect(resolve(query).kind).toBe('none');
  });

  it('🔑 ομώνυμα ίδιας βαθμίδας ⇒ ΡΩΤΑΜΕ, δεν μαντεύουμε', () => {
    const outcome = resolve('Καλλιθέα');
    // Δήμος Καλλιθέας (Αττική) — ο μόνος δήμος ⇒ περιοχή· οι ομώνυμες κοινότητες είναι χαμηλότερη βαθμίδα.
    expect(outcome.kind === 'area' && outcome.area.level).toBe(5);
    const communities = resolve('Κοινότητα Καλλιθέας');
    expect(communities.kind).toBe('ambiguous');
    expect(communities.kind === 'ambiguous' && communities.areas.length).toBeGreaterThan(1);
  });

  it('ο γονέας ξεχωρίζει ομώνυμα: «Κοινότητα Καλλιθέας Χαλκιδικής» ⇒ λιγότερες ή μία', () => {
    const all = resolve('Κοινότητα Καλλιθέας');
    const narrowed = resolve('Κοινότητα Καλλιθέας Χαλκιδικής');
    const count = (o: ReturnType<typeof resolve>) => (o.kind === 'area' ? 1 : o.kind === 'ambiguous' ? o.areas.length : 0);
    expect(count(narrowed)).toBeGreaterThan(0);
    expect(count(narrowed)).toBeLessThan(count(all));
  });
});

describe('οικισμοί (ADR-883 §5.10) — πάνω στο πραγματικό ευρετήριο', () => {
  const DORKADA = 'settlement:0709060202';
  const resolve = (query: string) => resolveTypedAdminArea(index, query);

  it.each([
    ['όνομα ιεραρχίας', 'Δορκάδα'],
    ['γραφή ΕΛΣΤΑΤ (άλλη κατάληξη)', 'Δορκάς'],
    ['χωρίς τόνους', 'δορκαδα'],
    ['greeklish', 'dorkada'],
  ])('🔑 σύμπτωμα Giorgio — %s ⇒ η Δορκάδα πρώτη πρόταση', (_, query) => {
    expect(topIds(query, 1)).toEqual([DORKADA]);
  });

  it.each(['Δορκάδα', 'Δορκάς', 'οικισμός Δορκάδα'])('Enter «%s» ⇒ ο οικισμός', (query) => {
    expect(resolve(query)).toEqual({ kind: 'area', area: expect.objectContaining({ id: DORKADA }) });
  });

  it('«Λαγκαδάς» + Enter ⇒ ο ΔΗΜΟΣ, όχι ο ομώνυμος οικισμός (ο οικισμός τελευταίος)', () => {
    const outcome = resolve('Λαγκαδάς');
    expect(outcome.kind === 'area' && outcome.area.id).toBe('municipality:0709');
  });

  it('«οικισμός Λαγκάδα» ⇒ η δηλωμένη βαθμίδα φιλτράρει: ΜΟΝΟ οικισμοί, και ρωτάμε ανάμεσά τους', () => {
    const outcome = resolve('οικισμός Λαγκάδα');
    expect(outcome.kind).toBe('ambiguous');
    expect(outcome.kind === 'ambiguous' && outcome.areas.every((area) => area.level === 8)).toBe(true);
  });

  it('η γενεαλογία του οικισμού ανεβαίνει από την κοινότητα ως την Περιφέρεια', () => {
    expect(adminAreaLineage(index, DORKADA).map((area) => area.level)).toEqual([7, 6, 5, 4, 3]);
  });
});
