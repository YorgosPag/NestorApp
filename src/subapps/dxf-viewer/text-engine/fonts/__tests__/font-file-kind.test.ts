/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **το κατηγόρημα «SHX ή TrueType;»**.
 *
 * ## Τι κλειδώνεται εδώ, και τι πλήρωσε η απουσία του
 * Το DXF group 3 είναι όνομα **αρχείου**, και το AutoCAD θεωρεί κάθε όνομα χωρίς επέκταση
 * ότι είναι `.shx`. Η Φ1 εξήγαγε γυμνό `Arial` ⇒ αίτημα για ανύπαρκτο `Arial.shx` ⇒ το
 * AutoCAD υποκατέστησε γραμματοσειρά και **τίποτα δεν φαινόταν** σε αρχείο με 2.642 πράσινα
 * tests. Μπαλώθηκε **ονομαστικά** για το Arial, με ρητή καταγραφή ότι το `Calibri` μένει
 * σπασμένο μέχρι να υπάρξει αυτό το κατηγόρημα.
 *
 * ## Η ασυμμετρία που ελέγχεται ρητά
 * Η προεπιλογή είναι `truetype` **επίτηδες**: λάθος «TrueType» σε SHX ⇒ τα Windows
 * υποκαθιστούν και το κείμενο φαίνεται· λάθος «SHX» σε TrueType ⇒ ανύπαρκτο αρχείο και
 * κείμενο που εξαφανίζεται. Το τελευταίο test το δηλώνει ως **απόφαση**, ώστε να μην
 * «διορθωθεί» κάποτε σε κάτι πιο συντηρητικό που είναι στην πραγματικότητα πιο επικίνδυνο.
 */

import {
  FONT_EXTENSION_FORMATS,
  dxfFontFileFor,
  fontFamilyOfFileName,
  fontFormatOfFileName,
  fontKindOf,
} from '../font-file-kind';
import { FONT_SUBSTITUTION_TABLE } from '../font-substitution-table';

describe('fontFormatOfFileName — ο ΕΝΑΣ κατάλογος επεκτάσεων', () => {
  it('αναγνωρίζει κάθε επέκταση του καταλόγου, ανεξάρτητα από πεζά/κεφαλαία', () => {
    for (const [ext, format] of Object.entries(FONT_EXTENSION_FORMATS)) {
      expect(fontFormatOfFileName(`Font${ext}`)).toBe(format);
      expect(fontFormatOfFileName(`Font${ext.toUpperCase()}`)).toBe(format);
    }
  });

  it('χωρίς επέκταση ή με άγνωστη επέκταση δεν απαντά τίποτα', () => {
    expect(fontFormatOfFileName('Arial')).toBeUndefined();
    expect(fontFormatOfFileName('Arial.dwg')).toBeUndefined();
  });

  it('🔴 όνομα που ΞΕΚΙΝΑ με τελεία δεν έχει επέκταση — έχει κρυφό όνομα', () => {
    // `'.ttf'.lastIndexOf('.') === 0`: ένας αφελής έλεγχος `dot >= 0` θα διάβαζε ολόκληρο το
    // όνομα ως επέκταση και θα χαρακτήριζε ένα αρχείο `.ttf` (χωρίς όνομα) ως γραμματοσειρά.
    expect(fontFormatOfFileName('.ttf')).toBeUndefined();
  });
});

describe('fontKindOf — η ρητή επέκταση νικά τα πάντα', () => {
  it('`.shx` ⇒ shx· `.ttf`/`.otf` ⇒ truetype', () => {
    expect(fontKindOf('romans.shx')).toBe('shx');
    expect(fontKindOf('ROMANS.SHX')).toBe('shx');
    expect(fontKindOf('Arial.ttf')).toBe('truetype');
    expect(fontKindOf('Custom.otf')).toBe('truetype');
  });

  it('🔴 κάθε γνωστό SHX του πίνακα υποκατάστασης αναγνωρίζεται και ΓΥΜΝΟ', () => {
    // Το AutoCAD γράφει τα SHX και χωρίς επέκταση («TXT»). Η γνώση δεν αντιγράφεται εδώ —
    // παράγεται από το `FONT_SUBSTITUTION_TABLE`, που είναι ήδη ο κατάλογος γνωστών SHX.
    const known = FONT_SUBSTITUTION_TABLE
      .filter((e) => e.shxName !== '*')
      .map((e) => e.shxName.replace(/\.shx$/i, ''));
    expect(known.length).toBeGreaterThan(0);
    for (const name of known) {
      expect(fontKindOf(name)).toBe('shx');
      expect(fontKindOf(name.toUpperCase())).toBe('shx');
    }
  });

  it('🔴 ΑΠΟΦΑΣΗ: άγνωστη γυμνή οικογένεια = TrueType, γιατί η ζημιά είναι ασύμμετρη', () => {
    expect(fontKindOf('Calibri')).toBe('truetype');
    expect(fontKindOf('Segoe UI')).toBe('truetype');
    expect(fontKindOf('')).toBe('truetype');
  });
});

describe('dxfFontFileFor — το group 3', () => {
  it('TrueType χωρίς επέκταση παίρνει `.ttf` — η δήλωση «μη ψάξεις για .shx»', () => {
    expect(dxfFontFileFor('Arial')).toBe('Arial.ttf');
    expect(dxfFontFileFor('Calibri')).toBe('Calibri.ttf');
    expect(dxfFontFileFor('Times New Roman')).toBe('Times New Roman.ttf');
  });

  it('ό,τι έχει ήδη επέκταση μένει αυτούσιο — καμία διπλή επέκταση', () => {
    expect(dxfFontFileFor('Arial.ttf')).toBe('Arial.ttf');
    expect(dxfFontFileFor('Custom.otf')).toBe('Custom.otf');
  });

  it('🔴 τα SHX μένουν ΑΥΤΟΥΣΙΑ — το AutoCAD προσθέτει μόνο του το `.shx`', () => {
    // Ίδια byte με πριν το βήμα 4 για κάθε εισαγόμενο SHX style: το χρέος που κλείνει αφορά
    // **μόνο** τις TrueType, και μια «κανονικοποίηση» εδώ θα μετακινούσε αρχεία που δούλευαν.
    expect(dxfFontFileFor('romans')).toBe('romans');
    expect(dxfFontFileFor('isocpeur')).toBe('isocpeur');
    expect(dxfFontFileFor('txt.shx')).toBe('txt.shx');
  });

  it('κενό όνομα δεν γεννά «.ttf» από το πουθενά', () => {
    expect(dxfFontFileFor('')).toBe('');
    expect(dxfFontFileFor('   ')).toBe('');
  });
});

describe('fontFamilyOfFileName — η αντίστροφη πράξη, κοινή με τον importer', () => {
  it('αφαιρεί την επέκταση', () => {
    expect(fontFamilyOfFileName('Arial.ttf')).toBe('Arial');
    expect(fontFamilyOfFileName('romans.shx')).toBe('romans');
  });

  it('χωρίς επέκταση επιστρέφει το ίδιο όνομα', () => {
    expect(fontFamilyOfFileName('Arial')).toBe('Arial');
  });

  it('🔴 κάνει round-trip με το `dxfFontFileFor` για κάθε TrueType οικογένεια', () => {
    // Αυτό ΕΙΝΑΙ το συμβόλαιο ADR-635 Φ C.5: όνομα → αρχείο → όνομα. Αν οι δύο πράξεις
    // αποκλίνουν, ένα αρχείο παύει να διαβάζεται σωστά από την ίδια του την εφαρμογή.
    for (const family of ['Arial', 'Calibri', 'Times New Roman', 'Roboto']) {
      expect(fontFamilyOfFileName(dxfFontFileFor(family))).toBe(family);
    }
  });
});
