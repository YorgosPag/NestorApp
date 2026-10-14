/**
 * **Συνθετικό ΠΕΑ** για τα tests (ADR-777 §8.96) — ΙΔΙΑ δομή με το έντυπο του buildingcert.gr (μετρημένη σε δύο
 * πραγματικά ΠΕΑ, 2025 · 2026), ΚΑΜΙΑ τιμή από αρχείο πελάτη: διεύθυνση, πρωτόκολλο, αριθμός ασφαλείας, επιθεωρητής και
 * αριθμοί είναι επινοημένα.
 *
 * Δύο αποδόσεις του ίδιου εντύπου, γιατί οι εξαγωγείς σπάνε τις γραμμές διαφορετικά (μετρημένο):
 * - `lines` — μία ετικέτα / μία τιμή ανά γραμμή (όπως το PyMuPDF)·
 * - `joined` — λέξεις ενωμένες με κενό, και δύο κελιά στην ίδια «γραμμή» (όπως το pdf.js του `extractPdfText`).
 */

export interface SyntheticPea {
  readonly protocol: string;
  readonly security: string;
  readonly issued: string;
  readonly valid: string;
  readonly title: string;
  readonly useful: string;
  readonly reference: string;
  readonly primary: string;
  readonly co2: string;
  /** Η σελίδα 2: γραμμή ανά πηγή — 4 κελιά χρήσεων, «Συνολική», «%». */
  readonly rows: Readonly<Record<string, string>>;
}

export const SYNTHETIC_PEA: SyntheticPea = {
  protocol: '123456/2026',
  security: 'AB12C-DE34F-GH56J-7',
  issued: '01/03/2026',
  valid: '01/03/2036',
  title: "ΔΙΑΜΕΡΙΣΜΑ Α' ΟΡΟΦΟΥ",
  useful: '84.0',
  reference: '120.0',
  primary: '84.0',
  co2: '21.5',
  rows: {
    'Ηλεκτρική': '10.0 3.0 8.0 0.0 21.0 100',
    'Πετρέλαιο': '0.0 0.0 0.0 0.0 0.0 0',
    'Φυσικό Αέριο': '0.0 0.0 0.0 0.0 0.0 0',
    'Άλλα Ορυκτά Καύσιμα': '0.0 0.0 0.0 0.0 0.0 0',
    'Ηλιακή': '--- --- --- --- 9.5 45.24',
    'Βιομάζα': '--- --- --- --- 0.0 0',
    'Γεωθερμία': '--- --- --- --- 0.0 0',
    'Άλλη ΑΠΕ': '--- --- --- --- 0.0 0',
  },
};

function page1(pea: SyntheticPea): string[] {
  return [
    'ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ (ΠΕΑ)', 'ΟΔΟΣ ΔΟΚΙΜΗΣ 1 10000 , ΠΟΛΗ',
    'Αρ. Πρωτοκόλλου:', pea.protocol, 'Αρ. Ασφαλείας:', pea.security,
    'Ημερομηνία Έκδοσης:', pea.issued, 'Ημερομηνία Ισχύος:', pea.valid,
    '• Ελέγξτε την εγκυρότητα του ΠΕΑ: https://www.buildingcert.gr/checkCert.view',
    'Τίτλος Κτηριακής Μονάδας:', `"${pea.title}"`, 'Χρήση:', 'Πολυκατοικία', 'Κλιματική Ζώνη:', 'Β',
    'Συνολική Επιφάνεια:', pea.useful, 'Ωφέλιμη Επιφάνεια:', pea.useful,
    'Ενεργειακή κατηγορία:', 'Υφιστάμενη', 'Δυνητική',
    'Υπολογιζόμενη ετήσια κατανάλωση πρωτογενούς ενέργειας*',
    'Κτηρίου αναφοράς [kWh/m2]:', pea.reference, 'Επιθεωρούμενου κτηρίου [kWh/m2]:', pea.primary,
    'Πραγματική Ετήσια Κατανάλωση Επιθεωρούμενου Κτιρίου:', 'Ηλεκτρικής ενέργειας [kWh/m2]:', '0.0',
    'Συνολική ετήσια κατανάλωση πρωτογενούς ενέργειας [kWh/m2]:', '0.0',
    'Ετήσιες εκπομπές CO2 επιθεωρούμενου κτηρίου', 'Υπολογιζόμενες ετήσιες εκπομπές CO2 [kg /m2]:', pea.co2,
    'Πραγματικές ετήσιες εκπομπές CO2 [kg /m2]:', '0.0',
  ];
}

function page2(pea: SyntheticPea): string[] {
  return [
    'ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ (ΠΕΑ)', 'Αρ. Πρωτοκόλλου:', pea.protocol,
    'Υπολογιζόμενη Ετήσια Κατανάλωση Τελικής Ένέργειας', 'ανα Πηγή Ενέργειας & Τελική Χρήση [kWh/m2]',
    'Πηγή ενέργειας', 'Θέρμανση', 'Ψύξη ΖΝΧ', 'Φωτισμός', 'Συνολική', 'Συνεισφορά στο', 'ενεργειακό ισοζύγιο',
    'του κτηρίου [%]',
    ...Object.entries(pea.rows).flatMap(([label, cells]) => [label, ...cells.split(' ')]),
    'Σύνολο', '10.0', '3.0 8.0', '0', '21.0', '100.0', 'Χρησιμοποιήστε το ΠΕΑ για να:',
    'Ονοματεπώνυμο Ενεργειακού Επιθεωρητή:', 'ΔΟΚΙΜΑΣΤΗΣ ΕΠΙΘΕΩΡΗΤΗΣ',
  ];
}

/** Μία γραμμή ανά ετικέτα/τιμή — η απόδοση του PyMuPDF. */
export function peaPagesAsLines(pea: SyntheticPea = SYNTHETIC_PEA): string[] {
  return [page1(pea).join('\n'), page2(pea).join('\n')];
}

/** Λέξεις ενωμένες με κενό, ζεύγη κελιών στην ίδια γραμμή. */
export function peaPagesJoined(pea: SyntheticPea = SYNTHETIC_PEA): string[] {
  return [page1(pea).join(' '), page2(pea).join(' ')];
}

/**
 * Η απόδοση του **`extractPdfText` (pdf.js)**, όπως **μετρήθηκε** σε δύο πραγματικά ΠΕΑ (ADR-777 §8.96.5): ο εκθέτης
 * του «m²» είναι ξεχωριστό κομμάτι κειμένου ⇒ `[kWh/m 2 ]` · `[kg /m 2 ]`. Αυτή η μορφή έκρυψε τα EP/RR/CO₂ από
 * τα δύο προηγούμενα fixtures.
 */
export function peaPagesPdfjs(pea: SyntheticPea = SYNTHETIC_PEA): string[] {
  return peaPagesJoined(pea).map((page) => page.replace(/\/m2\]/g, '/m 2 ]'));
}
