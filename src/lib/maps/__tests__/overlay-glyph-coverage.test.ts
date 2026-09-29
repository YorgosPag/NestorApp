/**
 * Άγκυρα **κάλυψης γλυφών των ετικετών της εφαρμογής** (ADR-891 §9.5 · CHECK 3.95 Κ3 είναι η δίδυμη στατική).
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ**: το `≈` της ετικέτας συσσωματώματος `12 · +5≈` δεν υπήρχε στις γραμματοσειρές του χάρτη μας. Το εύρος
 * του φόρτωνε κανονικά, άρα η MapLibre δεν έπεφτε σε εφεδρεία — ο χαρακτήρας **έσβηνε σιωπηλά**. Κανένα test, καμία
 * πύλη, κανένα σφάλμα στην κονσόλα δεν μπορούσε να το δει: τα `.pbf` ζουν εκτός git.
 *
 * 🔑 **Το αλφάβητο ΠΑΡΑΓΕΤΑΙ από την έκφραση που ζωγραφίζεται** (`CLUSTER_TEXT`), δεν γράφεται με το χέρι: αύριο που
 * κάποιος θα προσθέσει σύμβολο στην ετικέτα, η άγκυρα το βλέπει μόνη της. Ο περιπατητής ξέρει **κλειστό** σύνολο
 * τελεστών κειμένου — ένας νέος (π.χ. `number-format`, που γράφει διαχωριστικά χιλιάδων) **πετά** αντί να περάσει.
 *
 * 🔑 **Η απόδειξη είναι ο κατάλογος κάλυψης στο git**, γραμμένος από τον γεννήτορα για **συγκεκριμένη** έκδοση assets.
 * Κατάλογος άλλης έκδοσης από αυτή που ζητά ο χάρτης κοκκινίζει (Γ) ⇒ δεν μπορεί να μείνει μπαγιάτικος.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BASEMAP_BUNDLE_PATHS,
  BASEMAP_FONTSTACKS,
  BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS,
  BASEMAP_OVERLAY_TEXT_FONT,
  BASEMAP_SOURCES,
  basemapGlyphFontstacks,
  vectorArchiveBasemapSource,
} from '../basemap-catalog';
import { CLUSTER_TEXT } from '../listing-clusters';
import { MAP_STYLES, mapStyleManager } from '@/subapps/geo-canvas/services/map/MapStyleManager';

interface GlyphCoverage {
  readonly assets: string;
  readonly stacks: Readonly<Record<string, ReadonlyArray<readonly [number, number]>>>;
}

function readCoverage(): GlyphCoverage {
  const raw: unknown = JSON.parse(readFileSync(join(__dirname, '..', 'generated', 'basemap-glyph-coverage.json'), 'utf8'));
  if (typeof raw !== 'object' || raw === null || !('assets' in raw) || !('stacks' in raw)) {
    throw new Error('basemap-glyph-coverage.json: λείπει assets/stacks — ξανατρέξε `npm run build:basemap -- --assets-only`');
  }
  const { assets, stacks } = raw;
  if (typeof assets !== 'string' || typeof stacks !== 'object' || stacks === null) throw new Error('κακό σχήμα καταλόγου κάλυψης');
  return { assets, stacks: stacks as GlyphCoverage['stacks'] };
}

const DIGITS = '0123456789';

/** Οι χαρακτήρες που **μπορεί** να αποδώσει μια έκφραση `text-field` — μόνο οι κλάδοι εξόδου, ποτέ οι συνθήκες. */
function renderableText(expression: unknown): string {
  if (typeof expression === 'string') return expression;
  if (!Array.isArray(expression) || typeof expression[0] !== 'string') {
    throw new Error(`άγνωστη μορφή κειμένου: ${JSON.stringify(expression)}`);
  }
  const [operator, ...args] = expression;
  switch (operator) {
    case 'concat':
      return args.map(renderableText).join('');
    case 'case': // [συνθήκη, έξοδος]* + προεπιλογή
      return args.filter((_, i) => i % 2 === 1 || i === args.length - 1).map(renderableText).join('');
    case 'to-string': // εδώ πάντα πλήθος ⇒ ακέραιος ≥ 0
      return DIGITS;
    default:
      throw new Error(`τελεστής κειμένου «${operator}» άγνωστος στην άγκυρα — δίδαξέ της τι χαρακτήρες βγάζει`);
  }
}

function covers(runs: ReadonlyArray<readonly [number, number]>, codepoint: number): boolean {
  return runs.some(([from, to]) => codepoint >= from && codepoint <= to);
}

function missingCodepoints(text: string, runs: ReadonlyArray<readonly [number, number]>): string[] {
  return [...new Set(text)].filter((ch) => !covers(runs, ch.codePointAt(0) ?? -1));
}

const CLUSTER_ALPHABET = renderableText(CLUSTER_TEXT);
const coverage = readCoverage();

describe('Α — το αλφάβητο της ετικέτας συσσωματώματος, παραγόμενο από την έκφραση', () => {
  it('ο περιπατητής βλέπει ψηφία, «·», «+» και «≈» (αυτοέλεγχος: αλλιώς η Β θα ήταν ταυτολογία)', () => {
    for (const ch of [...DIGITS, '·', '+', '≈']) expect(CLUSTER_ALPHABET).toContain(ch);
  });

  it('τελεστής που δεν ξέρει ⇒ πετά, δεν περνά σιωπηλά', () => {
    expect(() => renderableText(['number-format', ['get', 'x'], {}])).toThrow(/number-format/);
  });
});

describe('Β — κάθε σύμβολο της ετικέτας υπάρχει στη στοίβα που ζητά (bundle μας)', () => {
  it.each(BASEMAP_OVERLAY_TEXT_FONT)('%s', (stack) => {
    const runs = coverage.stacks[stack];
    expect(runs).toBeDefined();
    expect(missingCodepoints(CLUSTER_ALPHABET, runs)).toEqual([]);
  });

  it('μετάλλαξη: χωρίς το συμπλήρωμα Math (το «≈» έξω) ⇒ η άγκυρα το βλέπει', () => {
    const approx = 0x2248;
    const withoutApprox = coverage.stacks['Noto Sans Regular'].flatMap(([from, to]): Array<[number, number]> => {
      if (approx < from || approx > to) return [[from, to]];
      const halves: Array<[number, number]> = [[from, approx - 1], [approx + 1, to]];
      return halves.filter(([a, b]) => a <= b);
    });
    expect(missingCodepoints(CLUSTER_ALPHABET, withoutApprox)).toEqual(['≈']);
  });
});

describe('Γ — ο κατάλογος κάλυψης είναι της ΙΔΙΑΣ έκδοσης assets που ζητά ο χάρτης', () => {
  it('assets ταυτόσημο με BASEMAP_BUNDLE_PATHS.assets (αλλιώς: npm run build:basemap -- --assets-only)', () => {
    expect(coverage.assets).toBe(BASEMAP_BUNDLE_PATHS.assets);
  });

  it('καλύπτει ΚΑΘΕ στοίβα του bundle, και καμία άλλη', () => {
    expect(Object.keys(coverage.stacks).sort()).toEqual([...BASEMAP_FONTSTACKS].sort());
  });

  it('το glyphs URL του χάρτη δείχνει στην ίδια έκδοση', () => {
    expect(vectorArchiveBasemapSource('protomaps-greece').glyphsUrl).toContain(`/${coverage.assets}/fonts/`);
  });
});

describe('Δ — η στοίβα των ετικετών σερβίρεται από ΚΑΘΕ glyph server του καταλόγου', () => {
  it('overlay ⊆ στοίβες bundle · συμπληρωμένες ⊆ στοίβες bundle', () => {
    for (const stack of [...BASEMAP_OVERLAY_TEXT_FONT, ...BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS]) {
      expect(BASEMAP_FONTSTACKS).toContain(stack);
    }
  });

  it.each(Object.entries(BASEMAP_SOURCES))('%s', (_id, source) => {
    const served = basemapGlyphFontstacks(source);
    if (source.format === 'raster') expect(served).toEqual([]);
    else for (const stack of BASEMAP_OVERLAY_TEXT_FONT) expect(served).toContain(stack);
  });

  it.each(MAP_STYLES.flatMap((style) => (['light', 'dark'] as const).map((scheme) => [style, scheme] as const)))(
    'το υπόβαθρο %s (%s) του χάρτη αγγελιών έχει glyphs που σερβίρουν την ετικέτα',
    (style, scheme) => {
      const spec = mapStyleManager.getStyleUrl(style, scheme);
      if (typeof spec === 'string') {
        const source = Object.values(BASEMAP_SOURCES).find((s) => s.format === 'style' && s.styleUrl === spec);
        expect(source).toBeDefined();
        if (source !== undefined) for (const stack of BASEMAP_OVERLAY_TEXT_FONT) expect(basemapGlyphFontstacks(source)).toContain(stack);
      } else {
        expect(spec.glyphs).toBe(vectorArchiveBasemapSource('protomaps-greece').glyphsUrl);
      }
    },
  );
});
