/**
 * ADR-759 §4.12.3 — Οι τέσσερις παλινδρομήσεις της συνεδρίας «(γ)».
 *
 * ΤΙ ΑΓΚΥΡΩΝΕΙ ΚΑΙ ΓΙΑΤΙ (όλα μετρημένα 2026-08-07, κανένα υποθετικό):
 *
 *   Ο1 — ΜΕΛΑΝΙ vs ΕΠΙΦΑΝΕΙΑ. Το `--primary` στο προεπιλεγμένο (σκοτεινό) θέμα
 *        λύνεται σε `217 33% 17%` — ΤΑΥΤΟΣΗΜΟ με το `--card`. Άρα το `text-primary`
 *        εκεί δίνει 1,00:1 (αόρατο) και αποτυγχάνει σε **23/23** επιφάνειες.
 *        Ο κατάλογος κουμπιών `BUTTON_STYLES` το χρησιμοποιούσε ως μελάνι σε 4
 *        θέσεις, δίπλα σε 3 σωστές που ήδη χρησιμοποιούσαν token *σκοπού*.
 *
 *   Ο2 — ΚΟΛΛΗΜΕΝΕΣ ΚΛΑΣΕΙΣ. `"text-primaryflex items-center"` είναι έγκυρη
 *        συμβολοσειρά που δεν αντιστοιχεί σε ΚΑΜΙΑ utility: χάνονται και το χρώμα
 *        και το `flex` (άρα και τα `items-center`/`gap-2` που το προϋποθέτουν).
 *        Καμία υπάρχουσα πύλη δεν το πιάνει — ούτε ο μεταγλωττιστής, ούτε ο
 *        Tailwind, ούτε το ESLint. Βρέθηκαν **3** εμφανίσεις, όλες στο ίδιο αρχείο.
 *
 *   Ο3 — ΧΡΩΜΑ ΑΠΟ ΣΧΟΛΙΟ. 7 από τα 27 hex σχόλια του `globals.css` ήταν λάθος
 *        (26%), δύο από αυτά ΑΝΤΑΛΛΑΓΜΕΝΑ μεταξύ τους. Ένα από αυτά διαβάστηκε ως
 *        γεγονός κατά τη διάρκεια συλλογισμού για αντίθεση.
 *
 *   Ο4 — INLINE STYLE ΠΟΥ ΝΙΚΑΕΙ TOKEN. Το `<h3>` της «Αυτόματης αποθήκευσης»
 *        είχε ΣΩΣΤΗ σημασιολογική κλάση και inline `color` από στατική παλέτα
 *        φωτεινού θέματος. Η ειδικότητα κερδίζει ⇒ 1,01:1 στη ζωντανή σελίδα.
 *        Ένα αντικείμενο token σε JS δεν μπορεί να ακολουθήσει το `.dark`.
 *
 * ΔΕΝ είναι ratchet — καμία baseline, ποτέ. Και τα τέσσερα είναι στο μηδέν.
 * ΔΕΝ αντικαθιστά την πύλη αντίθεσης (ADR-769): αυτό αγκυρώνει ό,τι ΔΙΟΡΘΩΘΗΚΕ.
 */

const fs = require('fs');
const path = require('path');

const { parseHslToken, hslToRgb, toHex } = require('../lib/contrast/wcag-contrast');
const { findGluedClasses } = require('../lib/contrast/glued-class');

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const BUTTON_CONFIG = 'src/components/ui/form/action-button-config.ts';
const TOOLBAR_BUTTONS = 'src/components/ui/form/ToolbarButtons.tsx';
const GLOBALS_CSS = 'src/app/globals.css';
const AUTOSAVE_TSX = 'src/subapps/dxf-viewer/ui/components/CentralizedAutoSaveStatus.tsx';
const AUTOSAVE_STYLES = 'src/subapps/dxf-viewer/ui/components/CentralizedAutoSaveStatus.styles.ts';

/** Αφαιρεί σχόλια γραμμής/μπλοκ, ώστε η τεκμηρίωση να μη μετράει ως κώδικας. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Όλα τα `.ts`/`.tsx` του `src/`, χωρίς δοκιμές. */
function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ─── Ο1 — μελάνι, όχι επιφάνεια ───────────────────────────────────────────────

describe('Ο1 — ο κατάλογος κουμπιών χρωματίζει με token ΣΚΟΠΟΥ, όχι με επιφάνεια', () => {
  const code = stripComments(read(BUTTON_CONFIG));

  test('κανένα `BUTTON_STYLES` variant δεν χρησιμοποιεί το `text-primary` ως μελάνι', () => {
    // `text-primary-foreground` είναι ΑΛΛΟ token (σχεδόν λευκό) — δεν το πιάνουμε.
    const offenders = code
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => /\btext-primary\b(?!-)/.test(line));

    expect(offenders.map((o) => `${BUTTON_CONFIG}:${o.n}`)).toEqual([]);
  });

  test('κάθε utility variant φέρει token σκοπού `--text-*`', () => {
    const utilityLines = code
      .split('\n')
      .filter((line) => /BUTTON_CATEGORIES\.utility\}\s/.test(line));

    expect(utilityLines.length).toBeGreaterThanOrEqual(8);
    for (const line of utilityLines) {
      expect(line).toMatch(/text-\[hsl\(var\(--text-(success|warning|info|error)\)\)\]/);
    }
  });

  test('το `refresh` υπάρχει στον κατάλογο (το κενό του ήταν η αιτία του Ο2)', () => {
    expect(code).toMatch(/\brefresh:\s*`\$\{BUTTON_CATEGORIES\.utility\}/);
  });

  test('το `ToolbarButtons` δεν συνθέτει πια χειρόγραφα utility+χρώμα', () => {
    const toolbar = stripComments(read(TOOLBAR_BUTTONS));
    expect(toolbar).not.toMatch(/BUTTON_CATEGORIES\.utility,\s*"text-/);
  });
});

// ─── Ο2 — κολλημένες κλάσεις ──────────────────────────────────────────────────

describe('Ο2 — καμία κολλημένη utility σε ΟΛΟ το src/', () => {
  const files = collectSourceFiles(path.join(REPO_ROOT, 'src'));

  test('το δέντρο πηγής είναι μη κενό (αλλιώς το test θα ήταν ψευδώς πράσινο)', () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  // ⚠️ Τα σχήματα ΔΕΝ ζουν εδώ. Ζούσαν — και αυτό ήταν ακριβώς το πρόβλημα:
  // ο σαρωτής `text-primary-sites.js` έβλεπε μόνο τη μορφή `text-primary<λέξη>`,
  // αυτό το test μόνο τη δική του εκδοχή, και η μορφή `)]<λέξη>` (2 από τις 3
  // πραγματικές εμφανίσεις) περνούσε ανάμεσά τους. Πλέον ΕΝΑ module (ADR-770,
  // `scripts/lib/contrast/glued-class.js`) και δύο καταναλωτές: αυτό και η πύλη
  // CHECK 3.38. Οι μεταλλάξεις των σχημάτων ζουν στη σουίτα της πύλης.
  test('κανένα `)][a-z]` και κανένα `text-<όνομα><utility>`', () => {
    const offenders = [];
    for (const full of files) {
      const hits = findGluedClasses(fs.readFileSync(full, 'utf8'));
      const rel = path.relative(REPO_ROOT, full).replace(/\\/g, '/');
      for (const h of hits) offenders.push(`${rel}:${h.line} [${h.rule}]`);
    }
    expect(offenders).toEqual([]);
  });
});

// ─── Ο3 — μη διαβάζεις χρώμα από σχόλιο ───────────────────────────────────────

describe('Ο3 — κάθε hex σχόλιο του globals.css συμφωνεί με το HSL του', () => {
  const TOKEN_WITH_HEX_COMMENT =
    /(--[a-z0-9-]+)\s*:\s*([0-9.]+\s+[0-9.]+%\s+[0-9.]+%)\s*;\s*\/\*([^*]*)\*\//i;

  const rows = read(GLOBALS_CSS)
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .map(({ line, n }) => {
      const m = TOKEN_WITH_HEX_COMMENT.exec(line);
      if (!m) return null;
      const claimed = /#([0-9a-f]{6})\b/i.exec(m[3]);
      const parsed = parseHslToken(m[2]);
      if (!claimed || !parsed) return null;
      return { n, token: m[1], claimed: `#${claimed[1].toLowerCase()}`, real: toHex(hslToRgb(parsed)).toLowerCase() };
    })
    .filter(Boolean);

  test('υπάρχουν σχόλια προς έλεγχο (αλλιώς το test δεν κοιτάζει τίποτα)', () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  test('κανένα σχόλιο δεν λέει άλλο χρώμα από το token του', () => {
    const wrong = rows
      .filter((r) => r.claimed !== r.real)
      .map((r) => `${GLOBALS_CSS}:${r.n} ${r.token} λέει ${r.claimed}, είναι ${r.real}`);
    expect(wrong).toEqual([]);
  });

  test('ΜΕΤΑΛΛΑΞΗ — ο έλεγχος όντως συγκρίνει (ιστορικές τιμές)', () => {
    expect(toHex(hslToRgb(parseHslToken('217 33% 17%'))).toLowerCase()).toBe('#1d283a');
    expect(toHex(hslToRgb(parseHslToken('220 20% 11%'))).toLowerCase()).toBe('#161a22');
    // Τα δύο σχόλια συνδέσμων ήταν ανταλλαγμένα μεταξύ τους:
    expect(toHex(hslToRgb(parseHslToken('221 83% 53%'))).toLowerCase()).toBe('#2463eb');
    expect(toHex(hslToRgb(parseHslToken('217 91% 60%'))).toLowerCase()).toBe('#3c83f6');
  });
});

// ─── Ο4 — κανένα inline χρώμα πάνω από σωστό token ────────────────────────────

describe('Ο4 — η «Αυτόματη αποθήκευση» δεν ξαναβάφεται από inline style', () => {
  test('το component δεν εφαρμόζει πια `statusMessage` ως inline style', () => {
    expect(stripComments(read(AUTOSAVE_TSX))).not.toMatch(/style=\{[^}]*statusMessage/);
  });

  test('ο κατάλογος στυλ δεν ξαναεκθέτει χρώμα από στατική παλέτα JS', () => {
    expect(stripComments(read(AUTOSAVE_STYLES))).not.toMatch(/statusIndicatorComponents\.text\b/);
  });

  test('η στατική παλέτα ΟΝΤΩΣ κουβαλά χρώμα φωτεινού θέματος (γι᾽ αυτό απαγορεύεται inline)', () => {
    // Αν αυτό αλλάξει, ξανασκέψου τον Ο4 — μην τον σβήσεις σιωπηλά.
    expect(read('src/styles/design-tokens/modules/foundations.ts')).toMatch(/primary:\s*"#1e293b"/);
  });
});
