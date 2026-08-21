/**
 * CHECK 3.8 — η κρίση του ratchet, κατά κάδο (ADR-777 §8.41).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Μέχρι τις 2026-08-21 η CHECK 3.8 **δεν είχε
 * καμία άγκυρα** — ούτε μία. Ήταν πύλη που μπλοκάρει commits, με κριτήριο που
 * κανείς δεν εκτελούσε σε δοκιμή, και baseline γραμμένη από **άλλη μηχανή**
 * (ο γεννήτορας δεν εφάρμοζε `withCompatNamespaces` και είχε δικό του
 * `extractTCalls`): μετρημένη απόκλιση **114 έναντι 6** στο ίδιο δέντρο.
 */
const path = require('node:path');
const fs = require('node:fs');
const { judgeAgainstBaseline } = require('../lib/i18n-missing-keys-ratchet');

const bare = (n) => Array.from({ length: n }, (_, i) => ({ key: `b${i}`, line: i, bucket: 'bare' }));
const explicit = (n) => Array.from({ length: n }, (_, i) => ({ key: `ns:e${i}`, line: i, bucket: 'explicit' }));

describe('Κ — το ratchet κρίνει ΑΝΑ ΚΑΔΟ', () => {
  it('Κ1 — μέσα στα όρια και στους δύο κάδους ⇒ περνά', () => {
    const v = judgeAgainstBaseline([...bare(2), ...explicit(3)], { bare: 2, explicit: 3 });
    expect(v.blocked).toBe(false);
    expect(v.overflow).toEqual([]);
  });

  // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΤΟΥΣ ΔΥΟ ΚΑΔΟΥΣ: το ΣΥΝΟΛΟ δεν κουνιέται.
  // Με έναν αριθμό αυτό θα περνούσε — και το ρητό θα ξαναγινόταν αόρατο.
  it('Κ2 — ΑΝΤΑΛΛΑΓΗ (−1 σκέτο, +1 ρητό, ίδιο σύνολο) ⇒ ΜΠΛΟΚΑΡΕΙ', () => {
    const v = judgeAgainstBaseline([...bare(4), ...explicit(1)], { bare: 5, explicit: 0 });
    expect(v.blocked).toBe(true);
    expect(v.overflow.map(k => k.key)).toEqual(['ns:e0']);
  });

  it('Κ3 — πρόοδος στον έναν κάδο ΔΕΝ πληρώνει παλινδρόμηση στον άλλο', () => {
    const v = judgeAgainstBaseline([...bare(0), ...explicit(4)], { bare: 5, explicit: 3 });
    expect(v.blocked).toBe(true);
  });

  // ⚠️ Το overflow ονομάζει ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΠΑΡΑΒΑΤΗ. Το παλιό `slice(-newCount)`
  // έδειχνε «οποιοδήποτε τελευταίο», δηλαδή μπορούσε να στείλει τον αναγνώστη σε
  // κλειδί που δεν έφταιγε — και μια αναφορά που δείχνει λάθος γραμμή κοστίζει
  // ακριβώς όσο μια πύλη που δεν μιλά.
  it('Κ4 — το overflow ονομάζει τα κλειδιά ΤΟΥ κάδου που παλινδρόμησε', () => {
    const v = judgeAgainstBaseline([...bare(7), ...explicit(1)], { bare: 5, explicit: 1 });
    expect(v.overflow.map(k => k.key)).toEqual(['b5', 'b6']);
  });

  it('Κ5 — νέο αρχείο (καμία εγγραφή) ⇒ μηδενική ανοχή και στους δύο', () => {
    expect(judgeAgainstBaseline(explicit(1), 0).blocked).toBe(true);
    expect(judgeAgainstBaseline(bare(1), 0).blocked).toBe(true);
    expect(judgeAgainstBaseline([], 0).blocked).toBe(false);
  });

  // 🔴 ΤΟ ΠΑΛΙΟ ΣΧΗΜΑ ΔΕΝ ΔΙΝΕΙ ΣΙΩΠΗΛΗ ΑΔΕΙΑ ΣΤΑ ΡΗΤΑ. Μια μπαγιάτικη baseline
  // μετρήθηκε ΠΡΙΝ υπάρξει η έννοια «ρητό» — άρα δεν έχει γνώμη γι' αυτά, και
  // «καμία γνώμη» σημαίνει **μηδέν**, ποτέ «ό,τι θέλεις».
  it('Κ6 — παλιό σχήμα: ο αριθμός αφορά ΜΟΝΟ τα σκέτα', () => {
    expect(judgeAgainstBaseline(bare(5), 5).blocked).toBe(false);
    expect(judgeAgainstBaseline([...bare(5), ...explicit(1)], 5).blocked).toBe(true);
  });
});

describe('Β — η baseline είναι γραμμένη στη ΔΙΑΛΕΚΤΟ ΤΗΣ ΠΥΛΗΣ', () => {
  const REPO = path.join(__dirname, '..', '..');

  // ⚠️ Ο γεννήτορας ΚΑΙ η πύλη οφείλουν να διαβάζουν το ίδιο SSoT. Αν ξαναγραφτεί
  // τοπικό αντίγραφο εξαγωγής, η baseline ξαναγίνεται «άλλη μηχανή» — και το
  // ratchet ξανασυγκρίνει `τρέχον(Α)` με `baseline(Β)`.
  it('Β1 — ο γεννήτορας ΔΕΝ έχει δικό του extractTCalls', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'generate-i18n-keys-baseline.js'), 'utf8');
    expect(src).not.toMatch(/function\s+extractTCalls\s*\(/);
    expect(src).toMatch(/withCompatNamespaces/);
    expect(src).toMatch(/extractExplicitTCalls/);
  });

  it('Β2 — η baseline είναι σε σχήμα δύο κάδων', () => {
    const b = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-missing-keys-baseline.json'), 'utf8'));
    const entries = Object.values(b.files);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(typeof e).toBe('object');
      expect(typeof e.bare).toBe('number');
      expect(typeof e.explicit).toBe('number');
    }
  });
});
