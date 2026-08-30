/**
 * **Ο ΑΥΤΟΕΛΕΓΧΟΣ ΤΟΥ ΟΡΓΑΝΟΥ** — *«μπορεί αυτός ο μεταλλάκτης να δει τη βλάβη;»*.
 *
 * ## Γιατί υπάρχει αυτό το αρχείο, και γιατί δεν είναι ταυτολογία
 *
 * Ο {@link module:scripts/__tests__/_mutate} είναι το όργανο με το οποίο **επτά** σουίτες
 * αποδεικνύουν ότι οι πύλες τους πυροδοτούν. Αν το όργανο δει λάθος, **επτά** αποδείξεις
 * γίνονται διακοσμητικές ταυτόχρονα — και το χειρότερο σχήμα αυτού του έργου
 * *(«**0 σημαίνει “κανείς δεν κοίταξε”**, όχι “καθαρό”»)* μετακομίζει μια στρώση πιο μέσα.
 *
 * 🔴 Και **δεν είναι υποθετικό**: πριν από αυτό το αρχείο, τρεις αυτοέλεγχοι του CHECK 3.63
 * ούρλιαζαν *«ο στόχος βρέθηκε 0 φορές»* σε **κάθε** εκτέλεση στα Windows, ενώ ο στόχος ήταν
 * εκεί. Κόκκινο για λάθος λόγο είναι θόρυβος που **εκπαιδεύει τον άνθρωπο να αγνοεί κόκκινα**.
 *
 * ⚠️ **Οι μεταλλάξεις της ομάδας Μ δείχνουν στην ΚΛΗΣΗ, ποτέ σε `import`.** Άγκυρα που ζητά
 * σκέτο όνομα συνάρτησης έχει **μετρηθεί** ότι μένει πράσινη ενώ ο έλεγχος έχει αφαιρεθεί.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { mutateText, withMutation, dominantEol } = require('./_mutate');

const MUTATOR = path.join(__dirname, '_mutate.js');

/** Δύο γραμμές, σε **CRLF** — το ακριβές σχήμα του `.shell-surface.json`. */
const CRLF_DOC = '{\r\n  "groupsWithoutCorridor": {\r\n    "(bare)": {\r\n      "reason": "x"\r\n    }\r\n  }\r\n}\r\n';
/** Το ίδιο έγγραφο σε **LF** — το σχήμα των υπόλοιπων μητρώων. */
const LF_DOC = CRLF_DOC.replace(/\r\n/g, '\n');

/** Ο στόχος όπως τον γράφει ο άνθρωπος σε JavaScript: **πάντα** με `\n`. */
const MULTILINE_NEEDLE = '"groupsWithoutCorridor": {\n    "(bare)": {';

let scratch;
beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mutate-anchor-')); });
afterAll(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

/** Γράψε προσωρινό αρχείο με **ακριβή** bytes και δώσε το μονοπάτι του. */
function scratchFile(name, contents) {
  const at = path.join(scratch, name);
  fs.writeFileSync(at, contents, 'utf8');
  return at;
}

// ═══ Κ — το συμβόλαιο του κανόνα ═════════════════════════════════════════════

describe('Κ — ο κανόνας: βρίσκει μονοσήμαντα, ανεξάρτητα από τα τέλη γραμμής', () => {
  test('Κ1: στόχος γραμμένος με \\n βρίσκεται σε έγγραφο **CRLF** — ΤΟ ΑΚΡΙΒΕΣ ΠΕΡΙΣΤΑΤΙΚΟ', () => {
    // 🔴 Αυτή η γραμμή είναι όλο το ανοιχτό Α: το `String.split` εδώ επέστρεφε 0.
    const after = mutateText(CRLF_DOC, MULTILINE_NEEDLE, '"groupsWithoutCorridor": {\n    "(light)": {');
    expect(after).toContain('"(light)"');
    expect(after).not.toContain('"(bare)"');
  });

  test('Κ2: ο ΙΔΙΟΣ στόχος βρίσκεται και σε έγγραφο LF — η θεραπεία δεν αντιστρέφει τη βλάβη', () => {
    const after = mutateText(LF_DOC, MULTILINE_NEEDLE, '"groupsWithoutCorridor": {\n    "(light)": {');
    expect(after).toContain('"(light)"');
  });

  test('Κ3: στόχος γραμμένος με \\r\\n βρίσκεται σε έγγραφο LF — και η ΑΝΑΠΟΔΗ κατεύθυνση', () => {
    // Στόχος αντιγραμμένος από αρχείο των Windows. Χωρίς κανονικοποίηση της βελόνας θα
    // παρήγαγε `\r?\n\r?\n` ⇒ θα απαιτούσε ΔΥΟ αλλαγές γραμμής ⇒ πάλι «0 φορές».
    const after = mutateText(LF_DOC, MULTILINE_NEEDLE.replace(/\n/g, '\r\n'), 'ΒΡΕΘΗΚΕ');
    expect(after).toContain('ΒΡΕΘΗΚΕ');
  });

  test('Κ4: ΑΣΑΦΗΣ στόχος ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ σιωπηλό χτύπημα της 1ης', () => {
    expect(() => mutateText('α\nΧ\nβ\nΧ\nγ', 'Χ', 'Ψ')).toThrow(/ΑΣΑΦΗΣ στόχος — 2 εμφανίσεις/);
  });

  test('Κ5: δηλωμένη εμφάνιση #2 ⇒ χτυπά τη ΔΕΥΤΕΡΗ, η πρώτη μένει ανέγγιχτη', () => {
    const after = mutateText('Χ|Χ', 'Χ', 'Ψ', { occurrence: 2 });
    expect(after).toBe('Χ|Ψ');
  });

  test('Κ6: δηλωμένο `all` ⇒ όλες — και η ασάφεια ΔΕΝ είναι πια σφάλμα, γιατί δηλώθηκε', () => {
    expect(mutateText('Χ|Χ', 'Χ', 'Ψ', { all: true })).toBe('Ψ|Ψ');
  });

  test('Κ7: αντικατάσταση που ΠΡΟΣΘΕΤΕΙ γραμμές σε αρχείο CRLF δεν το κάνει ανάμεικτο', () => {
    // Χωρίς ευθυγράμμιση, η θεραπεία θα γεννούσε τη βλάβη: ο επόμενος αναγνώστης του
    // μητρώου θα ξαναζούσε το ίδιο «0 φορές», σε αρχείο που το χαλάσαμε ΕΜΕΙΣ.
    const after = mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'πρώτη\nδεύτερη');
    expect(after).toContain('πρώτη\r\nδεύτερη');
    expect(after).not.toMatch(/[^\r]\nδεύτερη/);
  });

  test('Κ8: `$&` στο κείμενο αντικατάστασης μένει ΚΥΡΙΟΛΕΚΤΙΚΟ, δεν γίνεται αναφορά ομάδας', () => {
    expect(mutateText('αΧβ', 'Χ', '$&')).toBe('α$&β');
  });

  test('Κ9: και η ΚΑΝΟΝΙΚΗ ΕΚΦΡΑΣΗ μετριέται για ασάφεια — κανένα προηγούμενο αντίγραφο δεν το έκανε', () => {
    expect(() => mutateText('αΧβΧγ', /Χ/, 'Ψ')).toThrow(/ΑΣΑΦΗΣ στόχος/);
  });

  test('Κ10: στόχος που ΛΕΙΠΕΙ ⇒ σφάλμα που λέει ρητά ότι δεν φταίνε τα τέλη γραμμής', () => {
    expect(() => mutateText(CRLF_DOC, 'δεν υπάρχει πουθενά', 'x'))
      .toThrow(/βρέθηκε 0 φορές[\s\S]*ΑΝΕΞΑΡΤΗΤΑ από τα τέλη γραμμής/);
  });

  test('Κ11: αντικατάσταση ταυτόσημη με τον στόχο ⇒ άρνηση — η άγκυρα δεν θα απεδείκνυε τίποτα', () => {
    expect(() => mutateText('αΧβ', 'Χ', 'Χ')).toThrow(/ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ/);
  });

  test('Κ12: η κυρίαρχη σύμβαση μετριέται, δεν μαντεύεται', () => {
    expect(dominantEol(CRLF_DOC)).toBe('\r\n');
    expect(dominantEol(LF_DOC)).toBe('\n');
  });
});

// ═══ Δ — η τελετουργία του δίσκου ════════════════════════════════════════════

describe('Δ — ο δίσκος: επαναφέρει ΠΑΝΤΑ, byte-για-byte', () => {
  test('Δ1: το `run` βλέπει το ΜΕΤΑΛΛΑΓΜΕΝΟ κείμενο, και στον δίσκο', () => {
    const file = scratchFile('d1.json', CRLF_DOC);
    const seen = withMutation(file, MULTILINE_NEEDLE, '"groupsWithoutCorridor": {\n    "(light)": {',
      (mutated) => {
        expect(fs.readFileSync(file, 'utf8')).toBe(mutated);
        return mutated;
      });
    expect(seen).toContain('"(light)"');
  });

  test('Δ2: αρχείο CRLF επανέρχεται ΑΚΡΙΒΩΣ — καμία σιωπηλή κανονικοποίηση', () => {
    const file = scratchFile('d2.json', CRLF_DOC);
    const before = fs.readFileSync(file);
    withMutation(file, MULTILINE_NEEDLE, 'Ψ', () => undefined);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
  });

  test('Δ3: ακόμη κι όταν το `run` ΠΕΤΑΕΙ, το αρχείο επανέρχεται', () => {
    const file = scratchFile('d3.json', CRLF_DOC);
    const before = fs.readFileSync(file);
    expect(() => withMutation(file, MULTILINE_NEEDLE, 'Ψ', () => { throw new Error('η πύλη έσκασε'); }))
      .toThrow('η πύλη έσκασε');
    expect(fs.readFileSync(file).equals(before)).toBe(true);
  });

  test('Δ4: όταν ο στόχος λείπει, ΤΙΠΟΤΑ δεν γράφεται — η άρνηση προηγείται της γραφής', () => {
    const file = scratchFile('d4.json', CRLF_DOC);
    const before = fs.readFileSync(file);
    expect(() => withMutation(file, 'ανύπαρκτο', 'x', () => undefined)).toThrow(/0 φορές/);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
  });
});

// ═══ Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΟ ΙΔΙΟ ΤΟ ΟΡΓΑΝΟ ═════════════════════════════════════

/**
 * Φόρτωσε **φρέσκο** αντίγραφο του οργάνου, με το αρχείο του μεταλλαγμένο.
 *
 * ⚠️ Η μετάλλαξη εφαρμόζεται με το **ήδη φορτωμένο** `withMutation` (ζει στη μνήμη, δεν το
 * αγγίζει η αλλαγή του αρχείου) — αλλιώς θα ζητούσαμε από τον ασθενή να χειρουργήσει εαυτόν.
 *
 * 🔴 **ΤΟ `jest.resetModules()` ΠΡΙΝ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ, ΚΑΙ ΤΟ ΜΕΤΡΗΣΑ.** Χωρίς αυτό, το
 * `require` μέσα στο `isolateModules` σερβίρει το **αρχικό** module από την κρυφή μνήμη: και οι
 * **τέσσερις** μεταλλάξεις έβγαιναν κόκκινες *(«ο υγιής μεταλλαγμένος»)*, ενώ το αρχείο στον
 * δίσκο **ήταν** μεταλλαγμένο. Το ίδιο ακριβώς είναι γραμμένο ως *«παγίδα 2»* στο
 * `check-firestore-tenant-scope.test.js` — δηλαδή το έργο το είχε ήδη πληρώσει μία φορά.
 *
 * ⚠️ Γι' αυτό ο έλεγχος του δίσκου παρακάτω **δεν αρκεί** ως απόδειξη φόρτωσης: βεβαιώνει ότι
 * ο **δίσκος** άλλαξε, όχι ότι το άλλαξε **η μνήμη**. Την απόδειξη τη δίνει ο υγιής έλεγχος
 * που συνοδεύει κάθε Μ: *«χωρίς τη μετάλλαξη, το ίδιο κάλεσμα συμπεριφέρεται αντίστροφα»*.
 */
function withMutatedMutator(from, to, assertFn) {
  withMutation(MUTATOR, from, to, () => {
    jest.resetModules();
    jest.isolateModules(() => {
      const fresh = require(MUTATOR);
      // Απόδειξη ότι φορτώθηκε το ΜΕΤΑΛΛΑΓΜΕΝΟ, όχι το αρχικό από την κρυφή μνήμη.
      expect(fs.readFileSync(MUTATOR, 'utf8')).toContain(to.slice(0, 40));
      assertFn(fresh);
    });
  });
  jest.resetModules();
}

describe('Μ — μεταλλάξεις: κάθε ιδιότητα του οργάνου ΚΟΚΚΙΝΙΖΕΙ όταν αφαιρεθεί', () => {
  test('Μ1: αν η βελόνα πάψει να δέχεται `\\r` ⇒ το ΑΚΡΙΒΕΣ περιστατικό επιστρέφει («0 φορές»)', () => {
    withMutatedMutator(
      ".replace(/\\n/g, '\\\\r?\\\\n')",
      ".replace(/\\n/g, '\\\\n')",
      (fresh) => {
        expect(() => fresh.mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'Ψ')).toThrow(/0 φορές/);
      },
    );
    // Και ΧΩΡΙΣ τη μετάλλαξη, το ίδιο κάλεσμα περνά — αλλιώς το Μ1 θα ήταν πράσινο για λάθος λόγο.
    expect(mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'Ψ')).toContain('Ψ');
  });

  test('Μ2: αν φύγει ο φρουρός ασάφειας ⇒ ΑΣΑΦΗΣ στόχος περνά ΣΙΩΠΗΛΑ χτυπώντας την 1η', () => {
    withMutatedMutator(
      'if (!all && hits.length > 1 && occurrence === 1) {',
      'if (false && hits.length > 1 && occurrence === 1) {',
      (fresh) => {
        expect(fresh.mutateText('Χ|Χ', 'Χ', 'Ψ')).toBe('Ψ|Χ');
      },
    );
    expect(() => mutateText('Χ|Χ', 'Χ', 'Ψ')).toThrow(/ΑΣΑΦΗΣ/);
  });

  test('Μ3: αν φύγει η ευθυγράμμιση ⇒ η θεραπεία γεννά ΑΝΑΜΕΙΚΤΟ αρχείο', () => {
    withMutatedMutator(
      "? (matchedText.includes('\\r\\n') ? '\\r\\n' : '\\n')",
      "? '\\n'",
      (fresh) => {
        const after = fresh.mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'πρώτη\nδεύτερη');
        expect(after).toContain('πρώτη\nδεύτερη');
        expect(after).not.toContain('πρώτη\r\nδεύτερη');
      },
    );
    expect(mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'πρώτη\nδεύτερη')).toContain('πρώτη\r\nδεύτερη');
  });

  test('Μ4: αν φύγει η επαναφορά ⇒ το αρχείο μένει ΜΕΤΑΛΛΑΓΜΕΝΟ στο δέντρο', () => {
    // 🔴 Το τίμημα αυτής της απώλειας δεν είναι «χαλασμένο τοπικό αντίγραφο»: το δέντρο
    // μοιράζεται με πράκτορα που κάνει commit ⇒ μετάλλαξη δοκιμής φεύγει στην παραγωγή.
    const victim = scratchFile('m4.json', CRLF_DOC);
    withMutatedMutator(
      'fs.writeFileSync(file, originalBytes);',
      '/* μεταλλαγμένο: καμία επαναφορά */',
      (fresh) => {
        fresh.withMutation(victim, MULTILINE_NEEDLE, 'ΛΕΡΩΜΕΝΟ', () => undefined);
        expect(fs.readFileSync(victim, 'utf8')).toContain('ΛΕΡΩΜΕΝΟ');
      },
    );
    // Ο υγιής: το ίδιο κάλεσμα αφήνει το αρχείο καθαρό.
    const clean = scratchFile('m4-clean.json', CRLF_DOC);
    withMutation(clean, MULTILINE_NEEDLE, 'ΛΕΡΩΜΕΝΟ', () => undefined);
    expect(fs.readFileSync(clean, 'utf8')).not.toContain('ΛΕΡΩΜΕΝΟ');
  });

  test('ΜΕΤΑ ΤΙΣ ΜΕΤΑΛΛΑΞΕΙΣ: το ίδιο το όργανο επανήλθε και λειτουργεί', () => {
    expect(mutateText(CRLF_DOC, MULTILINE_NEEDLE, 'Ψ')).toContain('Ψ');
    expect(() => mutateText('Χ|Χ', 'Χ', 'Ψ')).toThrow(/ΑΣΑΦΗΣ/);
  });
});
