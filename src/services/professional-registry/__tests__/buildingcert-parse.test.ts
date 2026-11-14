/**
 * ADR-915 §40.7 Φ2 — η σελίδα αποτελεσμάτων του Μητρώου Ενεργειακών Επιθεωρητών ⇒ ετυμηγορία.
 *
 * Τα fixtures είναι **πραγματικές** απαντήσεις του buildingcert.gr (2026-11-15), με τη γραμμή δεδομένων
 * αντικατεστημένη από **συνθετικό** πρόσωπο — η δομή αυθεντική, κανένα προσωπικό στοιχείο.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseBuildingcertResults } from '../buildingcert-parse';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
const FOUND = fixture('buildingcert-found.html');
const ABSENT = fixture('buildingcert-absent.html');

describe('Β — βρέθηκε', () => {
  it('Β1 η γραμμή: αριθμός · ΜΟΝΟ το επώνυμο · τάξεις ανά κατηγορία με το ρητό «Οχι»', () => {
    const verdict = parseBuildingcertResults(FOUND, '2600');
    expect(verdict).toMatchObject({
      kind: 'found',
      row: { number: '2600', surname: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', grades: { buildings: 'A', heating: 'none', cooling: 'none' } },
    });
    if (verdict.kind === 'found') expect(verdict.row.rowSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('Β2 🔒 τηλέφωνο, email, διεύθυνση και όνομα ΔΕΝ βγαίνουν από τον αναλυτή (GDPR 5(1)(γ))', () => {
    const serialized = JSON.stringify(parseBuildingcertResults(FOUND, '2600'));
    for (const leaked of ['2100000000', 'test@example.invalid', 'Δοκιμής', 'ΝΙΚΟΛΑΟΣ']) expect(serialized).not.toContain(leaked);
  });

  it('Β3 Β΄ τάξη, με οποιαδήποτε απόστροφο ή λατινικό γράμμα', () => {
    for (const cell of ["Β' Τάξη", 'Β΄ Τάξη', 'B’ ΤΑΞΗ']) {
      const html = FOUND.replace("<td>Α' Τάξη </td>", `<td>${cell} </td>`);
      expect(parseBuildingcertResults(html, '2600')).toMatchObject({ kind: 'found', row: { grades: { buildings: 'B' } } });
    }
  });

  it('Β4 το αποτύπωμα αλλάζει όταν αλλάζει τάξη (απόδειξη, όχι διακόσμηση)', () => {
    const a = parseBuildingcertResults(FOUND, '2600');
    const b = parseBuildingcertResults(FOUND.replace("<td>Α' Τάξη </td>", "<td>Β' Τάξη </td>"), '2600');
    expect(a.kind === 'found' && b.kind === 'found' && a.row.rowSha256 !== b.row.rowSha256).toBe(true);
  });
});

describe('Α — δεν βρέθηκε, μόνο με απόδειξη', () => {
  it('Α1 «Δε βρέθηκαν» + ο αριθμός επέστρεψε στη φόρμα ⇒ absent', () => {
    expect(parseBuildingcertResults(ABSENT, '99999999')).toEqual({ kind: 'absent' });
  });

  it('Α2 πίνακας με ΓΕΙΤΟΝΙΚΟ αριθμό μόνο ⇒ absent (ακριβής σύγκριση)', () => {
    expect(parseBuildingcertResults(FOUND.replace('<td>2600 </td>', '<td>26001 </td>'), '2600')).toEqual({ kind: 'absent' });
  });

  it('Α3 δύο γραμμές με τον ίδιο αριθμό ⇒ ambiguous, καμία μαντεψιά', () => {
    const row = FOUND.slice(FOUND.indexOf('<tr> <td>2600 </td>'), FOUND.indexOf('</tr>', FOUND.indexOf('<tr> <td>2600 </td>')) + 5);
    expect(parseBuildingcertResults(FOUND.replace(row, row + row), '2600')).toEqual({ kind: 'ambiguous' });
  });
});

describe('Λ — ονομασμένη αποτυχία, ποτέ σιωπηλό «δεν υπάρχει»', () => {
  it('Λ1 ο αριθμός ΔΕΝ επέστρεψε στη φόρμα ⇒ layout-changed (η ερώτηση δεν κατανοήθηκε)', () => {
    expect(parseBuildingcertResults(ABSENT, '2600')).toEqual({ kind: 'layout-changed', detail: 'number-echo' });
  });

  it('Λ2 ούτε πίνακας ούτε «Δε βρέθηκαν» ⇒ layout-changed', () => {
    const html = ABSENT.replace('Δε βρέθηκαν επιθεωρητές με τα κριτήρια που εισάγατε', 'Κάτι άλλο');
    expect(parseBuildingcertResults(html, '99999999')).toEqual({ kind: 'layout-changed', detail: 'no-results-marker' });
  });

  it('Λ3 άγνωστη τιμή τάξης («Γ΄», καταργημένη) ⇒ layout-changed με το όνομα της στήλης', () => {
    const html = FOUND.replace("<td>Α' Τάξη </td>", "<td>Γ' Τάξη </td>");
    expect(parseBuildingcertResults(html, '2600')).toEqual({ kind: 'layout-changed', detail: 'grade-cell:buildings' });
  });

  it('Λ4 μετονομασμένη στήλη ⇒ layout-changed (ο πίνακας βρίσκεται από τις επικεφαλίδες)', () => {
    const html = FOUND.replace('>Συστήματα Θέρμανσης<', '>Θέρμανση<');
    expect(parseBuildingcertResults(html, '2600')).toEqual({ kind: 'layout-changed', detail: 'header-columns' });
  });

  it('Λ5 καθόλου φόρμα (π.χ. σελίδα σφάλματος) ⇒ layout-changed', () => {
    expect(parseBuildingcertResults('<html><body>Service Unavailable</body></html>', '2600')).toEqual({
      kind: 'layout-changed',
      detail: 'form',
    });
  });
});
