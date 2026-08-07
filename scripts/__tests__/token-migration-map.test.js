/**
 * ADR-770 §14 — άγκυρες του codemod και του ρητού πίνακα χαρτογράφησης.
 *
 * ΑΡΧΗ: η κάλυψη του πίνακα αποδεικνύεται έναντι του **πραγματικού** δέντρου token, όχι
 * έναντι fixture. Αν κάποιος προσθέσει σημασιολογική δήλωση, το `Χ1` κοκκινίζει και ζητά
 * **απόφαση** — χαρτογράφηση ή δηλωμένος λόγος. Δεν υπάρχει τρίτη επιλογή, και αυτό είναι το
 * νόημα: ένας πίνακας με σιωπηλά κενά είναι εικασία με άλλο όνομα.
 */

'use strict';

const path = require('path');
const { readTokenPalette, semanticEntries } = require('../lib/contrast/ts-token-palette');
const { readThemes, surfaceTokens, foregroundTokens } = require('../lib/contrast/css-token-themes');
const { hslToRgb, contrastRatio } = require('../lib/contrast/wcag-contrast');
const { hexToRgb } = require('../lib/contrast/theme-pairing');
const { TOKEN_MAP, NO_TARGET, themedValue } = require('../lib/contrast/token-migration-map');

const REPO = path.resolve(__dirname, '..', '..');
const palette = readTokenPalette(REPO);
const themes = readThemes(REPO);
const semantic = semanticEntries(palette);

const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const allLightTokens = () =>
  [...themes.light]
    .map(([name, v]) => {
      const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(v);
      return m ? { name, rgb: hslToRgb({ h: +m[1], s: +m[2] / 100, l: +m[3] / 100 }) } : null;
    })
    .filter(Boolean);

// ════════════════════════════════════════════════════════════════════════════
describe('Χ1 — ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ: κάθε σημασιολογική δήλωση έχει απόφαση', () => {
  test('Χ1.1 καμία δήλωση δεν είναι εκτός πίνακα — ούτε χαρτογραφημένη, ούτε δηλωμένη', () => {
    const undecided = semantic
      .map((e) => e.path)
      .filter((p) => !(p in TOKEN_MAP) && !(p in NO_TARGET));
    expect(undecided).toEqual([]);
  });

  test('Χ1.2 καμία δήλωση δεν είναι ΚΑΙ χαρτογραφημένη ΚΑΙ δηλωμένη ως χωρίς στόχο', () => {
    const both = Object.keys(TOKEN_MAP).filter((p) => p in NO_TARGET);
    expect(both).toEqual([]);
  });

  test('Χ1.3 ο πίνακας δεν περιέχει νεκρές εγγραφές (μονοπάτια που δεν υπάρχουν)', () => {
    const real = new Set(semantic.map((e) => e.path));
    const dead = [...Object.keys(TOKEN_MAP), ...Object.keys(NO_TARGET)].filter((p) => !real.has(p));
    expect(dead).toEqual([]);
  });

  test('Χ1.4 κάθε λόγος «χωρίς στόχο» είναι ουσιαστικός, όχι κενό αλφάβητο', () => {
    for (const [p, reason] of Object.entries(NO_TARGET)) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(5);
      expect(p).toBeTruthy();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Χ2 — κάθε στόχος ΥΠΑΡΧΕΙ και είναι ΘΕΜΑΤΙΚΟΣ', () => {
  const tokenValue = (name, theme) => themes[theme].get(name);

  test.each(Object.entries(TOKEN_MAP))('Χ2 %s → %s ορίζεται και στα δύο θέματα', (declPath, token) => {
    expect(tokenValue(token, 'light')).toBeTruthy();
    expect(tokenValue(token, 'dark')).toBeTruthy();
  });

  test('Χ2.1 τουλάχιστον οι στόχοι κειμένου ΑΛΛΑΖΟΥΝ τιμή ανά θέμα — αλλιώς δεν είναι θεραπεία', () => {
    const textTargets = [...new Set(
      Object.entries(TOKEN_MAP)
        .filter(([p]) => p.includes('.text.'))
        .map(([, t]) => t),
    )];
    expect(textTargets.length).toBeGreaterThan(0);
    for (const t of textTargets) {
      expect(themes.light.get(t)).not.toBe(themes.dark.get(t));
    }
  });

  test('Χ2.2 η μορφή εγγραφής είναι ίδια με το ΥΠΑΡΧΟΝ semanticColors του ίδιου αρχείου', () => {
    expect(themedValue('--foreground')).toBe('hsl(var(--foreground))');
    const existing = palette.entries.find(
      (e) => e.form === 'css-var' && /^semanticColors\./.test(e.path),
    );
    expect(existing).toBeDefined();
    expect(existing.raw).toMatch(/^hsl\(var\(--[a-z-]+\)\)$/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Χ3 — ΤΑ ΔΥΟ ΑΥΤΟΜΑΤΑ ΚΡΙΤΗΡΙΑ ΑΠΟΡΡΙΦΘΗΚΑΝ ΜΕΤΑ ΑΠΟ ΜΕΤΡΗΣΗ', () => {
  test('Χ3.1 «κοντινότερη τιμή» προτείνει --destructive-foreground για ΛΕΥΚΟ ΦΟΝΤΟ', () => {
    const entry = semantic.find((e) => e.path === 'colors.background.primary');
    expect(entry).toBeDefined();
    const best = allLightTokens()
      .map((t) => ({ ...t, d: dist(hexToRgb(entry.hex), t.rgb) }))
      .sort((a, b) => a.d - b.d)[0];
    // Το κριτήριο δίνει σημασιολογικά παράλογο αποτέλεσμα — ΟΧΙ το --background.
    expect(best.name).not.toBe('--background');
    expect(TOKEN_MAP[entry.path]).toBe('--background'); // ο ΑΝΘΡΩΠΟΣ έχει δίκιο
  });

  test('Χ3.2 «ρόλος + κοντινότερη τιμή» δίνει --input αντί --ring για το border.focus', () => {
    const entry = semantic.find((e) => e.path === 'colors.border.focus');
    const BORDERISH = /^--(border|input|ring|sidebar-border|showcase-border)$/;
    const cands = allLightTokens().filter((t) => BORDERISH.test(t.name));
    const best = cands
      .map((t) => ({ ...t, d: dist(hexToRgb(entry.hex), t.rgb) }))
      .sort((a, b) => a.d - b.d)[0];
    expect(best.name).not.toBe('--ring');
    expect(TOKEN_MAP[entry.path]).toBe('--ring'); // η ΠΡΟΘΕΣΗ, όχι η απόσταση
  });

  test('Χ3.3 η ονομασία κουβαλά σημασία που η τιμή ΔΕΝ κουβαλά — αυτό είναι το συμπέρασμα', () => {
    // Δύο δηλώσεις με ΤΑΥΤΟΣΗΜΟ hex και ΔΙΑΦΟΡΕΤΙΚΟ σωστό στόχο ⇒ καμία μετρική χρώματος
    // δεν μπορεί να τις ξεχωρίσει. Αυτό είναι απόδειξη αδυναμίας, όχι προτίμηση.
    const byHex = new Map();
    for (const e of semantic) {
      if (!byHex.has(e.hex)) byHex.set(e.hex, []);
      byHex.get(e.hex).push(e.path);
    }
    const collisions = [...byHex.entries()]
      .filter(([, paths]) => paths.length > 1)
      .filter(([, paths]) => new Set(paths.map((p) => TOKEN_MAP[p])).size > 1);
    expect(collisions.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Χ4 — Η ΜΕΤΡΙΚΗ ΒΕΛΤΙΩΣΗΣ: γιατί ΟΧΙ το «αποτυγχάνει X/23»', () => {
  const failingAgainstSurfaces = (rgb, theme) => {
    const s = surfaceTokens(themes[theme]);
    return s.filter((x) => contrastRatio(rgb, hslToRgb(x.hsl)) < 4.5).length;
  };

  test('Χ4.1 το --muted-foreground αποτυγχάνει σε >½ των επιφανειών, κι όμως ΕΙΝΑΙ ο σωστός στόχος', () => {
    const mf = foregroundTokens(themes.light).find((t) => t.name === '--muted-foreground');
    const failing = failingAgainstSurfaces(hslToRgb(mf.hsl), 'light');
    const total = surfaceTokens(themes.light).length;
    // Αν η μετρική ήταν «αποτυγχάνει X/N», η σωστή μετανάστευση θα βαθμολογούνταν ΑΠΟΤΥΧΙΑ.
    expect(failing).toBeGreaterThan(total / 2);
    expect(TOKEN_MAP['colors.text.secondary']).toBe('--muted-foreground');
  });

  test('Χ4.2 το κριτήριο που κρατήθηκε είναι η ΘΕΜΑΤΙΚΗ ΑΠΟΚΛΙΣΗ, και είναι μη-μηδενική πριν', () => {
    const entry = semantic.find((e) => e.path === 'colors.text.primary');
    const rgb = hexToRgb(entry.hex);
    const l = failingAgainstSurfaces(rgb, 'light');
    const d = failingAgainstSurfaces(rgb, 'dark');
    expect(Math.abs(l - d)).toBeGreaterThan(0); // υπάρχει θεματικό σφάλμα να λυθεί
    expect(d).toBe(surfaceTokens(themes.dark).length); // αόρατο σε ΟΛΕΣ στο σκοτεινό
  });

  test('Χ4.3 μετά τη μετανάστευση, η θεματική απόκλιση είναι 0 ΕΞ ΟΡΙΣΜΟΥ', () => {
    // Ένα θεματικό token έχει διαφορετική τιμή ανά θέμα, οπότε κρίνεται σωστά εκατέρωθεν.
    const fg = {
      light: foregroundTokens(themes.light).find((t) => t.name === '--foreground'),
      dark: foregroundTokens(themes.dark).find((t) => t.name === '--foreground'),
    };
    expect(fg.light.value).not.toBe(fg.dark.value);
    expect(failingAgainstSurfaces(hslToRgb(fg.dark.hsl), 'dark')).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Χ5 — τα ευρήματα του πίνακα, ως μετρημένα γεγονότα', () => {
  test('Χ5.1 τα 6 borderColors.*.dark είναι αόρατα σε ΟΛΕΣ τις σκοτεινές επιφάνειες', () => {
    const darks = semantic.filter((e) => /^borderColors\.[a-z]+\.dark$/.test(e.path));
    expect(darks.length).toBe(6);
    const surfaces = surfaceTokens(themes.dark);
    for (const e of darks) {
      const failing = surfaces.filter(
        (s) => contrastRatio(hexToRgb(e.hex), hslToRgb(s.hsl)) < 3.0,
      ).length;
      expect(failing).toBe(surfaces.length);
    }
  });

  test('Χ5.2 τα δύο σκέλη {light,dark} καταλήγουν στο ΙΔΙΟ token — το token ΕΙΝΑΙ το ζεύγος', () => {
    expect(TOKEN_MAP['borderColors.default.light']).toBe(TOKEN_MAP['borderColors.default.dark']);
    expect(TOKEN_MAP['borderColors.muted.light']).toBe(TOKEN_MAP['borderColors.muted.dark']);
  });

  test('Χ5.3 η κλίμακα σοβαρότητας έχει ΠΕΝΤΕ βαθμίδες, το CSS τέσσερα σημασιολογικά χρώματα', () => {
    const severities = new Set(
      semantic
        .map((e) => /^colors\.severity\.([a-z]+)\./.exec(e.path))
        .filter(Boolean)
        .map((m) => m[1]),
    );
    expect(severities.size).toBe(5);
    expect(NO_TARGET['colors.severity.high.background']).toMatch(/πορτοκαλί/);
  });
});
