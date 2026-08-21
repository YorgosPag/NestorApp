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

// ─── Π: «υπάρχει το κλειδί;» — ΕΝΑ κριτήριο ────────────────────────────────────
//
// 🔴 ΗΤΑΝ ΔΥΟ, ΚΑΙ ΔΙΕΦΕΡΑΝ ΣΤΟ ΚΡΙΤΗΡΙΟ, ΟΧΙ ΣΤΗ ΜΟΡΦΗ. Η πύλη ήταν plural-aware,
// ο γεννήτορας της baseline όχι ⇒ κλειδί ορισμένο μόνο ως `foo_other` μετριόταν
// **υπαρκτό** από τη μία και **λείπον** από την άλλη. Μετρημένη επίπτωση: η baseline
// έπεσε **25/8 → 24/7** μόλις ενοποιήθηκαν. Το βρήκε ο **N.18 (jscpd)**, όχι σκέψη:
// οι δύο υλοποιήσεις έμοιαζαν αρκετά ώστε ένας άνθρωπος να τις προσπεράσει.

describe('Π — plural-aware, σε ΜΙΑ θέση', () => {
  const { keyExists, I18NEXT_PLURAL_SUFFIXES } = require('../lib/i18n-missing-keys-ratchet');

  it('Π1 — κλειδί ορισμένο ΜΟΝΟ ως πληθυντικός CLDR μετράει υπαρκτό', () => {
    expect(keyExists({ items_other: 'x' }, 'items')).toBe(true);
    expect(keyExists({ items_one: 'x' }, 'items')).toBe(true);
  });

  it('Π2 — και ο παρονομαστής: ανύπαρκτο παραμένει ανύπαρκτο', () => {
    expect(keyExists({ items_other: 'x' }, 'other')).toBe(false);
    expect(keyExists({}, 'items')).toBe(false);
  });

  it('Π3 — εμφωλευμένη διαδρομή, με τον πληθυντικό στο ΤΕΛΕΥΤΑΙΟ τμήμα', () => {
    expect(keyExists({ a: { b: { c_other: 'x' } } }, 'a.b.c')).toBe(true);
    expect(keyExists({ a: { b: 'leaf' } }, 'a.b.c')).toBe(false);
  });

  // ⚠️ Ο ΠΡΑΓΜΑΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: το `MissingFontBanner.tsx` έφυγε από τη baseline
  // ακριβώς επειδή το κλειδί του ζει σε πληθυντική μορφή. Αν χαθεί η plural
  // επίγνωση, το αρχείο ξαναεμφανίζεται — και ο αριθμός ξαναγίνεται 25.
  // 🔑 Ο ΙΣΧΥΡΟΤΕΡΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ — ΠΡΑΓΜΑΤΙΚΟ locale, όχι fixture. Χωρίς αυτό, το
  // Π1 θα μπορούσε να είναι πράσινο επειδή το `keyExists` λέει «ναι» σε οτιδήποτε.
  // Εδώ το ΣΚΕΤΟ κλειδί όντως ΔΕΝ υπάρχει στο δέντρο, και **μόνο** ο πληθυντικός το
  // κάνει υπαρκτό — δηλαδή αυτή είναι η ίδια η θεραπεία του 25/8 → 24/7.
  it('Π5 — ο μάρτυρας: `textFonts.missingBanner.title` υπάρχει ΜΟΝΟ ως πληθυντικός', () => {
    const locale = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'i18n', 'locales', 'el', 'textFonts.json'), 'utf8'));
    expect(locale.missingBanner.title).toBeUndefined();
    expect(locale.missingBanner.title_other).toBeDefined();
    expect(keyExists(locale, 'missingBanner.title')).toBe(true);
  });

  it('Π6 — η λίστα καλύπτει όλες τις κατηγορίες CLDR που εκπέμπει το i18next', () => {
    for (const sfx of ['_zero', '_one', '_two', '_few', '_many', '_other']) {
      expect(I18NEXT_PLURAL_SUFFIXES).toContain(sfx);
    }
  });

  it('Π4 — το αρχείο που θεράπευσε η ενοποίηση ΔΕΝ είναι στη baseline', () => {
    const b = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', '..', '.i18n-missing-keys-baseline.json'), 'utf8'));
    expect(b.files['src/subapps/dxf-viewer/ui/text-toolbar/MissingFontBanner.tsx']).toBeUndefined();
    expect(b._meta.totalViolations).toBe(24);
  });
});

describe('Β — ΜΙΑ μηχανή μετράει, όχι δύο', () => {
  const REPO = path.join(__dirname, '..', '..');
  const { collectMissingKeys } = require('../lib/i18n-missing-keys-ratchet');
  const L = require('../lib/i18n-namespace-extract');

  const keyExists = (obj, dotted) => {
    let cur = obj;
    for (const part of String(dotted).split('.')) {
      if (!cur || typeof cur !== 'object' || !(part in cur)) return false;
      cur = cur[part];
    }
    return true;
  };
  const deps = (localeMap) => ({
    bundles: new Map(),
    compat: new Map([['parent', ['child']]]),
    loadLocale: (ns) => localeMap[ns] || null,
    extractNamespaces: L.extractNamespaces,
    extractTCalls: L.extractTCalls,
    extractExplicitTCalls: L.extractExplicitTCalls,
    withCompatNamespaces: L.withCompatNamespaces,
    keyExists,
  });

  // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΓΡΑΨΕ Η ΜΕΤΑΛΛΑΞΗ Μ6. Η πρώτη εκδοχή έκρινε το **κείμενο** του
  // γεννήτορα («αναφέρει `withCompatNamespaces`;») και έμεινε ΠΡΑΣΙΝΗ όταν η
  // μετάλλαξη έσβησε τη **χρήση** κρατώντας την εισαγωγή. Πλέον κρίνεται η
  // συμπεριφορά: κλειδί που ζει ΜΟΝΟ στο compat namespace ΔΕΝ είναι παραβίαση.
  it('Β1 — το compat namespace λύνει, αλλιώς η baseline φουσκώνει σιωπηλά', () => {
    const src = "useTranslation('parent'); t('lives.in.child');";
    const out = collectMissingKeys(src, deps({ parent: {}, child: { lives: { in: { child: 'ok' } } } }));
    expect(out.missingKeys).toEqual([]);
  });

  // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς αυτό, το Β1 θα ήταν πράσινο ακόμα κι αν ο σαρωτής
  // δεν έβλεπε ΚΑΜΙΑ κλήση — «μηδέν παραβιάσεις» επειδή μηδέν μετρήθηκαν.
  it('Β2 — και το ίδιο κλειδί ΧΩΡΙΣ το compat locale ΕΙΝΑΙ παραβίαση', () => {
    const src = "useTranslation('parent'); t('lives.in.child');";
    const out = collectMissingKeys(src, deps({ parent: {}, child: {} }));
    expect(out.missingKeys.map(k => k.key)).toEqual(['lives.in.child']);
    expect(out.missingKeys[0].bucket).toBe('bare');
  });

  it('Β3 — το ρητό κρίνεται ΜΟΝΟ στο namespace που ονομάζει, ποτέ στο compat', () => {
    const src = "useTranslation('parent'); t('parent:only.in.child');";
    const out = collectMissingKeys(src, deps({ parent: {}, child: { only: { in: { child: 'x' } } } }));
    expect(out.missingKeys.map(k => k.key)).toEqual(['parent:only.in.child']);
    expect(out.missingKeys[0].bucket).toBe('explicit');
  });

  it('Β4 — αρχείο χωρίς δηλωμένο namespace δεν κρίνεται καθόλου', () => {
    expect(collectMissingKeys("t('x.y');", deps({}))).toBeNull();
  });

  it('Β5 — η baseline είναι σε σχήμα δύο κάδων', () => {
    const b = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-missing-keys-baseline.json'), 'utf8'));
    const entries = Object.values(b.files);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(typeof e.bare).toBe('number');
      expect(typeof e.explicit).toBe('number');
    }
  });

  // 🔑 ΔΟΜΙΚΗ ΑΓΚΥΡΑ: αν κάποιος ξαναγράψει τοπικό αντίγραφο μέτρησης, η μηχανή
  // ξαναγίνεται δύο — και η baseline ξαναγίνεται «άλλη μηχανή» (ADR-749).
  it('Β6 — και οι ΔΥΟ καταναλωτές καλούν την ίδια collectMissingKeys', () => {
    for (const f of ['check-i18n-missing-keys.js', 'generate-i18n-keys-baseline.js']) {
      const src = fs.readFileSync(path.join(REPO, 'scripts', f), 'utf8');
      expect(src).toMatch(/collectMissingKeys\(content, DEPS\)/);
      expect(src).not.toMatch(/function\s+extractTCalls\s*\(/);
    }
  });
});

