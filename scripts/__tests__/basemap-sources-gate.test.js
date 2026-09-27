/**
 * Άγκυρες του CHECK 3.95 — πύλη των πηγών υποβάθρου (ADR-891 Φ1).
 *
 * 🔑 Οι μεταλλάξεις **ΕΚΤΕΛΟΥΝ** την πύλη σε προσωρινό δέντρο: ένα test που ελέγχει μόνο ότι το
 * κριτήριο είναι **γραμμένο** θα έμενε πράσινο πάνω σε πύλη που δεν δουλεύει (μάθημα 3.54).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CATALOG_FILE, GATE_STATES, SOURCE_OWNERS, isTestFile } = require('../lib/basemap-sources/contract.js');
const { judgeText, sweep } = require('../lib/basemap-sources/gate.js');
const { main } = require('../check-basemap-sources.js');

const markersOf = (source, file = 'x.ts') => judgeText(file, source).map((hit) => hit.marker);

describe('Α — τα δομικά μοτίβα, σε κυριολεκτικές συμβολοσειρές', () => {
  it.each([
    ["const u = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';", 'tile-template'],
    ['const u = `https://a.example.com/${layer}/{z}/{x}/{y}.png`;', 'tile-template'],
    ["const s = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';", 'style-document'],
    ["const s = 'https://example.com/styles/STYLE.JSON?key=1';", 'style-document'],
    ["const p = 'pmtiles://https://cdn.example.com/greece.pmtiles';", 'pmtiles-archive'],
    ["const p = '/data/greece.pmtiles';", 'pmtiles-archive'],
    ["const m = 'mapbox://styles/mapbox/streets-v12';", 'mapbox-scheme'],
    ["const h = 'https://tiles.stadiamaps.com/tiles/stamen_toner';", 'tile-host'],
    ["const h = 'https://basemaps-api.arcgis.com/arcgis/rest';", 'tile-host'],
  ])('%s → %s', (source, marker) => {
    expect(markersOf(source)).toEqual([marker]);
  });

  it.each([
    "const u = 'https://www.openstreetmap.org/copyright';",
    "const u = 'https://nominatim.openstreetmap.org/search';",
    "const u = 'https://www.openstreetmap.org/search?query=x';",
    "const u = '/data/admin-area-index.json';",
    "const t = 'tile';",
  ])('ΟΧΙ πηγή: %s', (source) => {
    expect(markersOf(source)).toEqual([]);
  });

  it('🔴 ΠΡΟΖΑ ΔΕΝ ΜΕΤΡΑ: ό,τι ζει σε σχόλιο δεν είναι πηγή (AST, όχι regex)', () => {
    const source = [
      '/** Η πολιτική του https://tile.openstreetmap.org/{z}/{x}/{y}.png απαγορεύει prefetch. */',
      '// δες https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      'export const x = 1;',
    ].join('\n');
    expect(markersOf(source)).toEqual([]);
  });

  it('TSX: συμβολοσειρά σε ιδιότητα JSX μετρά', () => {
    expect(markersOf('export const A = () => <Map mapStyle="mapbox://styles/x" />;', 'a.tsx')).toEqual(['mapbox-scheme']);
  });
});

describe('Β — ποιοι δεν κρίνονται', () => {
  it.each(['src/lib/maps/__tests__/x.test.ts', 'src/a/b.spec.tsx', 'src/a/__tests__/fixtures.ts'])('%s', (rel) => {
    expect(isTestFile(rel)).toBe(true);
  });

  it('ο μοναδικός ιδιοκτήτης είναι το μητρώο, με ουσιαστικό λόγο', () => {
    expect(Object.keys(SOURCE_OWNERS)).toEqual([CATALOG_FILE]);
    expect(SOURCE_OWNERS[CATALOG_FILE].length).toBeGreaterThanOrEqual(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Γ — ΜΕΤΑΛΛΑΞΕΙΣ: η πύλη ΕΚΤΕΛΕΙΤΑΙ σε προσωρινό δέντρο
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG_BODY = "export const S = { osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' };\n";

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basemap-gate-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return root;
}

const statesOf = (result) => result.violations.map((v) => v.state);

describe('Γ — μεταλλάξεις', () => {
  const trees = [];
  const tree = (files) => {
    const root = makeTree(files);
    trees.push(root);
    return root;
  };
  afterAll(() => trees.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

  it('υγιές δέντρο ⇒ πράσινο, με τη λογιστική να κλείνει', () => {
    const root = tree({ [CATALOG_FILE]: CATALOG_BODY, 'src/a.ts': 'export const a = 1;\n' });
    const result = sweep(root);
    expect(result.violations).toEqual([]);
    expect(result.population).toBe(2);
    expect(result.tally[GATE_STATES.OWNER] + result.tally[GATE_STATES.CLEAN]).toBe(2);
    expect(result.catalogSources).toBe(1);
  });

  it('🔴 Μ1 — URL πλακιδίων σε καταναλωτή ⇒ undeclared-source, με αρχείο:γραμμή', () => {
    const root = tree({
      [CATALOG_FILE]: CATALOG_BODY,
      'src/components/geo/PlaceMap.tsx': "export const s = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';\n",
    });
    const result = sweep(root);
    expect(statesOf(result)).toEqual([GATE_STATES.UNDECLARED_SOURCE]);
    expect(result.violations[0].rel).toBe('src/components/geo/PlaceMap.tsx:1');
  });

  it('🔴 Μ2 — άδειο μητρώο ⇒ empty-catalog (όχι «πράσινο επειδή δεν υπάρχει τίποτα»)', () => {
    const root = tree({ [CATALOG_FILE]: 'export const S = {};\n' });
    expect(statesOf(sweep(root))).toEqual([GATE_STATES.EMPTY_CATALOG]);
  });

  it('🔴 Μ3 — ανύπαρκτο μητρώο ⇒ orphan-owner ΚΑΙ empty-catalog', () => {
    const root = tree({ 'src/a.ts': 'export const a = 1;\n' });
    expect(statesOf(sweep(root)).sort()).toEqual([GATE_STATES.EMPTY_CATALOG, GATE_STATES.ORPHAN_OWNER].sort());
  });

  it('🔴 Μ4 — δήλωση ιδιοκτήτη χωρίς λόγο ⇒ reasonless-owner', () => {
    const root = tree({ [CATALOG_FILE]: CATALOG_BODY, 'src/b.ts': "export const s = 'mapbox://x';\n" });
    const result = sweep(root, { owners: { [CATALOG_FILE]: SOURCE_OWNERS[CATALOG_FILE], 'src/b.ts': 'γιατί ναι' } });
    expect(statesOf(result)).toEqual([GATE_STATES.REASONLESS_OWNER]);
  });

  it('το test που γράφει URL για να ΕΛΕΓΞΕΙ το μητρώο δεν κρίνεται', () => {
    const root = tree({
      [CATALOG_FILE]: CATALOG_BODY,
      'src/lib/maps/__tests__/c.test.ts': "expect('https://tile.openstreetmap.org/{z}/{x}/{y}.png').toBe('');\n",
    });
    expect(sweep(root).violations).toEqual([]);
  });

  it('η είσοδος του hook: κόκκινο δέντρο ⇒ exit 1 · καμία σχετική αλλαγή ⇒ 0 χωρίς σάρωση', () => {
    const root = tree({ [CATALOG_FILE]: CATALOG_BODY, 'src/x.ts': "export const s = 'mapbox://x';\n" });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(main(['node', 'gate', 'src/x.ts'], root)).toBe(1);
      expect(main(['node', 'gate', 'README.md'], root)).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
});
