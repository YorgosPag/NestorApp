/**
 * ADR-770 Στρώμα 2β (CHECK 3.40) — άγκυρες της πύλης αντίθεσης σε χρόνο εκτέλεσης.
 *
 * ΑΡΧΗ ΤΩΝ ΔΟΚΙΜΩΝ: η απόδειξη γίνεται με **πραγματικό κώδικα του αποθετηρίου** (το
 * αληθινό `globals.css`, τα αληθινά token modules), όχι με fixture. Ένα fixture
 * αποδεικνύει ότι ο κώδικας συμφωνεί με το fixture· εδώ θέλουμε να αποδείξουμε ότι
 * συμφωνεί με **την εφαρμογή**. Ίδιο πρότυπο με τα 29 tests του CHECK 3.39.
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ: κάθε ομάδα Μ* σπάει σκόπιμα μια συγκεκριμένη γραμμή λογικής και απαιτεί
 * να το πιάσει η πύλη. Ένα test που περνά και πριν και μετά τη μετάλλαξη δεν φρουρεί
 * τίποτα (ADR-587 §6.1: «ένα anchor χωρίς πύλη είναι σχόλιο»).
 */

'use strict';

const path = require('path');
const {
  parseComputedColor, hslToRgb, contrastRatio, toHex,
} = require('../lib/contrast/wcag-contrast');
const { readThemes, surfaceTokens, foregroundTokens } = require('../lib/contrast/css-token-themes');
const { readTokenPalette, derivePairs } = require('../lib/contrast/ts-token-palette');
const {
  evaluateRuntimeMatrix, auditCoverage, buildRuntimePalette, buildRuntimeThemes,
  findDanglingVars, findAstDivergence, evaluateTranslucent, assertSnapshotUsable,
  ALL_RATCHETED_STATES, RUNTIME_RATCHETED_STATES,
} = require('../lib/contrast/runtime-matrix');
const { violationId, declarationIds } = require('../check-runtime-contrast-ratchet');
const { compareSets } = require('../lib/ratchet-baseline');
const { collectColorLeaves, isColorShaped } = require('../../src/app/(bare)/test-harness/contrast-matrix/token-color-leaves');

const REPO = path.resolve(__dirname, '..', '..');
const themes = readThemes(REPO);
const astPalette = readTokenPalette(REPO);

/** Τα custom properties ενός θέματος, στη μορφή που στέλνει ο browser (υπολογισμένα). */
function propsOf(theme) {
  return Object.fromEntries([...themes[theme]].filter(([, v]) => /^[\d.]+\s/.test(v)));
}

/** Ελάχιστο έγκυρο στιγμιότυπο — μόνο ό,τι δηλώνει το συμβόλαιο του harness. */
function snapshot(theme, declarations, overrides = {}) {
  return {
    theme,
    themeVerified: true,
    declarations,
    customProperties: propsOf(theme),
    aliases: [],
    skipped: { functions: [], nonColorStrings: 0, cssUnsafe: [], truncatedAtDepth: [] },
    unreadableStylesheets: 0,
    ...overrides,
  };
}

function pair(declarations, overrides = {}) {
  return {
    light: snapshot('light', declarations, overrides.light),
    dark: snapshot('dark', declarations, overrides.dark),
  };
}

const decl = (p, raw, computed, state = 'color') => ({ path: p, raw, computed, state });

// ════════════════════════════════════════════════════════════════════════════
describe('Μ0 — έλεγχος μεταλλάξεων: κάθε άγκυρα όντως φρουρεί κάτι', () => {
  test('Μ0.1 αν το κριτήριο theme-flip αγνοηθεί, το Ρ3 σκάει', () => {
    // Η μετάλλαξη: το ίδιο hex κρίνεται σαν να υπήρχε ένα μόνο θέμα.
    const light = surfaceTokens(themes.light).find((s) => s.name === '--card');
    const dark = surfaceTokens(themes.dark).find((s) => s.name === '--card');
    const rgb = [0x1e, 0x29, 0x3b];
    const rl = contrastRatio(rgb, hslToRgb(light.hsl));
    const rd = contrastRatio(rgb, hslToRgb(dark.hsl));
    // Αν κάποιος «απλοποιήσει» σε ένα θέμα, το flip γίνεται αόρατο:
    expect(rl >= 4.5).toBe(true);
    expect(rd >= 4.5).toBe(false);
    expect((rl >= 4.5) === (rd >= 4.5)).toBe(false); // ⇒ υπάρχει flip να βρεθεί
  });

  test('Μ0.2 αν το parseComputedColor δεχτεί τα πάντα, το Ρ2 σκάει', () => {
    expect(parseComputedColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseComputedColor('')).toBeNull();
    expect(parseComputedColor('rebeccapurple')).toBeNull();
  });

  test('Μ0.3 αν ο αυστηρός έλεγχος κάλυψης γίνει αθροιστικός, το Ρ4 σκάει', () => {
    // Λογιστική που «κλείνει» αλλά με κρίσιμη δήλωση ακρίτη ⇒ balanced=false.
    const fake = {
      counts: { declarations: 1, resolvedColors: 1, translucent: 0, judgedDeclarations: 0 },
      unjudged: {
        opaqueWithoutRole: 0, translucentWithoutRole: 0, notAColor: 0,
        contextDependent: 0, fullyTransparent: 0, unparseableComputed: 0,
      },
      judgeableUnjudgedIds: ['x::colors.text.primary'],
    };
    const a = auditCoverage(fake);
    expect(a.sumBalanced).toBe(true);       // το άθροισμα κλείνει…
    expect(a.everyJudgeableJudged).toBe(false); // …αλλά κάποιος δεν κρίθηκε
    expect(a.balanced).toBe(false);          // ⇒ fail-closed
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ1 — γεφύρωση ταυτοτήτων AST ↔ runtime', () => {
  test('Ρ1.1 το μονοπάτι του runtime ταιριάζει ακριβώς με το AST για literal δηλώσεις', () => {
    const target = astPalette.entries.find((e) => e.path === 'colors.text.primary');
    expect(target).toBeDefined();
    const snaps = pair([decl('colors.text.primary', target.hex, 'rgb(30, 41, 59)')]);
    const p = buildRuntimePalette(snaps.light.declarations, astPalette);
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0].bridge).toBe('exact');
    expect(p.entries[0].file).toBe(target.file);
    expect(p.entries[0].line).toBe(target.line);
  });

  test('Ρ1.2 δήλωση-αναφορά (όχι literal) γεφυρώνεται στο ΑΡΧΕΙΟ του export', () => {
    // `mapControlPointTokens.base.backgroundColor: colors.background.primary` — ο AST
    // δεν το βλέπει (δεν είναι string literal), αλλά ξέρει το module.
    const snaps = pair([decl('mapControlPointTokens.base.backgroundColor', 'ref', 'rgb(255, 255, 255)')]);
    const p = buildRuntimePalette(snaps.light.declarations, astPalette);
    expect(p.entries[0].bridge).toBe('export');
    expect(p.entries[0].file).toMatch(/brand-map\.ts$/);
  });

  test('Ρ1.3 άγνωστο export ⇒ bridge "none", ΔΗΛΩΜΕΝΟ, όχι σιωπηλή απόρριψη', () => {
    const snaps = pair([decl('totallyUnknownExport.text.primary', '#000000', 'rgb(0, 0, 0)')]);
    const p = buildRuntimePalette(snaps.light.declarations, astPalette);
    expect(p.entries[0].bridge).toBe('none');
    expect(p.entries[0].file).toBe('(runtime)');
  });

  test('Ρ1.4 ψευδώνυμο export γεφυρώνεται μέσω των aliases του harness', () => {
    const real = astPalette.entries.find((e) => e.path.startsWith('portalComponentsExtended.'));
    expect(real).toBeDefined();
    const aliasPath = real.path.replace('portalComponentsExtended', 'portalComponents');
    const p = buildRuntimePalette(
      [decl(aliasPath, real.form === 'literal-hex' ? real.hex : 'ref', 'rgb(255, 255, 255)')],
      astPalette,
      [{ path: 'portalComponentsExtended', canonical: 'portalComponents' }],
    );
    expect(p.entries[0].bridge).toBe('exact');
    expect(p.entries[0].file).toMatch(/portal-overlay\.ts$/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ2 — parseComputedColor: το SSoT των υπολογισμένων χρωμάτων', () => {
  test.each([
    ['rgb(30, 41, 59)', [30, 41, 59], 1],
    ['rgba(0, 0, 0, 0.5)', [0, 0, 0], 0.5],
    ['rgb(0 0 0 / 0.25)', [0, 0, 0], 0.25],
    ['rgb(10 20 30 / 50%)', [10, 20, 30], 0.5],
    ['rgba(255, 255, 255, 1)', [255, 255, 255], 1],
  ])('Ρ2 "%s" → %j α=%s', (css, rgb, alpha) => {
    const p = parseComputedColor(css);
    expect(p.rgb).toEqual(rgb);
    expect(p.alpha).toBeCloseTo(alpha, 4);
  });

  test('Ρ2.6 το ΟΝΟΜΑ της συνάρτησης ΔΕΝ καθορίζει το άλφα (rgb() με slash)', () => {
    expect(parseComputedColor('rgb(0 0 0 / 0.5)').alpha).toBe(0.5);
    expect(parseComputedColor('rgba(1, 2, 3)').alpha).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ3 — ΒΑΘΜΟΝΟΜΗΣΗ: αναπαραγωγή του ζωντανού ευρήματος του ADR-759', () => {
  test('Ρ3.1 colors.text.primary πάνω σε --card: περνά στο φωτεινό, εξαφανίζεται στο σκοτεινό', () => {
    const snaps = pair([decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)')]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    const f = r.findings.find((x) => x.declId.endsWith('colors.text.primary'));
    expect(f).toBeDefined();
    expect(f.state).toBe('theme-flip');
    expect(f.detail).toMatch(/σπάει στο σκοτεινό/);
  });

  test('Ρ3.2 ο αριθμός είναι ο μετρημένος: 1,0x:1 πάνω στο σκοτεινό --card', () => {
    const card = surfaceTokens(themes.dark).find((s) => s.name === '--card');
    const ratio = contrastRatio([30, 41, 59], hslToRgb(card.hsl));
    expect(ratio).toBeGreaterThan(1.0);
    expect(ratio).toBeLessThan(1.1); // ADR-759: 1,01:1
  });

  test('Ρ3.3 το #1e293b ΕΙΝΑΙ ακριβώς το rgb(30,41,59) του στιγμιότυπου', () => {
    expect(toHex([30, 41, 59])).toBe('#1e293b');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ4 — λογιστική κάλυψης: κάθε δήλωση ανήκει σε ακριβώς μία κατηγορία', () => {
  test('Ρ4.1 η λογιστική κλείνει σε μικτό σύνολο δηλώσεων', () => {
    const snaps = pair([
      decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)'),
      decl('colors.blue.500', '#3b82f6', 'rgb(59, 130, 246)'),      // primitive, χωρίς ρόλο
      decl('canvasUI.overlay.backgroundColor', 'rgba(0,0,0,.5)', 'rgba(0, 0, 0, 0.5)'),
      decl('x.y.padding', 'var(--nope)', '', 'not-a-color'),
      decl('z.w.color', 'transparent', 'rgba(0, 0, 0, 0)'),
    ]);
    const a = auditCoverage(evaluateRuntimeMatrix(snaps, astPalette));
    expect(a.balanced).toBe(true);
    expect(a.actual).toBe(5);
  });

  test('Ρ4.2 κάθε δήλωση με σημασιολογικό ρόλο ΠΡΕΠΕΙ να έχει παραγάγει εύρημα', () => {
    const snaps = pair([
      decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)'),
      decl('colors.background.primary', '#ffffff', 'rgb(255, 255, 255)'),
      decl('borderColors.default.light', '#e2e8f0', 'rgb(226, 232, 240)'),
    ]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    expect(r.judgeableUnjudgedIds).toEqual([]);
    expect(auditCoverage(r).everyJudgeableJudged).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ5 — ημιδιαφανείς ΕΠΙΦΑΝΕΙΕΣ κρίνονται (το σφάλμα που έκανε το Κ1 να υπάρχει)', () => {
  test('Ρ5.1 ημιδιαφανής επιφάνεια παράγει εύρημα, δεν παραλείπεται', () => {
    const snaps = pair([decl('canvasUI.overlay.backgroundColor', 'rgba(0,0,0,0.5)', 'rgba(0, 0, 0, 0.5)')]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    const f = r.findings.find((x) => x.declId.endsWith('canvasUI.overlay.backgroundColor'));
    expect(f).toBeDefined();
    expect(f.state).toMatch(/^translucent-/);
    expect(f.detail).toMatch(/ρόλος surface/);
    expect(f.detail).toMatch(/θεματικά χρώματα κειμένου/); // κρίθηκε ΕΝΑΝΤΙ foregrounds
  });

  test('Ρ5.2 ημιδιαφανές foreground κρίνεται έναντι ΕΠΙΦΑΝΕΙΩΝ (αντίστροφη ερώτηση)', () => {
    const snaps = pair([decl('colors.text.ghost', 'rgba(0,0,0,0.05)', 'rgba(0, 0, 0, 0.05)')]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    const f = r.findings.find((x) => x.declId.endsWith('colors.text.ghost'));
    expect(f.state).toBe('translucent-invisible'); // 5% μαύρο είναι αόρατο παντού
    expect(f.detail).toMatch(/επιφάνειες/);
  });

  test('Ρ5.3 πλήρως διαφανές ΔΕΝ κρίνεται — δεν βάφει τίποτα', () => {
    const snaps = pair([decl('colors.text.none', 'transparent', 'rgba(0, 0, 0, 0)')]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    expect(r.findings.filter((x) => x.declId.endsWith('colors.text.none'))).toHaveLength(0);
    expect(r.unjudged.fullyTransparent).toBe(1);
    expect(auditCoverage(r).balanced).toBe(true);
  });

  test('Ρ5.4 ο πραγματικός κώδικας ΟΝΤΩΣ έχει ημιδιαφανείς επιφάνειες να ξεχαστούν', () => {
    // Αν αυτό γίνει 0, το Ρ5 φρουρεί υποθετικό σενάριο — και πρέπει να το ξέρουμε.
    const overlays = astPalette.entries.filter((e) => e.form === 'rgb-literal');
    expect(overlays.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ6 — dangling-var: η κατάσταση που κανένα στατικό εργαλείο δεν παράγει', () => {
  test('Ρ6.1 var που ΔΕΝ ορίζεται σε κανένα θέμα ⇒ dangling-var', () => {
    const snaps = pair([decl('a.b.color', 'var(--definitely-not-defined)', '', 'not-a-color')]);
    const f = findDanglingVars(snaps);
    expect(f).toHaveLength(1);
    expect(f[0].state).toBe('dangling-var');
    expect(f[0].missing).toEqual(['--definitely-not-defined']);
  });

  test('Ρ6.2 var που ΟΡΙΖΕΤΑΙ δεν είναι dangling, ακόμα κι αν δεν είναι χρώμα', () => {
    const defined = Object.keys(propsOf('light'))[0];
    expect(defined).toBeDefined();
    const snaps = pair([decl('a.b.padding', `var(${defined})`, '', 'not-a-color')]);
    expect(findDanglingVars(snaps)).toHaveLength(0);
  });

  test('Ρ6.3 στον ΠΡΑΓΜΑΤΙΚΟ κώδικα υπάρχουν dangling vars — η κατάσταση δεν είναι υποθετική', () => {
    // Το `layoutUtilities.cssVars.*` ζητά ονόματα παλαιότερης έκδοσης του generator.
    const snaps = pair([
      decl('layoutUtilities.cssVars.helpText.muted.color', 'var(--color-text-tertiary)', '', 'not-a-color'),
    ]);
    const f = findDanglingVars(snaps);
    expect(f).toHaveLength(1);
    expect(f[0].missing).toEqual(['--color-text-tertiary']);
    // …και το σωστό όνομα ΥΠΑΡΧΕΙ, δηλαδή είναι απόκλιση ονοματοδοσίας, όχι απουσία:
    expect(Object.keys(propsOf('light'))).toContain('--muted-foreground');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ7 — ast-runtime-divergence: «η δήλωση που διάβασε το εργαλείο είναι η τιμή που βάφτηκε;»', () => {
  test('Ρ7.1 διαφορά AST vs browser ⇒ εύρημα', () => {
    const p = buildRuntimePalette(
      [decl('colors.text.primary', '#1e293b', 'rgb(255, 0, 0)')],
      astPalette,
    );
    const f = findAstDivergence(p);
    expect(f).toHaveLength(1);
    expect(f[0].state).toBe('ast-runtime-divergence');
    expect(f[0].detail).toMatch(/#1e293b/);
    expect(f[0].detail).toMatch(/#ff0000/);
  });

  test('Ρ7.2 συμφωνία ⇒ κανένα εύρημα (η βαθμονόμηση του στρώματος)', () => {
    const p = buildRuntimePalette(
      [decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)')],
      astPalette,
    );
    expect(findAstDivergence(p)).toHaveLength(0);
  });

  test('Ρ7.3 σύντομο hex (#fff) δεν παράγει ψευδή απόκλιση', () => {
    const p = buildRuntimePalette([decl('x.y.color', '#fff', 'rgb(255, 255, 255)')], astPalette);
    p.entries[0].astHex = '#fff';
    expect(findAstDivergence(p)).toHaveLength(0);
  });

  test('Ρ7.4 η σύγκριση αφορά ΜΟΝΟ τις exact — ο παρονομαστής αναφέρεται', () => {
    const snaps = pair([
      decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)'),
      decl('mapControlPointTokens.base.backgroundColor', 'ref', 'rgb(255, 255, 255)'),
    ]);
    const r = evaluateRuntimeMatrix(snaps, astPalette);
    expect(r.bridge.exact).toBe(1);
    expect(r.bridge.export).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ8 — fail-closed: ένα στιγμιότυπο που δεν μπορεί να απαντήσει ΣΚΑΕΙ', () => {
  const good = () => pair([decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)')]);

  test('Ρ8.1 themeVerified=false ⇒ σφάλμα (race, όχι μέτρηση)', () => {
    const s = good();
    s.dark.themeVerified = false;
    expect(() => assertSnapshotUsable(s)).toThrow(/ΔΕΝ επαληθεύτηκε/);
  });

  test('Ρ8.2 λείπει θέμα ⇒ σφάλμα', () => {
    const s = good();
    delete s.dark;
    expect(() => assertSnapshotUsable(s)).toThrow(/λείπει το στιγμιότυπο/);
  });

  test('Ρ8.3 άδειες δηλώσεις ⇒ σφάλμα (ποτέ «καθαρό»)', () => {
    const s = pair([]);
    expect(() => assertSnapshotUsable(s)).toThrow(/δεν έχει δηλώσεις/);
  });

  test('Ρ8.4 μη-αναγνώσιμα stylesheets ⇒ σφάλμα (ελλιπής απαρίθμηση)', () => {
    const s = good();
    s.light.unreadableStylesheets = 2;
    expect(() => assertSnapshotUsable(s)).toThrow(/cross-origin/);
  });

  test('Ρ8.5 ασύμμετρα σύνολα δηλώσεων ⇒ σφάλμα', () => {
    const s = good();
    s.dark.declarations = [decl('other.path.color', '#000', 'rgb(0, 0, 0)')];
    expect(() => assertSnapshotUsable(s)).toThrow(/δεν έχουν τις ίδιες δηλώσεις/);
  });

  test('Ρ8.6 λάθος ετικέτα θέματος ⇒ σφάλμα', () => {
    const s = good();
    s.dark.theme = 'light';
    expect(() => assertSnapshotUsable(s)).toThrow(/δηλώνει/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ9 — ο walker του harness (token-color-leaves)', () => {
  test('Ρ9.1 ψευδώνυμα καταγράφονται, δεν εξαφανίζονται', () => {
    const shared = { primary: '#111111' };
    const ns = { alpha: { text: shared }, zeta: { text: shared } };
    const out = collectColorLeaves(ns);
    expect(out.leaves.map((l) => l.path)).toEqual(['alpha.text.primary']);
    expect(out.aliases).toEqual([{ path: 'zeta.text', canonical: 'alpha.text' }]);
  });

  test('Ρ9.2 το κανονικό μονοπάτι είναι το ΚΟΝΤΟΤΕΡΟ — ανεξάρτητο από τη σειρά exports', () => {
    const shared = { primary: '#111111' };
    const a = collectColorLeaves({ zzz: shared, wrap: { deep: shared } });
    const b = collectColorLeaves({ wrap: { deep: shared }, zzz: shared });
    expect(a.leaves.map((l) => l.path)).toEqual(['zzz.primary']);
    expect(b.leaves.map((l) => l.path)).toEqual(a.leaves.map((l) => l.path));
  });

  test('Ρ9.3 συναρτήσεις παραλείπονται ΚΑΙ αριθμούνται', () => {
    const out = collectColorLeaves({ mod: { factory: (x) => x, plain: '#222222' } });
    expect(out.skippedFunctions).toEqual(['mod.factory']);
    expect(out.leaves).toHaveLength(1);
  });

  test('Ρ9.4 μη-χρωματικές συμβολοσειρές αριθμούνται, δεν σιωπούν', () => {
    const out = collectColorLeaves({ mod: { pad: '8px', color: '#333333' } });
    expect(out.skippedNonColorStrings).toBe(1);
  });

  test('Ρ9.5 κυκλική αναφορά δεν κρεμάει — τερματίζει', () => {
    const cyclic = { color: '#444444' };
    cyclic.self = cyclic;
    expect(() => collectColorLeaves({ mod: cyclic })).not.toThrow();
  });

  test('Ρ9.6 το var() ΠΕΡΝΑ αναγκαστικά — δεν ξέρουμε αν κρατά χρώμα', () => {
    expect(isColorShaped('var(--spacing-4)')).toBe(true);
    expect(isColorShaped('8px')).toBe(false);
    expect(isColorShaped('hsl(var(--card))')).toBe(true);
    expect(isColorShaped('color-mix(in srgb, red, blue)')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ10 — ratchet κατά ταυτότητα: η ΑΝΤΑΛΛΑΓΗ μπλοκάρει', () => {
  test('Ρ10.1 νέα παραβίαση ⇒ added', () => {
    const c = compareSets(['theme-flip::a', 'theme-flip::b'], ['theme-flip::a']);
    expect(c.added).toEqual(['theme-flip::b']);
  });

  test('Ρ10.2 ίδιο πλήθος αλλά άλλη ταυτότητα ⇒ ΜΠΛΟΚΑΡΕΙ (μάθημα ADR-749)', () => {
    const c = compareSets(['theme-flip::b'], ['theme-flip::a']);
    expect(c.currentCount).toBe(c.baselineCount);
    expect(c.added).toEqual(['theme-flip::b']);
  });

  test('Ρ10.3 λιγότερες ⇒ πρόοδος, καμία προσθήκη', () => {
    const c = compareSets([], ['theme-flip::a']);
    expect(c.added).toEqual([]);
    expect(c.removed).toEqual(['theme-flip::a']);
  });

  test('Ρ10.4 η ταυτότητα ΔΕΝ περιέχει γραμμή ή τιμή', () => {
    const id = violationId({ state: 'theme-flip', id: 'f.ts::colors.text.primary', line: 42 });
    expect(id).not.toMatch(/42/);
    expect(id).toBe('theme-flip::f.ts::colors.text.primary');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ11 — ΜΙΑ μηχανή: το derivePairs είναι κοινό AST/runtime', () => {
  test('Ρ11.1 τα δηλωμένα ζεύγη του AST προκύπτουν από derivePairs, ταυτόσημα', () => {
    const d = derivePairs(astPalette.entries);
    const key = (x) => `${x.file}::${x.path}`;
    expect(d.declaredPairs.map(key).sort()).toEqual(astPalette.declaredPairs.map(key).sort());
    expect(d.themedPairs.length).toBe(astPalette.themedPairs.length);
  });

  test('Ρ11.2 το runtime χρησιμοποιεί ΤΟ ΙΔΙΟ derivePairs, όχι δικό του', () => {
    const snaps = pair([
      decl('colors.severity.critical.background', '#fee2e2', 'rgb(254, 226, 226)'),
      decl('colors.severity.critical.icon', '#f87171', 'rgb(248, 113, 113)'),
    ]);
    const p = buildRuntimePalette(snaps.light.declarations, astPalette);
    expect(p.declaredPairs.length).toBeGreaterThan(0);
    expect(p.declaredPairs[0].surface.path).toMatch(/background$/);
  });

  test('Ρ11.3 τα themes του runtime τροφοδοτούν τα ΥΠΑΡΧΟΝΤΑ surfaceTokens/foregroundTokens', () => {
    const snaps = pair([decl('colors.text.primary', '#1e293b', 'rgb(30, 41, 59)')]);
    const t = buildRuntimeThemes(snaps);
    expect(surfaceTokens(t.light).length).toBe(surfaceTokens(themes.light).length);
    expect(foregroundTokens(t.dark).length).toBe(foregroundTokens(themes.dark).length);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Ρ12 — το συμβόλαιο της πύλης', () => {
  /**
   * 🔑 ΞΑΝΑΓΡΑΦΤΗΚΕ 2026-08-08 — ΔΕΝ ΧΑΛΑΡΩΣΕ.
   *
   * Απαιτούσε **τρεις** καταστάσεις, ανάμεσά τους το `translucent-invisible`, με τον
   * ισχυρισμό ότι «κανένα στατικό εργαλείο δεν μπορεί να τις παράγει». Ο ισχυρισμός
   * ήταν ιδιότητα της **υλοποίησης**: κανείς δεν είχε δώσει στον AST reader
   * `palette.translucent`. Μόλις το CHECK 3.39 έκλεισε το όριο `Κ5`, η ημιδιαφάνεια
   * κρίνεται **χωρίς browser** — άρα η κατάσταση μετακόμισε στον κοινό κριτή.
   *
   * Οι **δύο** που έμειναν είναι γνήσια αδύνατες στατικά, και το test το λέει ρητά ώστε
   * να μη γίνει ποτέ ξανά «τρεις επειδή έτσι τις βρήκαμε».
   */
  test('Ρ12.1 οι ΔΥΟ γνήσια runtime καταστάσεις είναι ratcheted, όχι zero-tolerance', () => {
    expect(RUNTIME_RATCHETED_STATES).toEqual(['dangling-var', 'ast-runtime-divergence']);
    for (const s of RUNTIME_RATCHETED_STATES) expect(ALL_RATCHETED_STATES).toContain(s);
  });

  test('Ρ12.1β το translucent-invisible μετακόμισε στον ΚΟΙΝΟ κριτή — και μένει ratcheted', () => {
    // Δεν είναι πια «δικό μου»…
    expect(RUNTIME_RATCHETED_STATES).not.toContain('translucent-invisible');
    // …αλλά το ΣΥΝΟΛΟ που μετράει η πύλη μένει **ακριβώς το ίδιο**: η baseline δεν
    // επιτρέπεται να κουνηθεί επειδή ένας ορισμός μετακόμισε αρχείο.
    expect(ALL_RATCHETED_STATES).toContain('translucent-invisible');
    expect(new Set(ALL_RATCHETED_STATES).size).toBe(ALL_RATCHETED_STATES.length);
  });

  test('Ρ12.2 οι υγιείς καταστάσεις ΔΕΝ μπαίνουν στο ratchet', () => {
    for (const s of ['translucent-ok', 'declared-pair-ok', 'themed-side-ok', 'both-pass']) {
      expect(ALL_RATCHETED_STATES).not.toContain(s);
    }
  });

  test('Ρ12.3 declarationIds = κλειστό σύνολο, ταξινομημένο, χωρίς διπλά', () => {
    const ids = declarationIds({
      findings: [
        { declId: 'b::x' }, { declId: 'a::y' }, { declId: 'b::x' },
      ],
    });
    expect(ids).toEqual(['a::y', 'b::x']);
  });

  test('Ρ12.4 η baseline του αποθετηρίου είναι έγκυρη και fail-closed-συμβατή', () => {
    // eslint-disable-next-line global-require
    const baseline = require('../../.runtime-contrast-baseline.json');
    expect(Array.isArray(baseline.violations)).toBe(true);
    expect(Array.isArray(baseline.declarations)).toBe(true);
    expect(baseline.violation_count).toBe(baseline.violations.length);
    expect(baseline.declaration_count).toBe(baseline.declarations.length);
    expect(baseline.note).toMatch(/ΔΕΝ είναι δείκτης υγείας/);
  });
});
