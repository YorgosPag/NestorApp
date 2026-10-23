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
 *
 * 🔑 Σ1 reads SOURCE TEXT on purpose: the type catches the same mistake at compile time, but agents do
 * not run `tsc` (N.17) — the anchor catches it in jest. The human messages (el/en) join in Β3β, with
 * the UI that shows them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ListingTerrainRejection } from '../listing-terrain-types';
import {
  TERRAIN_REFUSAL_CODES,
  isTerrainRefusalCode,
  refusalOfTerrainRejection,
} from '../terrain-publication-contract';

const SRC = join(__dirname, '..', '..', '..', '..');
const DOOR_SOURCE = readFileSync(join(SRC, 'app/api/properties/[id]/terrain/route.ts'), 'utf8');

const REJECTIONS: readonly ListingTerrainRejection[] = ['insufficient-surface', 'empty-after-clip', 'too-dense'];

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

  it('Σ4 only the list passes', () => {
    expect(isTerrainRefusalCode('TERRAIN_TOO_DENSE')).toBe(true);
    expect(isTerrainRefusalCode('TERRAIN_SOMETHING_ELSE')).toBe(false);
    expect(isTerrainRefusalCode('FLOORPLAN_SHELF_FULL')).toBe(false);
    expect(isTerrainRefusalCode(undefined)).toBe(false);
  });
});
