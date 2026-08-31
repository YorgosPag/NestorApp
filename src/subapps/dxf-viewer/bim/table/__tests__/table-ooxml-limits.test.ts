/**
 * Άγκυρες για το `table-ooxml-limits` — ADR-833 Φάση 5Β, **οι ράγες που δεν τις διαλέξαμε**.
 *
 * Η ερώτηση που φυλάνε: **«μπορεί αυτό που γράφει ο χρήστης να ταξιδέψει σε `.xlsx`;»**
 *
 * 🔴 **Ο ΚΡΙΤΗΣ ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ, ΓΡΑΜΜΕΝΟ ΑΥΤΟΥΣΙΑ** — όχι η δική μας σταθερά. Είναι το
 * δεύτερο μάθημα της Φάσης 6 (§5.7.6): μια άγκυρα που συγκρίνει τη σταθερά με τον **εαυτό
 * της** (`expect(x.length).toBeLessThanOrEqual(MAX)`) **δεν μπορεί να κοκκινίσει ποτέ**. Οι
 * αριθμοί εδώ είναι γραμμένοι ως κυριολεκτικά, ακριβώς όπως τους δηλώνει το Excel/OOXML.
 */

import {
  MAX_TABLE_CELL_CHARACTERS,
  MAX_TABLE_COLUMN_COUNT,
  MAX_TABLE_TOTAL_ROW_COUNT,
  clipTableCellText,
} from '../table-ooxml-limits';

describe('🔴 ΟΙ ΤΡΕΙΣ ΑΡΙΘΜΟΙ ΕΙΝΑΙ ΤΟΥ ΠΡΟΤΥΠΟΥ — ο κριτής γραμμένος αυτούσιος', () => {
  it('στήλες: 16.384 — η στήλη «XFD» του Excel', () => {
    expect(MAX_TABLE_COLUMN_COUNT).toBe(16384);
  });

  it('γραμμές: 1.048.576 — το πλέγμα του Excel', () => {
    expect(MAX_TABLE_TOTAL_ROW_COUNT).toBe(1048576);
  });

  it('χαρακτήρες ανά κελί: 32.767 — MS-OI29500 §18.3.1.96 (ST_Xstring)', () => {
    expect(MAX_TABLE_CELL_CHARACTERS).toBe(32767);
  });

  it('🔑 και ΔΕΝ είναι τα παλιά 256 × 1000 — η αιτιολόγηση του χαρτιού αποσύρθηκε', () => {
    // Αν κάποιος «επαναφέρει» τα παλιά όρια εδώ, αυτή η γραμμή τον ρωτά γιατί: το επιχείρημα
    // του A0 ίσχυε μόνο στο **ελάχιστο** πλάτος στήλης, και ο πίνακας έπαψε να είναι μόνο
    // σχέδιο από τη στιγμή που διαβάζει και γράφει `.xlsx` (ADR-833 §5.8.5).
    expect(MAX_TABLE_COLUMN_COUNT).toBeGreaterThan(256);
    expect(MAX_TABLE_TOTAL_ROW_COUNT).toBeGreaterThan(1000);
  });
});

describe('clipTableCellText — κόβει, και ΛΕΕΙ πόσο', () => {
  it('κείμενο που χωρά επιστρέφεται **αναλλοίωτο**, και δηλώνει μηδέν κόψιμο', () => {
    // ⚠️ Η πρώτη γραφή αυτής της άγκυρας έλεγε «**by-reference**». Η μετάλλαξη
    // `String(text)` έμεινε πράσινη — και **σωστά**: οι συμβολοσειρές στη JavaScript είναι
    // πρωτόγονες και συγκρίνονται κατά **τιμή**, οπότε «ίδια αναφορά» δεν είναι
    // παρατηρήσιμη ιδιότητα. Δηλωμένη **ισοδύναμη μετάλλαξη**, με την απόδειξη δίπλα
    // (ίδια στάση με τον φρουρό `json === undefined` του §5.6.6).
    //
    // Η ιδιότητα που **μετρά** —και είναι πραγματικά παρατηρήσιμη— είναι η ταυτότητα του
    // **μοντέλου**: αγκυρώνεται στο `table-capacity-doors.test.ts` («ίδιο κείμενο ⇒ ίδιο
    // μοντέλο»), όπου η μετάλλαξη έχει πού να φανεί.
    const text = 'Δοκός Δ1';
    const result = clipTableCellText(text);
    expect(result.text).toBe(text);
    expect(result.clippedCharacters).toBe(0);
  });

  it('κείμενο **ακριβώς** στο όριο δεν κόβεται — το όριο είναι συμπεριληπτικό', () => {
    // ⚠️ **Δηλωμένη ισοδύναμη μετάλλαξη**: το `<=` → `<` μένει πράσινο, και είναι
    // αποδείξιμο ότι δεν φταίει η άγκυρα. Οι δύο κλάδοι διαφέρουν **μόνο** στο μήκος
    // `= MAX`, όπου ο κλάδος κοψίματος δίνει `slice(0, MAX)` — ίδιο κείμενο — και
    // `MAX − MAX = 0` κομμένους χαρακτήρες. **Καμία** είσοδος δεν τους ξεχωρίζει· το `<=`
    // μένει γιατί εκφράζει τη σύμβαση του προτύπου («έως και 32.767»), όχι επειδή
    // αλλάζει αποτέλεσμα.
    const exact = 'α'.repeat(32767);
    const result = clipTableCellText(exact);
    expect(result.text).toHaveLength(32767);
    expect(result.clippedCharacters).toBe(0);
  });

  it('έναν χαρακτήρα πάνω ⇒ κόβεται **ένας** χαρακτήρας', () => {
    const result = clipTableCellText('α'.repeat(32768));
    expect(result.text).toHaveLength(32767);
    expect(result.clippedCharacters).toBe(1);
  });

  it('αναφέρει τον **ακριβή** αριθμό, όχι σημαία', () => {
    const result = clipTableCellText('x'.repeat(40000));
    expect(result.clippedCharacters).toBe(40000 - 32767);
  });

  it('🔴 Η ΜΟΝΑΔΑ ΕΙΝΑΙ ΧΑΡΑΚΤΗΡΕΣ: ελληνικό και λατινικό ίδιου μήκους κόβονται ΤΟ ΙΔΙΟ', () => {
    // Το ελληνικό κείμενο πιάνει **διπλάσια bytes** σε UTF-8 (ADR-833 §5.6.2). Αν κάποιος
    // «διορθώσει» τη μέτρηση σε bytes, η ελληνική συμβολοσειρά θα κοπεί στο μισό μήκος —
    // δηλαδή ο Έλληνας μηχανικός θα είχε μισό κελί από τον Άγγλο, για λόγο που κανένα
    // πρότυπο δεν στηρίζει.
    const greek = clipTableCellText('Δ'.repeat(40000));
    const latin = clipTableCellText('D'.repeat(40000));
    expect(greek.text).toHaveLength(latin.text.length);
    expect(greek.clippedCharacters).toBe(latin.clippedCharacters);
  });

  it('το κομμένο κείμενο είναι **πρόθεμα** του αρχικού — καμία αναδιάταξη', () => {
    const source = `ΑΡΧΗ${'x'.repeat(40000)}`;
    expect(clipTableCellText(source).text.startsWith('ΑΡΧΗ')).toBe(true);
  });

  it('κενό κείμενο δεν είναι ειδική περίπτωση', () => {
    expect(clipTableCellText('')).toEqual({ text: '', clippedCharacters: 0 });
  });
});
