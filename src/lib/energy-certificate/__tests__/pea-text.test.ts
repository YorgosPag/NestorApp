/**
 * ⚓ ADR-777 §8.96 — η ανάγνωση του κειμένου ενός ΠΕΑ: ντετερμινιστική, ανεξάρτητη από αλλαγές γραμμής, ποτέ μαντεψιά.
 *
 * ⚠️ Τα fixtures είναι ΣΥΝΘΕΤΙΚΑ (`pea-text.fixture.ts`): ίδια δομή με το έντυπο, καμία τιμή πελάτη.
 */

import { SYNTHETIC_PEA, peaPagesAsLines, peaPagesJoined, peaPagesPdfjs, type SyntheticPea } from './pea-text.fixture';
import { PEA_FIELDS, PEA_TEMPLATE, readPeaText, type PeaReading } from '../pea-text';

function read(pages: string[]): PeaReading {
  const result = readPeaText(pages);
  if (result.kind !== 'read') throw new Error(`αναμενόταν ανάγνωση, ήρθε ${result.kind}`);
  return result.reading;
}

const EXPECTED: Omit<PeaReading, 'unread'> = {
  template: PEA_TEMPLATE,
  protocol: '123456/2026',
  securityNumber: 'AB12C-DE34F-GH56J-7',
  issuedOn: '2026-03-01',
  validUntil: '2036-03-01',
  unitTitle: "ΔΙΑΜΕΡΙΣΜΑ Α' ΟΡΟΦΟΥ",
  buildingUse: 'Πολυκατοικία',
  totalArea: 84,
  usefulArea: 84,
  referenceEnergy: 120,
  primaryEnergy: 84,
  co2Emissions: 21.5,
  finalEnergy: [
    { source: 'electricity', perSqm: 21 },
    { source: 'solar', perSqm: 9.5 },
  ],
};

describe('Τ1 — το έντυπο διαβάζεται ολόκληρο, όπως κι αν σπάσουν οι γραμμές', () => {
  it.each([
    ['γραμμή-γραμμή (PyMuPDF)', peaPagesAsLines()],
    ['ενωμένες λέξεις, δύο κελιά μαζί', peaPagesJoined()],
    ['🔴 pdf.js μετρημένο: ο εκθέτης χωριστά, «[kWh/m 2 ]»', peaPagesPdfjs()],
  ])('%s', (_name, pages) => {
    expect(read(pages)).toEqual({ ...EXPECTED, unread: [] });
  });

  it('🔴 η απόδοση pdf.js ΠΕΡΙΕΧΕΙ πράγματι τον χωριστό εκθέτη (αλλιώς το fixture δεν φυλά τίποτα)', () => {
    expect(peaPagesPdfjs()[0]).toContain('[kWh/m 2 ]:');
    expect(peaPagesPdfjs()[0]).not.toContain('/m2]');
  });

  it('η «Συνολική» της σελίδας 2 είναι η προτελευταία από τα 6 κελιά — ΟΧΙ το «%» ούτε η τελευταία χρήση', () => {
    expect(read(peaPagesJoined()).finalEnergy?.find((line) => line.source === 'solar')?.perSqm).toBe(9.5);
  });

  it('μηδενική «Συνολική» = καμία γραμμή (το μηδέν είναι απουσία, όχι κατανάλωση)', () => {
    expect(read(peaPagesJoined()).finalEnergy?.map((line) => line.source)).toEqual(['electricity', 'solar']);
  });

  it('κόμμα ως υποδιαστολή διαβάζεται το ίδιο', () => {
    const comma: SyntheticPea = { ...SYNTHETIC_PEA, primary: '84,0', co2: '21,5' };
    expect(read(peaPagesJoined(comma))).toMatchObject({ primaryEnergy: 84, co2Emissions: 21.5 });
  });
});

describe('Τ2 — ό,τι δεν διαβάζεται ⇒ `null` + όνομα στο `unread`, ποτέ «ο πιο κοντινός αριθμός»', () => {
  it('🔴 μία γραμμή του πίνακα με λάθος αριθμό κελιών ⇒ ΟΛΟΣ ο πίνακας `null` (ποτέ «οι γραμμές που κατάλαβα»)', () => {
    const broken: SyntheticPea = { ...SYNTHETIC_PEA, rows: { ...SYNTHETIC_PEA.rows, 'Πετρέλαιο': '0.0 0.0 0.0' } };
    const reading = read(peaPagesJoined(broken));
    expect(reading.finalEnergy).toBeNull();
    expect(reading.unread).toEqual(['finalEnergy']);
  });

  it('κελί που δεν είναι αριθμός ⇒ ο πίνακας `null`', () => {
    const broken: SyntheticPea = { ...SYNTHETIC_PEA, rows: { ...SYNTHETIC_PEA.rows, 'Ηλεκτρική': '10.0 3.0 8.0 0.0 πολλά 100' } };
    expect(read(peaPagesJoined(broken)).finalEnergy).toBeNull();
  });

  it('ανύπαρκτη ημέρα ⇒ `null`', () => {
    expect(read(peaPagesJoined({ ...SYNTHETIC_PEA, issued: '31/02/2026' })).issuedOn).toBeNull();
  });

  it('αριθμός ασφαλείας σε άλλη μορφή ⇒ `null` (δεν «διορθώνεται»)', () => {
    expect(read(peaPagesJoined({ ...SYNTHETIC_PEA, security: 'AB12C-DE34F' })).securityNumber).toBeNull();
  });

  it('το `unread` χρησιμοποιεί μόνο ονόματα του λεξιλογίου', () => {
    const reading = read(['ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ (ΠΕΑ)']);
    expect(reading.unread).toEqual(PEA_FIELDS);
  });
});

describe('Τ3 — άλλο PDF δεν «διαβάζεται μισό»', () => {
  it.each([[[]], [['ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΚΤΗΜΑΤΟΓΡΑΦΗΣΗΣ Αρ. Πρωτοκόλλου: 1/2026']], [['']]])('%j ⇒ not-a-certificate', (pages) => {
    expect(readPeaText(pages)).toEqual({ kind: 'not-a-certificate' });
  });
});

describe('Τ4 — 🔒 προσωπικά δεδομένα δεν διαβάζονται ποτέ', () => {
  it('ούτε διεύθυνση ούτε επιθεωρητής εμφανίζονται πουθενά στην ανάγνωση', () => {
    const serialized = JSON.stringify(read(peaPagesJoined()));
    expect(serialized).not.toContain('ΟΔΟΣ ΔΟΚΙΜΗΣ');
    expect(serialized).not.toContain('ΔΟΚΙΜΑΣΤΗΣ');
  });
});
