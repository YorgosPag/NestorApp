/**
 * Άγκυρες του **χάρτη φόντου ανά θέμα** και του **πρωτοκόλλου `pmtiles://`** (ADR-891 §9).
 *
 * 🔑 Η κεντρική υπόσχεση: η αλλαγή θέματος αλλάζει **χρώματα, όχι δεδομένα** — ίδιο αντικείμενο `sources`,
 * άρα το `setStyle` κάνει diff και δεν ξανακατεβάζει πλακίδια. Και: **κάθε** URL που θα ζητήσει ο χάρτης
 * (αρχείο, glyphs, sprite) ανήκει σε δηλωμένο πάροχο — ο φύλακας μένει σιωπηλός επειδή δεν έχει τι να πει.
 */

import type { VectorSourceSpecification } from 'maplibre-gl';
import { BASEMAP_PROVIDERS } from '../basemap-catalog';
import { classifyMapRequest } from '../basemap-request-sentinel';
import { PROTOMAPS_POI_ICON_SUBSTITUTES, PROTOMAPS_POI_LAYER_ID, protomapsStyle } from '../protomaps-style';
import { ensurePmtilesProtocol, PMTILES_PROTOCOL_NAME, resetPmtilesProtocolForTests } from '../pmtiles-protocol';
import { basemapSchemeOf } from '../use-basemap-scheme';

const light = protomapsStyle('protomaps-greece', 'light');
const dark = protomapsStyle('protomaps-greece', 'dark');

describe('Α — δύο θέματα, ίδια δεδομένα', () => {
  it('ίδια είσοδος ⇒ ΙΔΙΟ αντικείμενο (κανένα «νέο στυλ» σε κάθε render)', () => {
    expect(protomapsStyle('protomaps-greece', 'light')).toBe(light);
  });

  it('ΙΔΙΟ αντικείμενο sources στα δύο θέματα ⇒ η αλλαγή θέματος δεν ξανακατεβάζει πλακίδια', () => {
    expect(dark.sources).toBe(light.sources);
  });

  it('άλλα χρώματα και άλλο sprite ανά θέμα', () => {
    expect(JSON.stringify(dark.layers)).not.toBe(JSON.stringify(light.layers));
    expect(light.sprite).toMatch(/\/sprites\/v4\/light$/);
    expect(dark.sprite).toMatch(/\/sprites\/v4\/dark$/);
  });

  it('κάθε στρώμα με δεδομένα δείχνει ΤΗ ΜΙΑ πηγή', () => {
    const sources = new Set(light.layers.flatMap((l) => ('source' in l && l.source !== undefined ? [l.source] : [])));
    expect([...sources]).toEqual(['protomaps-greece']);
  });

  it('ελληνικά ονόματα: το στυλ ζητά το name:el', () => {
    expect(JSON.stringify(light.layers)).toContain('name:el');
  });

  it('κανένα uppercase από τη μηχανή: το toLocaleUpperCase() χωρίς γλώσσα δίνει «ΑΛΒΑΝΊΑ» εκτός ελληνικού locale', () => {
    // Η πηγή του λάθους είναι πραγματική — αν ποτέ αλλάξει η συμπεριφορά του runtime, το test το λέει.
    expect('Αλβανία'.toUpperCase()).toBe('ΑΛΒΑΝΊΑ');
    for (const style of [light, dark]) {
      const upper = style.layers.filter((l) => l.type === 'symbol' && l.layout?.['text-transform'] === 'uppercase');
      expect(upper.map((l) => l.id)).toEqual([]);
    }
  });

  it('τα στρώματα που ήταν κεφαλαία (χώρες, θάλασσες) ΥΠΑΡΧΟΥΝ ακόμη — αλλάζει η γραφή, όχι το περιεχόμενο', () => {
    const ids = light.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['places_country', 'places_region', 'water_label_ocean']));
  });
});

describe('Β — η πηγή και η απόδοση έρχονται από τον κατάλογο', () => {
  const source = light.sources['protomaps-greece'] as VectorSourceSpecification;

  it('vector πηγή με το αρχείο PMTiles και maxzoom 15', () => {
    expect(source).toMatchObject({ type: 'vector', maxzoom: 15 });
    expect(source.url).toMatch(/^pmtiles:\/\/https:\/\/.+\/greece-\d{8}\.pmtiles$/);
  });

  it('απόδοση OpenStreetMap — τη ζωγραφίζει το σύνορο (§8), κανείς χάρτης δεν τη γράφει', () => {
    expect(source.attribution).toContain('OpenStreetMap');
  });

  it('πρότυπο glyphs της MapLibre', () => {
    expect(light.glyphs).toMatch(/\/fonts\/\{fontstack\}\/\{range\}\.pbf$/);
  });
});

describe('Γ — κάθε URL του στυλ είναι ΔΗΛΩΜΕΝΟ στο μητρώο', () => {
  const source = light.sources['protomaps-greece'] as VectorSourceSpecification;
  const urls = [source.url ?? '', light.glyphs ?? '', String(light.sprite)];

  it.each(urls)('%s', (url) => {
    expect(classifyMapRequest(url.replace('{fontstack}', 'Noto').replace('{range}', '0-255'), 'https://nestorconstruct.gr')).toEqual({
      verdict: 'declared',
      host: BASEMAP_PROVIDERS.nestor.hosts[0],
    });
  });
});

describe('Δ — το πρωτόκολλο καταχωρίζεται ΜΙΑ φορά', () => {
  beforeEach(() => resetPmtilesProtocolForTests());

  it('δεύτερη κλήση ⇒ καμία δεύτερη καταχώριση, το ίδιο Protocol', () => {
    const register = jest.fn();
    const first = ensurePmtilesProtocol(register);
    const second = ensurePmtilesProtocol(register);
    expect(second).toBe(first);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('pmtiles', first.tile);
  });

  it('το όνομα βγαίνει από το σχήμα του καταλόγου', () => {
    expect(PMTILES_PROTOCOL_NAME).toBe('pmtiles');
  });
});

/**
 * Τα εικονίδια σημείων του `sprites/v4` στο καρφωμένο `BASEMAP_ASSETS_REVISION` (`028c18f713ba`) — διαβασμένα 2026-11-24
 * από το `light.json` του δικού μας bundle, ίδια με το upstream. Χωρίς ασπίδες δρόμων, `arrow`, `capital`, `townspot`.
 * ⚠️ Αλλάζει **μόνο** μαζί με το `BASEMAP_ASSETS_REVISION` και **μόνο** διαβάζοντας ξανά το αρχείο.
 */
const SPRITE_V4_POI_ICONS = new Set([
  'aerodrome', 'animal', 'artwork', 'attraction', 'bar', 'beach', 'beauty', 'bench', 'books', 'building', 'bus_stop',
  'cafe', 'clothes', 'convenience', 'drinking_water', 'electronics', 'fast_food', 'ferry_terminal', 'forest', 'garden',
  'library', 'marina', 'museum', 'park', 'peak', 'post_office', 'restaurant', 'school', 'stadium', 'supermarket',
  'theatre', 'toilets', 'train_station', 'university', 'zoo',
]);

/** Όση γλώσσα εκφράσεων χρειάζεται το `icon-image` του στρώματος: `match` πάνω στο `["get","kind"]`. */
function iconFor(expression: unknown, kind: string): unknown {
  if (!Array.isArray(expression)) return expression;
  const [operator, ...rest] = expression;
  if (operator === 'get') return rest[0] === 'kind' ? kind : undefined;
  if (operator !== 'match') throw new Error(`άγνωστος τελεστής στο icon-image: ${String(operator)}`);
  const input = iconFor(rest[0], kind);
  for (let i = 1; i + 1 < rest.length; i += 2) {
    const label: unknown = rest[i];
    if (Array.isArray(label) ? label.includes(input) : label === input) return iconFor(rest[i + 1], kind);
  }
  return iconFor(rest[rest.length - 1], kind);
}

/** Τα είδη που το στρώμα **δέχεται να ζωγραφίσει**: κάθε `["literal", [...]]` μέσα στο φίλτρο του. */
function literalStringsOf(node: unknown): string[] {
  if (!Array.isArray(node)) return [];
  if (node[0] === 'literal' && Array.isArray(node[1])) return node[1].filter((v): v is string => typeof v === 'string');
  return node.flatMap(literalStringsOf);
}

describe('ΣΤ — κάθε εικονίδιο που ζητά το στρώμα σημείων ΥΠΑΡΧΕΙ στο sprite', () => {
  const poisOf = (style: typeof light) => {
    const layer = style.layers.find((l) => l.id === PROTOMAPS_POI_LAYER_ID);
    if (layer === undefined || layer.type !== 'symbol') throw new Error('το στρώμα σημείων λείπει από το στυλ');
    return layer;
  };
  const kinds = [...new Set(literalStringsOf(poisOf(light).filter))];

  it('το φίλτρο του στρώματος διαβάζεται (αλλιώς τα παρακάτω θα περνούσαν κενά)', () => {
    expect(kinds.length).toBeGreaterThan(30);
    expect(kinds).toEqual(expect.arrayContaining(['townhall', 'station', 'cafe']));
  });

  it.each(['light', 'dark'] as const)('%s: κανένα είδος δεν ζητά εικονίδιο εκτός sprite', (scheme) => {
    const icon = poisOf(scheme === 'light' ? light : dark).layout?.['icon-image'];
    const missing = kinds.filter((kind) => !SPRITE_V4_POI_ICONS.has(String(iconFor(icon, kind))));
    expect(missing).toEqual([]);
  });

  it('το δημαρχείο παίρνει το εικονίδιο του δημόσιου κτιρίου· το upstream `station → train_station` μένει', () => {
    const icon = poisOf(light).layout?.['icon-image'];
    expect(iconFor(icon, 'townhall')).toBe('building');
    expect(iconFor(icon, 'station')).toBe('train_station');
    expect(iconFor(icon, 'cafe')).toBe('cafe');
  });

  it('κάθε αντικατάσταση είναι ΑΝΑΓΚΑΙΑ και δείχνει σε υπαρκτό εικονίδιο — όταν το upstream το προσθέσει, φεύγει', () => {
    for (const [kind, icon] of Object.entries(PROTOMAPS_POI_ICON_SUBSTITUTES)) {
      expect(SPRITE_V4_POI_ICONS.has(kind)).toBe(false);
      expect(SPRITE_V4_POI_ICONS.has(icon)).toBe(true);
      expect(kinds).toContain(kind);
    }
  });
});

describe('Ε — θέμα εφαρμογής → θέμα χάρτη', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    [undefined, 'dark'], // πριν την ενυδάτωση: το defaultTheme του layout
    ['κάτι-άλλο', 'dark'],
  ] as const)('%s → %s', (theme, scheme) => {
    expect(basemapSchemeOf(theme)).toBe(scheme);
  });
});
