/**
 * ADR-737 §11-2 — ΣΥΜΜΕΤΡΙΑ ROUND-TRIP ΤΟΥ `\A#;` ΜΕΣΑ ΣΕ ΣΤΟΙΒΑ `\S`.
 *
 * Το §11-2 έδωσε στο `TextStack.style` πεδίο `verticalAlign`, ώστε η στοίχιση να εφαρμόζεται και
 * στο κοντό περιεχόμενο των ετικετών εμβαδού (όπου **είναι** η στοίβα). Μόλις όμως ένα πεδίο
 * γίνει γραφόμενο μέλος του AST, μπαίνει αυτόματα στο πεδίο του round-trip — και εκεί ζούσε η
 * **ΒΛΑΒΗ Ε**: ο δικός μας serializer παρήγαγε κάτι που ο δικός μας parser δεν διάβαζε πίσω.
 *
 * 🐛 ΕΔΩ Η ΑΣΥΜΜΕΤΡΙΑ ΗΤΑΝ Η ΑΝΤΙΣΤΡΟΦΗ: ο parser **διάβαζε** το `\A` μέσα στη στοίβα, αλλά ο
 * `serializeParagraph` έκανε `continue` για κάθε στοίβα **πριν** από οποιαδήποτε διαφορά στυλ —
 * άρα το export δεν το ξανάγραφε ΠΟΤΕ. Ένας κύκλος export→import έσβηνε τη στοίχιση ακριβώς
 * στο σημείο όπου είναι ορατή. Ίδια κατηγορία σφάλματος, ανάποδη φορά.
 *
 * Τα tests παρακάτω δεν ρωτούν «είναι ίσα τα strings;» — ρωτούν **δύο διαδοχικά περάσματα**:
 * parse → serialize → parse. Μια ασυμμετρία που τυχαίνει να είναι ιδεμπόδης στο πρώτο πέρασμα
 * αλλά χάνει πληροφορία, πέφτει στο δεύτερο.
 */

// N.18 — οι βοηθοί round-trip ζουν σε ΕΝΑ σημείο· αντιγραμμένοι στο §11-5 θα ήταν sibling clone.
import { AREA_LABEL, alignsOf, isStack, parse, serialize, stackOf } from './mtext-roundtrip-harness';

describe('ADR-737 §11-2 — ο parser γεμίζει το \\A στη στοίβα', () => {
  it('η στοίβα παίρνει την ΚΑΤΑΣΤΑΣΗ στυλ τη στιγμή που γεννιέται', () => {
    expect(stackOf(parse(AREA_LABEL)).style.verticalAlign).toBe(1);
  });

  it('χωρίς κανένα \\A η στοίβα ΔΕΝ αποκτά πεδίο (δεν εφευρίσκουμε προεπιλογή στο AST)', () => {
    expect(stackOf(parse('Α\\S1^2;Β')).style.verticalAlign).toBeUndefined();
  });

  it('το \\A ΜΕΤΑ τη στοίβα δεν την επηρεάζει αναδρομικά', () => {
    // Κατάσταση = «ό,τι ίσχυε ΩΣ ΕΚΕΙΝΗ ΤΗ ΣΤΙΓΜΗ», όπως το ύψος και το χρώμα.
    expect(alignsOf(parse('\\S1^2;\\A2;Β'))).toEqual([undefined, 2]);
  });
});

describe('ADR-737 §11-2 — ο serializer ΞΑΝΑΓΡΑΦΕΙ το \\A της στοίβας', () => {
  it('εκπέμπει \\A όταν η στοίβα διαφέρει από την προηγούμενη κατάσταση', () => {
    // Ο διαχωριστής μένει `^` (tolerance) — τον δίνει το SSoT `mtextStackDivider`, όχι εμείς.
    expect(serialize(parse('Α\\A1;\\S1^2;Β'))).toContain('\\A1;\\S1^2;');
  });

  it('ΔΕΝ εκπέμπει περιττό \\A όταν η στοίβα συμφωνεί με το προηγούμενο run', () => {
    // Το `\A1;` γράφεται ΜΙΑ φορά, στο run που το εισήγαγε — όχι ξανά πριν από τη στοίβα.
    const out = serialize(parse('\\A1;Α\\S1^2;Β'));
    expect(out.match(/\\A1;/g)).toHaveLength(1);
  });

  it('η κατάσταση προχωρά ΜΕΣΑ από τη στοίβα (το επόμενο run δεν ξαναδηλώνει)', () => {
    const out = serialize(parse('Α\\A2;\\S1^2;Β'));
    expect(out.match(/\\A2;/g)).toHaveLength(1);
    expect(out).not.toMatch(/\\A0;/);
  });

  it('κείμενο χωρίς \\A μένει καθαρό από \\A (μηδέν θόρυβος στο export)', () => {
    expect(serialize(parse('Α\\S1^2;Β'))).not.toContain('\\A');
  });
});

describe('ADR-737 §11-2 — ΔΥΟ ΠΕΡΑΣΜΑΤΑ: το \\A της στοίβας επιβιώνει', () => {
  it.each([
    ['η πραγματική ετικέτα εμβαδού', AREA_LABEL],
    ['στοίχιση που ανοίγει ΠΡΙΝ τη στοίβα', 'Α\\A1;\\S1^2;Β'],
    ['στοίχιση top σε στοίβα κλάσματος', '\\A2;\\S1/2;υπόλοιπο'],
    ['επιστροφή σε bottom μετά τη στοίβα', '\\A1;\\S1^2;\\A0;Β'],
  ])('%s', (_label, raw) => {
    const first = parse(raw);
    const second = parse(serialize(first));
    // (α) η στοίβα κρατά την ίδια στοίχιση και στα δύο περάσματα…
    expect(second.paragraphs[0].runs.filter(isStack).map((s) => s.style.verticalAlign))
      .toEqual(first.paragraphs[0].runs.filter(isStack).map((s) => s.style.verticalAlign));
    // (β) …και ΚΑΝΕΝΑ παιδί (run ή στοίβα) δεν άλλαξε στοίχιση.
    expect(alignsOf(second)).toEqual(alignsOf(first));
  });

  it('ΣΤΑΘΕΡΟ ΣΗΜΕΙΟ: το τρίτο πέρασμα δίνει το ίδιο string με το δεύτερο', () => {
    // Μια μονόδρομη διαρροή δείχνει το πρόσωπό της ακριβώς εδώ: το string σταματά να αλλάζει
    // μόνο όταν parser και serializer συμφωνούν στο ΙΔΙΟ λεξιλόγιο.
    const once = serialize(parse(AREA_LABEL));
    expect(serialize(parse(once))).toBe(once);
  });
});
