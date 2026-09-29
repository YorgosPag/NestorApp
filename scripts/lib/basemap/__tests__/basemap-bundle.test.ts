/**
 * Άγκυρες του **bundle του χάρτη φόντου** (ADR-891 §9): ποια assets μπαίνουν, πώς απαντά το Range του τοπικού
 * διακομιστή, και ότι η προβολή του Caddyfile μέσα στο compose του Coolify **δεν έχει αποκλίνει** από την πηγή.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BASEMAP_FONTSTACKS } from '../../../../src/lib/maps/basemap-catalog';
import { catalogSpriteFlavors, isBundledAsset } from '../basemap-assets';
import { parseByteRange } from '../byte-range';

const INFRA = join(__dirname, '..', '..', '..', '..', 'infra', 'basemap');

describe('Α — ποια αρχεία του basemaps-assets μπαίνουν στο bundle', () => {
  const flavors = catalogSpriteFlavors();

  it('τα sprites είναι ΜΟΝΟ των flavors που ζητά ο κατάλογος', () => {
    expect(flavors).toEqual(['dark', 'light']);
  });

  it.each([
    'fonts/OFL.txt',
    'fonts/Noto Sans Regular/768-1023.pbf', // ελληνικά
    'fonts/Noto Sans Medium/0-255.pbf',
    'fonts/Noto Sans Italic/65280-65535.pbf',
    'fonts/Noto Sans Devanagari Regular v1/2304-2559.pbf',
    'sprites/v4/light.json',
    'sprites/v4/dark@2x.png',
  ])('✅ %s', (path) => {
    expect(isBundledAsset(path, flavors)).toBe(true);
  });

  it.each([
    'sprites/v4/grayscale.png', // flavor που δεν ζητά κανείς
    'sprites/v3/light.json', // παλιό σχήμα
    'fonts/Noto Sans Bold/0-255.pbf', // stack που δεν ζητά το στυλ
    'README.md',
    'scripts/create_fonts.sh',
    'fonts.json',
  ])('❌ %s', (path) => {
    expect(isBundledAsset(path, flavors)).toBe(false);
  });

  it('οι font stacks είναι ό,τι ζητά το @protomaps/basemaps 5.x', () => {
    expect(BASEMAP_FONTSTACKS).toContain('Noto Sans Regular');
    expect(BASEMAP_FONTSTACKS).toContain('Noto Sans Medium');
    expect(BASEMAP_FONTSTACKS).toContain('Noto Sans Italic');
  });
});

describe('Β — Range (RFC 9110 §14), όπως τον ζητά το pmtiles', () => {
  it.each([
    [undefined, { kind: 'full' }],
    ['bytes=0-99', { kind: 'partial', start: 0, end: 99 }],
    ['bytes=100-', { kind: 'partial', start: 100, end: 999 }],
    ['bytes=-100', { kind: 'partial', start: 900, end: 999 }],
    ['bytes=990-5000', { kind: 'partial', start: 990, end: 999 }], // κόβεται στο τέλος
    ['bytes=1000-1001', { kind: 'unsatisfiable' }],
    ['bytes=-0', { kind: 'unsatisfiable' }],
    ['bytes=0-10,20-30', { kind: 'full' }], // πολλαπλά εύρη ⇒ 200 ολόκληρο (επιτρεπτό)
    ['items=0-10', { kind: 'full' }],
  ] as const)('%s', (header, expected) => {
    expect(parseByteRange(header, 1000)).toEqual(expected);
  });
});

describe('Γ — η προβολή του Caddyfile στο compose του Coolify', () => {
  /** Οι οδηγίες χωρίς σχόλια, κενές γραμμές και εσοχή — ό,τι όντως εκτελεί ο Caddy. */
  function directives(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  }

  it('ίδιες οδηγίες, ίδια σειρά', () => {
    const caddyfile = directives(readFileSync(join(INFRA, 'Caddyfile'), 'utf8'));
    const compose = readFileSync(join(INFRA, 'docker-compose.yml'), 'utf8');
    const inline = compose.slice(compose.indexOf('content: |') + 'content: |'.length);
    expect(directives(inline)).toEqual(caddyfile);
  });

  it('ΚΑΜΙΑ συμπίεση — τα πλακίδια είναι ήδη gzip και ένα 206 δεν ξανασυμπιέζεται', () => {
    expect(readFileSync(join(INFRA, 'Caddyfile'), 'utf8')).not.toMatch(/^\s*encode\b/m);
  });

  it('immutable cache + CORS που εκθέτει τα headers του Range', () => {
    const caddyfile = readFileSync(join(INFRA, 'Caddyfile'), 'utf8');
    expect(caddyfile).toContain('immutable');
    expect(caddyfile).toMatch(/Access-Control-Expose-Headers "[^"]*Content-Range/);
  });
});
