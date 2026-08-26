/**
 * ΑΓΚΥΡΕΣ — ο provider του θέματος δεν κρύβει την εφαρμογή (ADR-815)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ, ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΤΗ ΔΙΟΡΘΩΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `ThemeProvider` επέστρεφε `<div className="invisible">{children}</div>` μέχρι
 * το πρώτο `useEffect`. Μετρημένο στο SSR HTML τριών διαδρομών: το wrapper ήταν
 * **παρών**, το inline script του `next-themes` **απόν**, το `class="dark"`
 * **απόν**, και η εφαρμογή αόρατη για **459-1655 ms**.
 *
 * 🔑 **Η ΠΥΛΗ ΠΡΟΚΑΛΟΥΣΕ ΤΟ FLASH ΠΟΥ ΕΚΡΥΒΕ**: χωρίς απόδοση του provider στον
 * διακομιστή, το script που βάφει το `<html>` πριν το πρώτο καρέ δεν ταξίδευε
 * ποτέ. Μετά τη διόρθωση, μετρημένο σε **6** συνδυασμούς διαδρομής × θέματος:
 * wrapper **0**, script **παρών**, `firstHtmlClass` = `dark`/`light` **σωστά**,
 * προβλήματα ενυδάτωσης **0**.
 *
 * **Π** — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν όντως καταναλωτές να φυλαχθούν.
 * **Θ** — ο PROVIDER δεν κρύβει.
 * **Κ** — ΚΑΝΕΙΣ καταναλωτής δεν διαβάζει το θέμα ανασφαλώς.
 *
 * ⚠️ ΔΕΝ αποδεικνύουν ότι δεν υπάρχει flash στην οθόνη — αυτό μετρήθηκε ζωντανά
 * (ADR-815 §4) και θέλει browser. Ένα test που ισχυρίζεται και τα δύο θα ήταν
 * πράσινο για λάθος λόγο.
 *
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

const { stripComments } = require('../lib/source-text');

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const PROVIDER = read('src/components/theme-provider.tsx');
const PROVIDER_CODE = stripComments(PROVIDER);
const LAYOUT_CODE = stripComments(read('src/app/layout.tsx'));
const OWNER = 'src/lib/appearance/useHydratedTheme.ts';
const OWNER_CODE = stripComments(read(OWNER));

/**
 * Κάθε αρχείο του `src/` που εισάγει από `next-themes`.
 *
 * ⚠️ **ΠΑΡΑΓΕΤΑΙ, ποτέ χειρόγραφη λίστα**: μια λίστα εδώ θα απέκλινε σιωπηλά
 * μόλις κάποιος πρόσθετε τέταρτο καταναλωτή — το σχήμα που έχει πληρωθεί
 * μετρημένα σε CHECK 3.34 (63) · 3.37 (18 vs 26) · 3.49 (60) · 3.57 (19/20).
 */
function nextThemesConsumers() {
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue;
        walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (/\.test\.|\.spec\./.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (!src.includes('next-themes')) continue;
      hits.push({ rel: path.relative(REPO, p).replace(/\\/g, '/'), code: stripComments(src) });
    }
  };
  walk(path.join(REPO, 'src'));
  return hits;
}

const CONSUMERS = nextThemesConsumers();

// ═══════════════════════════════════════════════════════════════════════════
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Π — ο παρονομαστής', () => {
  test('Π1 — υπάρχουν ΟΝΤΩΣ αρχεία που αγγίζουν το next-themes', () => {
    // Χωρίς αυτό, το «κανείς δεν διαβάζει ανασφαλώς» θα ήταν πράσινο επειδή
    // δεν κοίταξε τίποτα — το σχήμα «0 = κανείς δεν κοίταξε».
    expect(CONSUMERS.length).toBeGreaterThanOrEqual(3);
  });

  test('Π2 — ο ΙΔΙΟΚΤΗΤΗΣ είναι ένας από αυτούς', () => {
    expect(CONSUMERS.map((c) => c.rel)).toContain(OWNER);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Θ — Ο PROVIDER ΔΕΝ ΚΡΥΒΕΙ
// ═══════════════════════════════════════════════════════════════════════════

describe('Θ — ο provider αποδίδει στον διακομιστή', () => {
  test('Θ1 — ΚΑΜΙΑ πύλη `mounted` στον provider', () => {
    // 🔴 Η ΚΡΙΣΙΜΗ ΑΓΚΥΡΑ. Αυτή ακριβώς η πύλη κρατούσε την εφαρμογή αόρατη
    // 459-1655 ms ΚΑΙ εμπόδιζε το script που θα απέτρεπε το flash.
    expect(PROVIDER_CODE).not.toMatch(/useState\s*\(\s*false\s*\)/);
    expect(PROVIDER_CODE).not.toContain('mounted');
  });

  test('Θ2 — ΤΙΠΟΤΑ δεν τυλίγεται σε `invisible`', () => {
    expect(PROVIDER_CODE).not.toContain('invisible');
  });

  test('Θ3 — ο `NextThemesProvider` αποδίδεται ΑΝΕΥ ΟΡΩΝ', () => {
    // Χωρίς αυτό, το inline script δεν μπαίνει στο SSR HTML και το flash
    // επιστρέφει — μαζί με τον πειρασμό να ξαναμπεί το `invisible`.
    expect(PROVIDER_CODE).toContain('<NextThemesProvider {...props}>');
    expect(PROVIDER_CODE).not.toContain('if (');
  });

  test('Θ4 — το `<html>` κρατά `suppressHydrationWarning`', () => {
    // ⚠️ Το script αλλάζει το `class` του `<html>` ΠΡΙΝ την ενυδάτωση· χωρίς
    // αυτή τη σημαία η React φωνάζει σε κάθε φόρτωση, και ο επόμενος θα
    // «διορθώσει» επαναφέροντας την πύλη.
    expect(LAYOUT_CODE).toContain('suppressHydrationWarning');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ — ΚΑΝΕΝΑΣ ΑΝΑΣΦΑΛΗΣ ΚΑΤΑΝΑΛΩΤΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ — η ασφαλής ανάγνωση είναι η ΠΡΟΕΠΙΛΟΓΗ', () => {
  test('Κ1 — ΜΟΝΟ ο ιδιοκτήτης καλεί `useTheme()` του next-themes', () => {
    // Ένα `useTheme()` απευθείας σε component που αποδίδει με βάση το θέμα
    // είναι ασυμφωνία ενυδάτωσης — και ήταν ο λόγος που κάποιος έκρυψε ΟΛΗ
    // την εφαρμογή αντί να διορθώσει τους τρεις καταναλωτές.
    const offenders = CONSUMERS
      .filter((c) => c.rel !== OWNER)
      .filter((c) => /useTheme\s*\(/.test(c.code))
      .map((c) => c.rel);
    expect(offenders).toEqual([]);
  });

  test('Κ2 — ο ιδιοκτήτης δίνει `undefined` πριν την ενυδάτωση', () => {
    // Ο διακομιστής και το ΠΡΩΤΟ render του πελάτη πρέπει να παράγουν
    // ταυτόσημο HTML· ο μόνος τρόπος είναι να μη γνωρίζουν κανένα θέμα.
    expect(OWNER_CODE).toContain('hydrated ? theme : undefined');
    expect(OWNER_CODE).toContain('hydrated ? resolvedTheme : undefined');
  });

  test('Κ3 — ο ιδιοκτήτης ΔΕΝ κρύβει· επιστρέφει τιμή', () => {
    // ⚠️ Αν κάποια στιγμή επιστρέψει `null` ή `<div className="invisible">`,
    // το ελάττωμα απλώς μετακόμισε από τον provider στον ιδιοκτήτη.
    expect(OWNER_CODE).not.toContain('invisible');
    expect(OWNER_CODE).not.toContain('return null');
  });

  test('Κ4 — το `setTheme` ΔΕΝ φυλάσσεται πίσω από την ενυδάτωση', () => {
    // Είναι ενέργεια, όχι απόδοση: δεν μπορεί να προκαλέσει ασυμφωνία, και
    // ένα `undefined` εκεί θα έσπαγε τον επιλογέα χωρίς λόγο.
    expect(OWNER_CODE).toMatch(/setTheme,/);
  });
});
