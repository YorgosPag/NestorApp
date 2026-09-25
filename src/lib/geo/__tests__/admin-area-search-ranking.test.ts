/**
 * @fileoverview Άγκυρα της ΚΑΤΑΤΑΞΗΣ και της ΑΝΟΧΗΣ ΟΡΘΟΓΡΑΦΙΑΣ (ADR-883 §5.11) — πάνω στο πραγματικό
 * ευρετήριο, με τις ερωτήσεις που μετρήθηκαν λάθος πριν από τη διόρθωση.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '../admin-area-index-file';
import { buildAdminAreaIndex, rankAdminAreas, resolveTypedAdminArea } from '../admin-area-search';
import { greekWords } from '../admin-area-words';

const index = buildAdminAreaIndex(
  readAdminAreaIndex(JSON.parse(readFileSync(join(process.cwd(), 'public', ADMIN_AREA_INDEX_FILE), 'utf8'))),
);

/** Τ.Κ. Ξυλοπόλεως (Δ. Λαγκαδά) — το παράδειγμα του Giorgio. */
const XYLOPOLI = 'community:07090601';

const names = (query: string, limit = 5) => rankAdminAreas(index, query, limit).areas.map((area) => area.name);
const ids = (query: string, limit = 5) => rankAdminAreas(index, query, limit).areas.map((area) => area.id);

describe('πρόθεμα: μισή λέξη ταιριάζει ΜΟΝΟ ως πρόθεμα (Πρόβλημα 1)', () => {
  it('🔑 «Ξυλοπ» ⇒ η Ξυλοπόλεως στη λίστα, το Ξυλόκαστρο ΟΧΙ (ήταν 10η, με το Ξυλόκαστρο 1ο)', () => {
    expect(ids('Ξυλοπ')).toContain(XYLOPOLI);
    expect(names('Ξυλοπ').some((name) => name.includes('ΞΥΛΟΚΑΣΤΡ') || name.includes('Ξυλοκάστρ'))).toBe(false);
  });

  it('«Ξυλοκ» ⇒ ο Δήμος Ξυλοκάστρου πρώτος', () => {
    expect(names('Ξυλοκ')[0]).toBe('ΔΗΜΟΣ ΞΥΛΟΚΑΣΤΡΟΥ - ΕΥΡΩΣΤΙΝΗΣ');
  });

  it.each([
    ['Άργος', 'ΔΗΜΟΣ ΆΡΓΟΥΣ - ΜΥΚΗΝΩΝ', 'ολόκληρη λέξη πάνω από το πρόθεμα «Αργοστόλι»'],
    ['Πάτρα', 'ΔΗΜΟΣ ΠΑΤΡΕΩΝ', 'όχι ο Δήμος Πάτμου'],
    ['Βόλος', 'ΔΗΜΟΣ ΒΟΛΟΥ', 'όχι ο Δήμος Βόλβης'],
    ['Ρόδος', 'ΔΗΜΟΣ ΡΟΔΟΥ', 'θέμα τριών γραμμάτων — γι\x27 αυτό ΟΧΙ «ελάχιστο θέμα 4»'],
    ['Ιωάννινα', 'ΔΗΜΟΣ ΙΩΑΝΝΙΤΩΝ', 'όνομα κατοίκων: Ιωάννινα/Ιωαννιτών'],
    ['Pireas', 'ΔΗΜΟΣ ΠΕΙΡΑΙΩΣ', 'greeklish: Πειραιάς/Πειραιώς'],
  ])('«%s» ⇒ %s (%s)', (query, first) => {
    expect(names(query)[0]).toBe(first);
    expect(rankAdminAreas(index, query).corrected).toBe(false);
  });

  it('«Σάμος» ⇒ ΟΧΙ «Σάμη» (το λατινικό «-οι»→«i» δεν ενώνει γένη)', () => {
    expect(names('Σάμος')).not.toContain('Σάμη');
  });
});

describe('ανοχή ορθογραφίας — ΜΟΝΟ όταν το ακριβές δεν βρήκε τίποτα (Πρόβλημα 2)', () => {
  it.each([['Ξυλούπολη'], ['xiloupoli'], ['Ξυλουπ']])('🔑 «%s» ⇒ Ξυλοπόλεως, ως ΔΙΟΡΘΩΣΗ', (query) => {
    const ranking = rankAdminAreas(index, query);
    expect(ranking.corrected).toBe(true);
    expect(ranking.areas.map((area) => area.id)).toContain(XYLOPOLI);
  });

  it.each([
    ['Ξυλούπολη', 'Τοπική Κοινότητα Ξυλοπόλεως'],
    ['Αλεξανρουπολη', 'ΔΗΜΟΣ ΑΛΕΞΑΝΔΡΟΥΠΟΛΗΣ'],
    ['Θεσσαλονκη', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'],
    ['Καλαμτα', 'ΔΗΜΟΣ ΚΑΛΑΜΑΤΑΣ'],
  ])('«%s» ⇒ πρώτο %s (διόρθωση ολόκληρης λέξης πάνω από διόρθωση προθέματος)', (query, first) => {
    expect(names(query)[0]).toBe(first);
  });

  it('«Σταυροπολη» ⇒ η Σταυρούπολη (παλιά: μόνο Σταυροπόδιον)', () => {
    expect(names('Σταυροπολη').some((name) => greekWords(name).some((word) => word.startsWith('σταυρουπολ')))).toBe(true);
  });

  it('🔑 σωστή ερώτηση ΔΕΝ γεμίζει με «μήπως»: «Ευοσμ» ⇒ μόνο Εύοσμος, κανένας Ευρώτας', () => {
    const ranking = rankAdminAreas(index, 'Ευοσμ');
    expect(ranking.corrected).toBe(false);
    expect(ranking.areas.every((area) => greekWords(area.name).some((word) => word.startsWith('ευοσμ')))).toBe(true);
  });

  it('κοντή λέξη δεν διορθώνεται (Meilisearch: λάθος από 5 γράμματα) · σκουπίδι ⇒ τίποτα', () => {
    expect(rankAdminAreas(index, 'Ξυλκ')).toEqual({ areas: [], corrected: false });
    expect(rankAdminAreas(index, 'qwerty').areas).toEqual([]);
  });
});

describe('Enter (§5.8) με λάθος — ρωτάμε, ΠΟΤΕ δεν πλοηγούμε σε διόρθωση', () => {
  it('🔑 «Ξυλούπολη» + Enter ⇒ `suggest` με την Ξυλοπόλεως', () => {
    const resolution = resolveTypedAdminArea(index, 'Ξυλούπολη');
    expect(resolution.kind).toBe('suggest');
    if (resolution.kind === 'suggest') expect(resolution.areas.map((area) => area.id)).toContain(XYLOPOLI);
  });

  it('«Ξυλόπολη» + Enter (σωστή γραφή) ⇒ κατευθείαν η περιοχή', () => {
    const resolution = resolveTypedAdminArea(index, 'Ξυλόπολη');
    expect(resolution.kind === 'area' && resolution.area.id).toBe(XYLOPOLI);
  });

  it('πρόθεμα χωρίς λάθος («Θεσ») ⇒ geocoder, όχι «μήπως» — η ερώτηση είναι μόνο για διορθώσεις', () => {
    expect(resolveTypedAdminArea(index, 'Θεσ').kind).toBe('none');
  });
});
