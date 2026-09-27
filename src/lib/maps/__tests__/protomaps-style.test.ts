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
import { protomapsStyle } from '../protomaps-style';
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
