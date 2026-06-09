/**
 * ADR-422 L7.2 — tests για τον προσανατολισμό κουφωμάτων στον resolver (wiring).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Εστιάζει στο ότι κάθε **εξωτ. κούφωμα** παίρνει `azimuthDeg` από το εξωτερικό
 * normal του footprint του χώρου (νότιος τοίχος → ~180, ανατολικός → ~90), ενώ
 * τοίχοι/δάπεδο/οροφή το αφήνουν absent. Η ακριβής αριθμητική του αζιμουθίου
 * καλύπτεται από το `polygon-utils-azimuth.test.ts`.
 *
 * Coords σε mm (sceneUnits 'mm'): τετράγωνο 4×4 m, CCW. Νότιος τοίχος κατά y=0,
 * ανατολικός κατά x=4000· από ένα παράθυρο σε κάθε έναν.
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import { createOpening } from '@/services/factories/opening.factory';
import {
  buildDefaultWallParams,
  buildWallEntity,
} from '../../../../hooks/drawing/wall-completion';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
} from '../../../types/thermal-space-types';
import type { OpeningEntity, OpeningGeometry } from '../../../types/opening-types';
import type { WallEntity } from '../../../types/wall-types';
import { resolveSpaceBoundaries, type SpaceBoundaryContext } from '../space-boundary-resolver';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

/** Τετράγωνος χώρος 4×4 m (CCW, mm) — όριο στον άξονα των τοίχων. */
function makeSpace(): ThermalSpaceEntity {
  const params = {
    footprint: {
      vertices: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    },
    useType: 'living-room' as const,
    ceilingHeightMm: 3000,
    sceneUnits: 'mm' as const,
  };
  return createThermalSpace({
    id: 'sp-1',
    params,
    geometry: computeThermalSpaceGeometry(params),
    layerId: 'L',
  });
}

function makeWall(start: { x: number; y: number }, end: { x: number; y: number }, id: string): WallEntity {
  const params = buildDefaultWallParams(start, end);
  const result = buildWallEntity(params, 'L', 'straight');
  if (!result.ok) throw new Error('Failed to build wall: ' + result.hardErrors.join(', '));
  return { ...result.entity, id };
}

/** Κούφωμα με χειροποίητο geometry: κέντρο cutout `(cx,cy)`, εμβαδό `areaM2`. */
function makeWindow(id: string, wallId: string, cx: number, cy: number): OpeningEntity {
  const geometry: OpeningGeometry = {
    position: { x: cx, y: cy },
    rotation: 0,
    outline: {
      vertices: [
        { x: cx - 500, y: cy },
        { x: cx + 500, y: cy },
        { x: cx + 500, y: cy },
        { x: cx - 500, y: cy },
      ],
    },
    bbox: { min: { x: cx - 500, y: cy - 100 }, max: { x: cx + 500, y: cy + 100 } },
    area: 2,
    perimeter: 4,
  };
  return createOpening({
    id,
    params: { kind: 'window', wallId, offsetFromStart: 1500, width: 1000, height: 1500, sillHeight: 900 },
    geometry,
    layerId: 'L',
  });
}

function makeCtx(
  walls: WallEntity[],
  openings: OpeningEntity[],
  storeyPosition: SpaceBoundaryContext['storeyPosition'] = 'middle',
): SpaceBoundaryContext {
  return {
    walls,
    openings,
    exteriorWallIds: new Set(walls.map((w) => w.id)),
    storeyPosition, // 'middle' ⇒ δάπεδο/οροφή adjacent-heated (default)· 'highest'/'only' ⇒ εξωτ. στέγη
    tol: 150, // mm — αρκετό για το offset όψης τοίχου (±100)
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolveSpaceBoundaries — προσανατολισμός εξωτ. κουφωμάτων (L7.2)', () => {
  const southWall = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'wall-south');
  const eastWall = makeWall({ x: 4000, y: 0 }, { x: 4000, y: 4000 }, 'wall-east');
  const southWindow = makeWindow('win-south', 'wall-south', 2000, 0);
  const eastWindow = makeWindow('win-east', 'wall-east', 4000, 2000);

  const boundaries = resolveSpaceBoundaries(
    makeSpace(),
    makeCtx([southWall, eastWall], [southWindow, eastWindow]),
  );

  it('θέτει azimuthDeg ≈ 180 στον νότιο υαλοπίνακα', () => {
    const south = boundaries.find((b) => b.refId === 'win-south');
    expect(south?.kind).toBe('window');
    expect(south?.azimuthDeg).toBeCloseTo(180);
  });

  it('θέτει azimuthDeg ≈ 90 στον ανατολικό υαλοπίνακα', () => {
    const east = boundaries.find((b) => b.refId === 'win-east');
    expect(east?.kind).toBe('window');
    expect(east?.azimuthDeg).toBeCloseTo(90);
  });

  it('αφήνει το azimuthDeg/solarAbsorptance absent σε δάπεδο/οροφή (adjacent-heated)', () => {
    const slabs = boundaries.filter(
      (b) => b.kind === 'floor' || b.kind === 'roof' || b.kind === 'ceiling',
    );
    expect(slabs.length).toBeGreaterThan(0);
    for (const b of slabs) {
      expect(b.azimuthDeg).toBeUndefined();
      expect(b.solarAbsorptance).toBeUndefined();
    }
  });

  // L7.6 — οι εξωτ. τοίχοι γίνονται «συλλέκτες» ηλιακής (azimuth + ηλιακή απορρόφηση α_S)
  it('L7.6 — θέτει azimuthDeg + solarAbsorptance (default medium 0.6) στους εξωτ. τοίχους', () => {
    const south = boundaries.find((b) => b.kind === 'wall' && b.refId === 'wall-south');
    const east = boundaries.find((b) => b.kind === 'wall' && b.refId === 'wall-east');
    expect(south?.azimuthDeg).toBeCloseTo(180);
    expect(east?.azimuthDeg).toBeCloseTo(90);
    expect(south?.solarAbsorptance).toBeCloseTo(0.6);
    expect(east?.solarAbsorptance).toBeCloseTo(0.6);
  });
});

// L7.7 — η εξωτ. στέγη (ψηλότερος όροφος) γίνεται «συλλέκτης» ηλιακής (α_S, οριζόντια)
describe('resolveSpaceBoundaries — ηλιακή απορρόφηση εξωτ. στέγης (L7.7)', () => {
  const southWall = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'wall-south');

  it('θέτει solarAbsorptance (default medium 0.6) + azimuth undefined στη roof external-air (highest)', () => {
    const boundaries = resolveSpaceBoundaries(
      makeSpace(),
      makeCtx([southWall], [], 'highest'),
    );
    const roof = boundaries.find((b) => b.kind === 'roof');
    expect(roof?.condition).toBe('external-air');
    expect(roof?.solarAbsorptance).toBeCloseTo(0.6);
    expect(roof?.azimuthDeg).toBeUndefined(); // οριζόντια — βλέπει όλο τον ουρανό
  });

  it('αφήνει solarAbsorptance absent στην εσωτ. οροφή (ceiling / adjacent-heated, middle)', () => {
    const boundaries = resolveSpaceBoundaries(
      makeSpace(),
      makeCtx([southWall], [], 'middle'),
    );
    const ceiling = boundaries.find((b) => b.kind === 'ceiling' || b.kind === 'roof');
    expect(ceiling?.kind).toBe('ceiling');
    expect(ceiling?.condition).toBe('adjacent-heated');
    expect(ceiling?.solarAbsorptance).toBeUndefined();
  });
});

// L1.6 — EN ISO 13370 ground coupling: το δάπεδο επί εδάφους με εκτεθειμένη περίμετρο
// παίρνει effective U_g (όχι default 0.5) + override `b`=1.0· χωρίς εξωτ. τοίχους → flat.
describe('resolveSpaceBoundaries — EN ISO 13370 ground coupling (L1.6)', () => {
  // 4×4 m (mm): 4 εξωτ. τοίχοι → P≈16 m, A=16 m² → B′≈2.0 → U_g≈0.355 W/m²K.
  const south = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'w-s');
  const east = makeWall({ x: 4000, y: 0 }, { x: 4000, y: 4000 }, 'w-e');
  const north = makeWall({ x: 4000, y: 4000 }, { x: 0, y: 4000 }, 'w-n');
  const west = makeWall({ x: 0, y: 4000 }, { x: 0, y: 0 }, 'w-w');
  const allWalls = [south, east, north, west];

  it("'only' με 4 εξωτ. τοίχους → δάπεδο ground με U_g (≈0.355) + groundTemperatureFactor=1.0", () => {
    const boundaries = resolveSpaceBoundaries(makeSpace(), makeCtx(allWalls, [], 'only'));
    const floor = boundaries.find((b) => b.kind === 'floor');
    expect(floor?.condition).toBe('ground');
    expect(floor?.groundTemperatureFactor).toBe(1.0);
    // U_g εξαρτάται ελαφρώς από το length-weighted πάχος τοίχου (d_t) — εύρος γύρω από 0.355.
    expect(floor?.uValue).toBeGreaterThan(0.34);
    expect(floor?.uValue).toBeLessThan(0.38);
    // ΟΧΙ πια το flat default 0.5.
    expect(floor?.uValue).toBeLessThan(0.5);
  });

  it("'lowest' με 4 εξωτ. τοίχους → ground coupling εφαρμόζεται (lowest=επί εδάφους)", () => {
    const boundaries = resolveSpaceBoundaries(makeSpace(), makeCtx(allWalls, [], 'lowest'));
    const floor = boundaries.find((b) => b.kind === 'floor');
    expect(floor?.condition).toBe('ground');
    expect(floor?.groundTemperatureFactor).toBe(1.0);
  });

  it('χωρίς εξωτ. τοίχους (P=0) → fallback flat: uValue=0.5, χωρίς override (zero-regression)', () => {
    const ctx: SpaceBoundaryContext = { ...makeCtx(allWalls, [], 'only'), exteriorWallIds: new Set() };
    const boundaries = resolveSpaceBoundaries(makeSpace(), ctx);
    const floor = boundaries.find((b) => b.kind === 'floor');
    expect(floor?.condition).toBe('ground');
    expect(floor?.uValue).toBeCloseTo(0.5, 6);
    expect(floor?.groundTemperatureFactor).toBeUndefined();
  });

  it("'middle' (ενδιάμεσος όροφος) → δάπεδο adjacent-heated, χωρίς ground coupling", () => {
    const boundaries = resolveSpaceBoundaries(makeSpace(), makeCtx(allWalls, [], 'middle'));
    const floor = boundaries.find((b) => b.kind === 'floor');
    expect(floor?.condition).toBe('adjacent-heated');
    expect(floor?.groundTemperatureFactor).toBeUndefined();
    expect(floor?.uValue).toBeCloseTo(0.5, 6);
  });
});
