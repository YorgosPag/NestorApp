/**
 * ADR-363 Phase 4 — `useColumnTool` state-machine tests.
 *
 * Coverage:
 *   - activate → 'awaitingPosition'
 *   - 1st click → awaitingRotation (locks position, no commit) — ADR-398 §3.10b 2-click ΠΑΝΤΑ
 *   - 2nd click → onColumnCreated fires + remains in awaitingPosition (chain)
 *   - cycleAnchor advances through ANCHOR_CYCLE_ORDER
 *   - cycleAnchor(-1) reverses
 *   - setKind preserves anchor + overrides
 *   - deactivate → 'idle'
 *   - status text key changes per phase
 */

import { renderHook, act } from '@testing-library/react';
import { useColumnTool } from '../useColumnTool';
import {
  ANCHOR_CYCLE_ORDER,
  type ColumnEntity,
} from '../../../bim/types/column-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LWPolylineEntity } from '../../../types/entities';

describe('useColumnTool', () => {
  it('initial state is idle until activated', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('activate transitions to awaitingPosition', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.phase).toBe('awaitingPosition');
    expect(result.current.isActive).toBe(true);
  });

  // ADR-398 §3.10b (2026-06-22, Giorgio): η κολώνα είναι **2-click ΠΑΝΤΑ** (mirror τοίχου) — το 1ο
  // κλικ κλειδώνει θέση+λαβή (→ awaitingRotation), το 2ο ορίζει τη γωνία και κάνει commit. ΠΟΤΕ
  // single-click commit (regression fix: §3.13 Polar / §3.15 Cartesian face-anchor → single-click παντού).
  it('first click locks position → awaitingRotation, does NOT commit', () => {
    const onColumnCreated = jest.fn();
    const { result } = renderHook(() => useColumnTool({ onColumnCreated }));
    act(() => result.current.activate());
    let committed = true;
    act(() => {
      committed = result.current.onCanvasClick({ x: 1000, y: 2000 });
    });
    expect(committed).toBe(false);
    expect(onColumnCreated).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('awaitingRotation');
  });

  it('second click commits column (place+rotate) and chains back to awaitingPosition', () => {
    const onColumnCreated = jest.fn();
    const { result } = renderHook(() => useColumnTool({ onColumnCreated }));
    act(() => result.current.activate());
    act(() => {
      result.current.onCanvasClick({ x: 1000, y: 2000 }); // 1ο κλικ → θέση
    });
    let committed = false;
    act(() => {
      committed = result.current.onCanvasClick({ x: 2000, y: 2000 }); // 2ο κλικ → γωνία
    });
    expect(committed).toBe(true);
    expect(onColumnCreated).toHaveBeenCalledTimes(1);
    const entity = onColumnCreated.mock.calls[0][0] as ColumnEntity;
    expect(entity.type).toBe('column');
    expect(entity.kind).toBe('rectangular');
    expect(result.current.state.phase).toBe('awaitingPosition');
  });

  it('cycleAnchor advances forward through ANCHOR_CYCLE_ORDER', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[0]);
    act(() => result.current.cycleAnchor());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[1]);
    act(() => result.current.cycleAnchor());
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[2]);
  });

  it('cycleAnchor(-1) reverses', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.cycleAnchor(-1));
    expect(result.current.state.anchor).toBe(ANCHOR_CYCLE_ORDER[ANCHOR_CYCLE_ORDER.length - 1]);
  });

  it('setKind preserves anchor and overrides', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.setAnchor('nw'));
    act(() => result.current.setParamOverrides({ width: 500 }));
    act(() => result.current.setKind('circular'));
    expect(result.current.state.kind).toBe('circular');
    expect(result.current.state.anchor).toBe('nw');
    expect(result.current.state.overrides.width).toBe(500);
  });

  it('deactivate returns to idle', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('status text key changes per phase', () => {
    const { result } = renderHook(() => useColumnTool({ onColumnCreated: jest.fn() }));
    expect(result.current.getStatusText()).toBe('');
    act(() => result.current.activate());
    expect(result.current.getStatusText()).toBe('tools.column.statusPosition');
  });

});

// ADR-419 v1.5 — «Κολώνα μέσα σε περιοχή» (`column-region-inside`): click-inside σε
// ΚΛΕΙΣΤΟ περίγραμμα. rectangle-first (findEnclosingRectangle)· αν ΔΕΝ βρεθεί ορθογώνιο
// (π.χ. «Γ» με κεκλιμένο σκέλος / αμβλεία γωνία) → fallback στο ΙΔΙΟ loop-detector που
// τροφοδοτεί το hover-preview (`pickRegionPerimeterAt`) → composite ColumnEntity (preview≡commit).
describe('useColumnTool — in-region/inside non-rectangular fallback (ADR-419 v1.5)', () => {
  const lwPolyline = (id: string, verts: Point2D[]): LWPolylineEntity =>
    ({ id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed: true } as LWPolylineEntity);

  // Γ με ΚΕΚΛΙΜΕΝΟ κάθετο σκέλος (μη-κάθετες γωνίες → όχι ορθογώνιο) — το use-case του Giorgio.
  const OBTUSE_L: Point2D[] = [
    { x: 0, y: 0 },
    { x: 3000, y: 0 },
    { x: 3000, y: 300 },
    { x: 800, y: 300 },
    { x: 300, y: 3000 },
    { x: 0, y: 3000 },
  ];

  // Απλό ορθογώνιο 1000×800 (aspect 1.25 → rectangular, υπάρχουσα συμπεριφορά).
  const RECT: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 800 },
    { x: 0, y: 800 },
  ];

  const renderInRegionInside = (entities: Entity[]) => {
    const onColumnsCreated = jest.fn<void, [readonly ColumnEntity[]]>();
    const hook = renderHook(() =>
      useColumnTool({
        onColumnsCreated,
        getSceneUnits: () => 'mm',
        getSceneEntities: () => entities,
      }),
    );
    act(() => hook.result.current.activate());
    act(() => hook.result.current.setPlacementMode('in-region'));
    act(() => hook.result.current.setRegionMethod('inside'));
    return { ...hook, onColumnsCreated };
  };

  it('click μέσα σε «Γ» (αμβλεία γωνία, ΟΧΙ ορθογώνιο) → ΕΝΑ composite ColumnEntity', () => {
    const { result, onColumnsCreated } = renderInRegionInside([lwPolyline('L', OBTUSE_L)]);
    let handled = false;
    act(() => {
      handled = result.current.onCanvasClick({ x: 150, y: 150 }); // εντός της γωνίας του Γ
    });
    expect(handled).toBe(true);
    expect(onColumnsCreated).toHaveBeenCalledTimes(1);
    const built = onColumnsCreated.mock.calls[0][0];
    expect(built).toHaveLength(1);
    expect(built[0].type).toBe('column');
    expect(built[0].params.kind).toBe('composite');
  });

  it('click μέσα σε ορθογώνιο → rectangular (rectangle-first, καμία regression)', () => {
    const { result, onColumnsCreated } = renderInRegionInside([lwPolyline('R', RECT)]);
    act(() => {
      result.current.onCanvasClick({ x: 500, y: 400 });
    });
    expect(onColumnsCreated).toHaveBeenCalledTimes(1);
    const built = onColumnsCreated.mock.calls[0][0];
    expect(built).toHaveLength(1);
    expect(built[0].params.kind).toBe('rectangular');
  });

  it('click σε κενό χώρο (κανένα περίγραμμα) → no-op, καμία κολώνα', () => {
    const { result, onColumnsCreated } = renderInRegionInside([lwPolyline('L', OBTUSE_L)]);
    let handled = true;
    act(() => {
      handled = result.current.onCanvasClick({ x: 50000, y: 50000 }); // μακριά, εκτός loop
    });
    expect(handled).toBe(false);
    expect(onColumnsCreated).not.toHaveBeenCalled();
  });
});
