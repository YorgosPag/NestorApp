/**
 * Άγκυρες της CHECK 3.79 — Η ΠΥΛΗ ΤΟΥ ΣΚΙΑΣΜΕΝΟΥ ΑΡΧΕΙΟΥ (ADR-858).
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΥΠΙΚΟΤΗΤΑ.**
 *
 * Η πύλη στηρίζεται σε **μία υπόθεση για τον κόσμο**: ότι το webpack του Next.js λύνει
 * `.tsx` **πριν** `.ts`. Αν αυτή η σειρά γραφτεί λάθος — ακριβώς όπως ήταν γραμμένη στο
 * `.dependency-cruiser.cjs` μέχρι τις 2026-09-12 — η πύλη δεν σπάει θορυβωδώς: **δείχνει
 * λάθος νικητή** και η αναφορά της γίνεται παραπλανητική, ενώ μένει πράσινη.
 *
 * Γι' αυτό το Group 1 **δεν** ελέγχει «τρέχει το script;» — καρφώνει τη **σημασιολογία**.
 *
 * Και το Group 4 **εκτελεί** την πύλη πάνω στο πραγματικό δέντρο: μια πύλη που δεν
 * αποδεικνύει ότι μπορεί να κοκκινίσει είναι σχόλιο, όχι πύλη (ADR-587 §6.1).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const gate = require('../check-shadowed-modules');

describe('CHECK 3.79 — Group 1: η σειρά επίλυσης είναι ΤΟΥ NEXT.JS, όχι γνώμη', () => {
  test('.tsx κερδίζει το .ts — η ΑΚΡΙΒΩΣ υπόθεση που κατέρρευσε στην παραγωγή', () => {
    expect(gate.winnerOf(['/x/index.ts', '/x/index.tsx'])).toBe('/x/index.tsx');
    expect(gate.winnerOf(['/x/index.tsx', '/x/index.ts'])).toBe('/x/index.tsx');
  });

  test('.js κερδίζει τα πάντα, .json χάνει από τον κώδικα', () => {
    expect(gate.winnerOf(['/x/a.tsx', '/x/a.js'])).toBe('/x/a.js');
    expect(gate.winnerOf(['/x/a.json', '/x/a.ts'])).toBe('/x/a.ts');
  });

  test('η σειρά ταυτίζεται με αυτήν που δηλώνει το .dependency-cruiser.cjs', () => {
    // Αν οι δύο αποκλίνουν, η μία από τις δύο πύλες αναλύει γράφο που ΔΕΝ εκτελείται.
    const cfg = fs.readFileSync(
      path.join(__dirname, '..', '..', '.dependency-cruiser.cjs'),
      'utf8',
    );
    const declared = cfg.match(/extensions:\s*\[([^\]]+)\]/);
    expect(declared).not.toBeNull();
    const parsed = declared[1].match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''));
    expect(parsed).toEqual(gate.RESOLVE_ORDER);
  });

  test('άγνωστη επέκταση πάει στο τέλος (η σύγκριση πρέπει να είναι ολική)', () => {
    expect(gate.rankOf('/x/a.weird')).toBe(gate.RESOLVE_ORDER.length);
    expect(gate.rankOf('/x/a.tsx')).toBeLessThan(gate.rankOf('/x/a.ts'));
  });
});

describe('CHECK 3.79 — Group 2: η ταυτότητα είναι σταθερή', () => {
  const v = {
    rule: 'directory-shadow',
    specifier: 'src/x/foo',
    winner: 'src/x/foo.tsx',
    shadowed: ['src/x/foo/index.ts'],
  };

  test('ίδια παραβίαση ⇒ ίδια ταυτότητα, ανεξάρτητα από σειρά των shadowed', () => {
    const a = gate.identityOf({ ...v, shadowed: ['b', 'a'] });
    const b = gate.identityOf({ ...v, shadowed: ['a', 'b'] });
    expect(a).toBe(b);
  });

  test('αλλαγή κανόνα ή specifier ⇒ ΑΛΛΗ ταυτότητα (αλλιώς η ανταλλαγή περνά)', () => {
    expect(gate.identityOf(v)).not.toBe(gate.identityOf({ ...v, rule: 'extension-shadow' }));
    expect(gate.identityOf(v)).not.toBe(gate.identityOf({ ...v, specifier: 'src/x/bar' }));
  });
});

describe('CHECK 3.79 — Group 3: η baseline δεν κρύβει ΠΟΤΕ Κ1', () => {
  test('κανένα extension-shadow μέσα στη baseline', () => {
    if (!fs.existsSync(gate.BASELINE)) return; // δεν έχει σπαρθεί ακόμη — νόμιμο
    const raw = JSON.parse(fs.readFileSync(gate.BASELINE, 'utf8'));
    const k1 = raw.violations.filter((v) => v.rule === 'extension-shadow');
    expect(k1).toEqual([]);
  });
});

describe('CHECK 3.79 — Group 4: η πύλη ΕΚΤΕΛΕΙΤΑΙ στο πραγματικό δέντρο', () => {
  // Μία σάρωση, μοιρασμένη: το `measure()` διαβάζει ~16.800 αρχεία.
  let result;
  beforeAll(() => { result = gate.measure(); }, 120000);

  test('σαρώνει πραγματικά αρχεία (όχι κενό σύνολο = «κανείς δεν κοίταξε»)', () => {
    expect(result.scanned).toBeGreaterThan(1000);
  });

  test('ΜΗΔΕΝ extension-shadow — το περιστατικό της 2026-09-12 έμεινε λυμένο', () => {
    const k1 = result.violations.filter((v) => v.rule === 'extension-shadow');
    expect(k1.map((v) => v.specifier)).toEqual([]);
  });

  test('κάθε παραβίαση δηλώνει νικητή ΚΑΙ τουλάχιστον ένα αόρατο αρχείο', () => {
    for (const v of result.violations) {
      expect(v.winner).toBeTruthy();
      expect(v.shadowed.length).toBeGreaterThan(0);
      expect(v.shadowed).not.toContain(v.winner);
    }
  });

  test('κάθε τρέχουσα παραβίαση είναι γνωστή στη baseline (αλλιώς το δέντρο χάλασε)', () => {
    const known = gate.loadBaseline();
    const unknown = result.violations.filter((v) => !known.has(gate.identityOf(v)));
    expect(unknown.map((v) => v.specifier)).toEqual([]);
  });
});
