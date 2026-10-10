/**
 * Tests for the pure wall typer (ADR-412 · ADR-911 Φ3).
 *
 * The typer is what lets the stamp run INSIDE the build: it must be idempotent,
 * share one minted type per signature, and never report a type no surviving wall uses.
 *
 * @see ../wall-typer.ts
 */

import type { WallEntity } from '../../types/wall-types';
import { getDefaultDnaForCategory } from '../../types/wall-dna-types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { buildAutoWallType } from '../auto-wall-type';
import { getBuiltInWallTypeId, getBuiltInWallTypes } from '../built-in-types';
import { createPreviewWallTyper, createWallTyper, type AutoWallTypeMint } from '../wall-typer';

const COMPANY = 'co-1';
const OWNER = 'user-1';
const CATALOG = getBuiltInWallTypes(COMPANY);

/** A manual-thickness wall (no DNA, no type) — what a region fill produces. */
function wall(thicknessMm: number, y = 0): WallEntity {
  const params = buildDefaultWallParams({ x: 0, y }, { x: 4000, y }, { thickness: thicknessMm });
  const built = buildWallEntity(params, 'lvl', 'straight', 'mm');
  if (!built.ok) throw new Error(`fixture wall rejected: ${built.hardErrors.join(',')}`);
  return built.entity;
}

function countingMint(): { readonly mint: AutoWallTypeMint; readonly calls: () => number } {
  let n = 0;
  return {
    mint: (category, thicknessMm) => {
      n += 1;
      return buildAutoWallType(`minted-${n}`, category, thicknessMm, COMPANY, OWNER);
    },
    calls: () => n,
  };
}

describe('createWallTyper — find or mint', () => {
  it('leaves an already-typed wall untouched (same reference)', () => {
    const typed = { ...wall(137), typeId: 'some-type' };
    const { mint, calls } = countingMint();
    expect(createWallTyper({ types: CATALOG, mint }).typeWall(typed)).toBe(typed);
    expect(calls()).toBe(0);
  });

  it('two walls of the same signature share ONE minted type', () => {
    const { mint, calls } = countingMint();
    const typer = createWallTyper({ types: CATALOG, mint });
    const a = typer.typeWall(wall(137.2));
    const b = typer.typeWall(wall(136.9, 5000));
    expect(calls()).toBe(1);
    expect(a.typeId).toBe('minted-1');
    expect(b.typeId).toBe('minted-1');
    expect(typer.mintedFor([a, b])).toHaveLength(1);
  });

  it('reuses a persisted auto type instead of minting', () => {
    const existing = buildAutoWallType('auto-existing', 'exterior', 137, COMPANY, OWNER);
    const { mint, calls } = countingMint();
    const typer = createWallTyper({ types: [...CATALOG, existing], mint });
    const typed = typer.typeWall(wall(137));
    expect(typed.typeId).toBe('auto-existing');
    expect(calls()).toBe(0);
    expect(typer.mintedFor([typed])).toEqual([]);
  });

  it('links a wall at a category default thickness to the read-only built-in', () => {
    const defaultThickness = getDefaultDnaForCategory('exterior').totalThickness;
    const { mint, calls } = countingMint();
    const typed = createWallTyper({ types: CATALOG, mint }).typeWall(wall(defaultThickness));
    expect(typed.typeId).toBe(getBuiltInWallTypeId('exterior'));
    expect(calls()).toBe(0);
  });

  it('catalog not seeded ⇒ a built-in match stays ad-hoc (never a minted duplicate)', () => {
    const defaultThickness = getDefaultDnaForCategory('exterior').totalThickness;
    const { mint, calls } = countingMint();
    const input = wall(defaultThickness);
    expect(createWallTyper({ types: [], mint }).typeWall(input)).toBe(input);
    expect(calls()).toBe(0);
  });

  it('cannot mint (auth not ready) ⇒ the wall stays ad-hoc, no throw', () => {
    const typer = createWallTyper({ types: CATALOG, mint: null });
    const input = wall(137);
    expect(typer.typeWall(input)).toBe(input);
    expect(typer.mintedFor([input])).toEqual([]);
  });
});

describe('createWallTyper — «type always wins»', () => {
  it('applies the nominal thickness and the generic DNA, and recomputes the geometry', () => {
    const { mint } = countingMint();
    const input = wall(137.4);
    const typed = createWallTyper({ types: CATALOG, mint }).typeWall(input);
    expect(input.params.dna).toBeUndefined();
    expect(typed.params.thickness).toBe(137);
    expect(typed.params.dna?.totalThickness).toBe(137);
    expect(typed.geometry).not.toBe(input.geometry);
    // Instance fields survive the stamp.
    expect(typed.params.start).toEqual(input.params.start);
    expect(typed.params.end).toEqual(input.params.end);
    expect(typed.params.height).toBe(input.params.height);
  });
});

describe('mintedFor — only what the surviving walls reference', () => {
  it('a type minted for a wall that was later dropped is NOT reported', () => {
    const { mint } = countingMint();
    const typer = createWallTyper({ types: CATALOG, mint });
    const kept = typer.typeWall(wall(137));
    const dropped = typer.typeWall(wall(183, 5000));
    expect(dropped.typeId).toBe('minted-2');
    expect(typer.mintedFor([kept]).map((t) => t.id)).toEqual(['minted-1']);
    expect(typer.mintedFor([])).toEqual([]);
  });
});

describe('createPreviewWallTyper — same geometry, throw-away ids', () => {
  it('previews exactly the params a real typer would write', () => {
    const { mint } = countingMint();
    const real = createWallTyper({ types: CATALOG, mint }).typeWall(wall(137.4));
    const preview = createPreviewWallTyper(CATALOG).typeWall(wall(137.4));
    expect(preview.params).toEqual(real.params);
    expect(preview.geometry).toEqual(real.geometry);
    expect(preview.typeId).toMatch(/^draft:/);
    expect(preview.typeId).not.toBe(real.typeId);
  });
});
