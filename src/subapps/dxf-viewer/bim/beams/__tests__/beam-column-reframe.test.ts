/**
 * Tests for beam-column-reframe (ADR-492).
 *
 * Pure stored re-frame: όταν μετακινείται μια κολώνα, το άκρο του δοκαριού που την
 * πλαισιώνει (frame-into) επανα-κόβεται στην κοντινή παρειά της. mm scene.
 *
 * Beam axis (0,0)→(4000,0), width 250 (half-band y∈[-125,125]). Columns: square
 * footprint half-size `h` centred at (cx,cy) → near face toward span = cx ± h.
 */

import { reframeBeamEndpointsToColumns } from '../beam-column-reframe';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';

function beam(
  startPoint: { x: number; y: number; z?: number },
  endPoint: { x: number; y: number; z?: number },
  kind: 'straight' | 'cantilever' | 'curved' = 'straight',
): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind,
    params: {
      kind,
      startPoint: { x: startPoint.x, y: startPoint.y, z: startPoint.z ?? 0 },
      endPoint: { x: endPoint.x, y: endPoint.y, z: endPoint.z ?? 0 },
      width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** Square-footprint column (mm) centred at (cx,cy), half-size `h`. */
function column(id: string, cx: number, cy: number, h = 200): ColumnEntity {
  return {
    id, type: 'column', kind: 'rectangular',
    params: { kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, sceneUnits: 'mm' },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - h, y: cy - h, z: 0 },
          { x: cx + h, y: cy - h, z: 0 },
          { x: cx + h, y: cy + h, z: 0 },
          { x: cx - h, y: cy + h, z: 0 },
        ],
      },
    },
  } as unknown as ColumnEntity;
}

describe('reframeBeamEndpointsToColumns', () => {
  it('pulls both endpoints to the near faces (center-to-center axis → face-to-face)', () => {
    // Beam stored end-to-end στα κέντρα· κολώνες half 200 → παρειές 200 & 3800.
    const b = beam({ x: 0, y: 0 }, { x: 4000, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 4000, 0, 200)];
    const r = reframeBeamEndpointsToColumns(b, cols);
    expect(r).not.toBeNull();
    expect(r!.startPoint).toEqual({ x: 200, y: 0, z: 0 });
    expect(r!.endPoint).toEqual({ x: 3800, y: 0, z: 0 });
  });

  it('THE BUG: μετακίνηση δεξιάς κολώνας προς τα μέσα → το άκρο ακολουθεί (όχι stub)', () => {
    // Δοκάρι ήδη framed (200..3800). Η δεξιά κολώνα μετακινήθηκε 4000→3000 (παρειά 2800).
    // Το stored end (3800) προεξέχει → reframe το τραβά στο 2800.
    const b = beam({ x: 200, y: 0 }, { x: 3800, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 3000, 0, 200)];
    const r = reframeBeamEndpointsToColumns(b, cols);
    expect(r).not.toBeNull();
    expect(r!.startPoint).toEqual({ x: 200, y: 0, z: 0 });
    expect(r!.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
  });

  it('idempotent: ήδη στις παρειές → null (μηδέν churn)', () => {
    const b = beam({ x: 200, y: 0 }, { x: 2800, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 3000, 0, 200)];
    expect(reframeBeamEndpointsToColumns(b, cols)).toBeNull();
  });

  it('επιμηκύνεται πίσω όταν η κολώνα γυρίζει έξω (follow ΚΑΙ προς τα έξω)', () => {
    // Δοκάρι κομμένο στο 2800· η κολώνα ξαναγυρίζει 3000→4000 → end επιστρέφει 3800.
    const b = beam({ x: 200, y: 0 }, { x: 2800, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 4000, 0, 200)];
    const r = reframeBeamEndpointsToColumns(b, cols);
    expect(r).not.toBeNull();
    expect(r!.endPoint).toEqual({ x: 3800, y: 0, z: 0 });
  });

  it('cantilever / μία στήριξη: κόβει μόνο το άκρο στήριξης, ελεύθερο άκρο αμετάβλητο', () => {
    const b = beam({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'cantilever');
    const cols = [column('c1', 0, 0, 200)]; // στήριξη μόνο στο start
    const r = reframeBeamEndpointsToColumns(b, cols);
    expect(r).not.toBeNull();
    expect(r!.startPoint).toEqual({ x: 200, y: 0, z: 0 });
    expect(r!.endPoint).toEqual({ x: 4000, y: 0, z: 0 });
  });

  it('κολώνα φεύγει εκτός δοκαριού (perp) → άκρο σταματά να ακολουθεί (null αν τίποτα άλλο)', () => {
    // c2 μετακινήθηκε εκτός band (y=5000) → δεν frame-άρει· c1 ήδη στην παρειά → null.
    const b = beam({ x: 200, y: 0 }, { x: 3800, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 3000, 5000, 200)];
    expect(reframeBeamEndpointsToColumns(b, cols)).toBeNull();
  });

  it('διατηρεί την perpendicular justification (edge beam — κινεί μόνο κατά μήκος του άξονα)', () => {
    // Άξονας στο y=50 (εντός band 125)· το νέο άκρο κρατά y=50.
    const b = beam({ x: 0, y: 50 }, { x: 4000, y: 50 });
    const cols = [column('c1', 0, 0, 200), column('c2', 4000, 0, 200)];
    const r = reframeBeamEndpointsToColumns(b, cols);
    expect(r).not.toBeNull();
    expect(r!.startPoint).toEqual({ x: 200, y: 50, z: 0 });
    expect(r!.endPoint).toEqual({ x: 3800, y: 50, z: 0 });
  });

  it('curved beam → null (DEFER, parity ADR-458)', () => {
    const b = beam({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'curved');
    const cols = [column('c1', 0, 0, 200), column('c2', 4000, 0, 200)];
    expect(reframeBeamEndpointsToColumns(b, cols)).toBeNull();
  });

  it('καμία framed κολώνα → null', () => {
    const b = beam({ x: 0, y: 0 }, { x: 4000, y: 0 });
    expect(reframeBeamEndpointsToColumns(b, [])).toBeNull();
    // off-axis κολώνες
    expect(reframeBeamEndpointsToColumns(b, [column('c1', 2000, 5000, 200)])).toBeNull();
  });

  it('degenerate guard: στηρίξεις πολύ κοντά → δεν παράγει εκφυλισμένο δοκάρι (null)', () => {
    // Κοντό δοκάρι 0→400· c1@0 (παρειά 200) start, c2@400 (παρειά 200) end →
    // eProj-sProj = 200-200 = 0 < MIN_BEAM_LENGTH → identity.
    const b = beam({ x: 0, y: 0 }, { x: 400, y: 0 });
    const cols = [column('c1', 0, 0, 200), column('c2', 400, 0, 200)];
    expect(reframeBeamEndpointsToColumns(b, cols)).toBeNull();
  });
});
