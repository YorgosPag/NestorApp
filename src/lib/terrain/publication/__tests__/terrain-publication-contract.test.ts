/**
 * @jest-environment node
 *
 * ADR-920 Β3 — anchors of the wire contract of «Publish terrain to the listing».
 *
 *   Σ1  every `TERRAIN_*` code the door can send — literals in its SOURCE plus the builder rejections
 *       it maps — is in the closed list
 *   Σ2  every code of the list is actually sent by the door — no phantom rows
 *   Σ3  every builder rejection maps to its own code (exhaustive, no two rejections share one)
 *   Σ4  `isTerrainRefusalCode` accepts only the list
 *   Σ5  every code has a human message in `el` AND `en` (`property-market` → `terrainPublication.refusals`),
 *       no message is orphaned, and every `{placeholder}` is the SAME in both languages and is a limit
 *       that `listing-terrain-config` owns — the copy never restates a number (Β3β, ADR-920 §12)
 *
 * 🔑 Σ1 reads SOURCE TEXT on purpose: the type catches the same mistake at compile time, but agents do
 * not run `tsc` (N.17) — the anchor catches it in jest. (Σ3 is the rejection map, so the messages are Σ5.)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LISTING_TERRAIN_MAX_TRIANGLES,
  LISTING_TERRAIN_SOURCE_MAX_BYTES,
  LISTING_TERRAIN_SOURCE_MAX_POINTS,
} from '../listing-terrain-config';
import type { ListingTerrainRejection } from '../listing-terrain-types';
import {
  TERRAIN_REFUSAL_CODES,
  isTerrainRefusalCode,
  refusalOfTerrainRejection,
} from '../terrain-publication-contract';

const SRC = join(__dirname, '..', '..', '..', '..');
/**
 * Everything a terrain door can send: each door's route PLUS the shared terrain request reader (ADR-920 Β4.3).
 * A code moved into the shared reader must stay visible here — otherwise Σ2 would call it a phantom.
 */
const DOOR_SOURCE = [
  'app/api/properties/[id]/terrain/route.ts',
  'app/api/owner-properties/[ownerPropertyId]/terrain/route.ts',
  'server/listing-terrain/terrain-upload.server.ts',
].map((file) => readFileSync(join(SRC, file), 'utf8')).join('\n');

const REJECTIONS: readonly ListingTerrainRejection[] = ['insufficient-surface', 'empty-after-clip', 'too-dense'];

/**
 * The values the UI interpolates — DERIVED from the config, so the copy never restates a number that
 * could drift. The owner form (Β4) and the viewer (Β5) pass exactly these.
 */
const MESSAGE_LIMITS: Readonly<Record<string, number>> = {
  maxMegabytes: LISTING_TERRAIN_SOURCE_MAX_BYTES / (1024 * 1024),
  maxPoints: LISTING_TERRAIN_SOURCE_MAX_POINTS,
  maxTriangles: LISTING_TERRAIN_MAX_TRIANGLES,
};

function refusalMessagesOf(language: 'el' | 'en'): Record<string, unknown> {
  const file = join(SRC, 'i18n', 'locales', language, 'property-market.json');
  const locale = JSON.parse(readFileSync(file, 'utf8')) as { terrainPublication?: { refusals?: Record<string, unknown> } };
  return locale.terrainPublication?.refusals ?? {};
}

/** ICU `{name}` placeholders, sorted. */
const placeholdersOf = (message: string): string[] =>
  [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

/** Quoted `'TERRAIN_…'` literals only — never constant names. */
const literalsOf = (source: string): string[] =>
  [...new Set([...source.matchAll(/'(TERRAIN_[A-Z_]+)'/g)].map((match) => match[1]))];

describe('ADR-920 Β3 — wire contract of the terrain publication', () => {
  it('Σ1+Σ2 the codes the door sends ARE the closed list — none more, none fewer', () => {
    const sent = new Set([...literalsOf(DOOR_SOURCE), ...REJECTIONS.map(refusalOfTerrainRejection)]);
    expect([...sent].sort()).toStrictEqual([...TERRAIN_REFUSAL_CODES].sort());
  });

  it('Σ3 each builder rejection has its own code', () => {
    const codes = REJECTIONS.map(refusalOfTerrainRejection);
    expect(new Set(codes).size).toBe(REJECTIONS.length);
    codes.forEach((code) => expect(isTerrainRefusalCode(code)).toBe(true));
  });

  it.each(['el', 'en'] as const)('Σ5 [%s] every code has a message, and no message is orphaned', (language) => {
    const messages = refusalMessagesOf(language);
    expect(Object.keys(messages).sort()).toStrictEqual([...TERRAIN_REFUSAL_CODES].sort());
    for (const code of TERRAIN_REFUSAL_CODES) {
      expect(typeof messages[code]).toBe('string');
      expect(String(messages[code]).trim().length).toBeGreaterThan(10);
    }
  });

  it('Σ5 the placeholders agree across languages and name a limit the config owns — none unused', () => {
    const el = refusalMessagesOf('el');
    const en = refusalMessagesOf('en');
    const used = new Set<string>();
    for (const code of TERRAIN_REFUSAL_CODES) {
      const names = placeholdersOf(String(el[code]));
      expect(placeholdersOf(String(en[code]))).toStrictEqual(names);
      names.forEach((name) => used.add(name));
    }
    expect([...used].sort()).toStrictEqual(Object.keys(MESSAGE_LIMITS).sort());
    Object.values(MESSAGE_LIMITS).forEach((value) => expect(Number.isFinite(value) && value > 0).toBe(true));
  });

  it('Σ4 only the list passes', () => {
    expect(isTerrainRefusalCode('TERRAIN_TOO_DENSE')).toBe(true);
    expect(isTerrainRefusalCode('TERRAIN_SOMETHING_ELSE')).toBe(false);
    expect(isTerrainRefusalCode('FLOORPLAN_SHELF_FULL')).toBe(false);
    expect(isTerrainRefusalCode(undefined)).toBe(false);
  });
});
