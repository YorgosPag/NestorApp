/**
 * Entity Render Coverage (ADR-550 Φ3).
 *
 * Δένει το δηλωτικό μητρώο (`ENTITY_RENDER_SURFACES`) με τα ΖΩΝΤΑΝΑ dispatchers:
 *  - 2D: `EntityRendererComposite.getSupportedEntityTypes()` (live introspection)
 *  - 3D: `BIM_3D_CONVERTER_TYPES` (SSoT των `BimSceneLayer.sync*()` οικογενειών)
 *
 * Εγγυάται:
 *  1. Κάθε δηλωμένο `d2`/`d3` ΟΝΤΩΣ υπάρχει στον αντίστοιχο dispatcher (no lie).
 *  2. Κάθε registered/converted type είναι δηλωμένο (no orphan).
 *  3. Συμμετρία: κάθε BIM type (εκτός των ρητών 2D-only) έχει ΚΑΙ 2D ΚΑΙ 3D —
 *     ώστε «οντότητα που φαίνεται 2D αλλά όχι 3D» να σπάει το build.
 */

// Firebase auth mock — κάποιοι entity renderers αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { EntityRendererComposite } from '../../core/EntityRendererComposite';
import {
  BIM_RENDERABLE_TYPES,
  DXF_RENDERABLE_TYPES,
  RENDERABLE_ENTITY_TYPES,
} from '../renderable-entity-type';
import { ENTITY_RENDER_SURFACES, BIM_2D_ONLY_TYPES } from '../entity-render-surfaces';
import {
  ENTITY_RENDER_CONTRACTS,
  POINT_BUILT_TYPES,
  BESPOKE_BUILT_TYPES,
  GHOST_BUILT_TYPES,
} from '../entity-render-contract';
import { BIM_3D_CONVERTER_TYPES } from '../../../bim-3d/scene/bim-3d-renderable-types';
import { POINT_CONTRACT_TYPES } from '../../../bim-3d/scene/bim-scene-point-contracts';
import {
  PLACEMENT_GHOST_3D_FACTORIES,
  PLACEMENT_GHOST_3D_TYPES,
} from '../../../bim-3d/placement/placement-ghost-3d-contracts';
import { ColumnPlacementGhost } from '../../../bim-3d/placement/ColumnPlacementGhost';
import { WallPlacementGhost } from '../../../bim-3d/placement/WallPlacementGhost';
import { BeamFromWallGhost } from '../../../bim-3d/placement/BeamFromWallGhost';
import { FurniturePlacementGhost } from '../../../bim-3d/placement/FurniturePlacementGhost';
import { GenericSolidPlacementGhost } from '../../../bim-3d/placement/GenericSolidPlacementGhost';
import { ElectricalPanelPlacementGhost } from '../../../bim-3d/placement/ElectricalPanelPlacementGhost';
import { MepFixturePlacementGhost } from '../../../bim-3d/placement/MepFixturePlacementGhost';
import { MepSegmentPlacementGhost } from '../../../bim-3d/placement/MepSegmentPlacementGhost';
import { MepManifoldPlacementGhost } from '../../../bim-3d/placement/MepManifoldPlacementGhost';
import { MepRadiatorPlacementGhost } from '../../../bim-3d/placement/MepRadiatorPlacementGhost';
import { MepBoilerPlacementGhost } from '../../../bim-3d/placement/MepBoilerPlacementGhost';
import { MepWaterHeaterPlacementGhost } from '../../../bim-3d/placement/MepWaterHeaterPlacementGhost';
import * as THREE from 'three';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

function createMockCtx(): CanvasRenderingContext2D {
  const canvas = {
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({
      left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0,
      toJSON: () => ({}),
    }),
  };
  return { canvas } as unknown as CanvasRenderingContext2D;
}

function supported2DTypes(): Set<string> {
  const composite = new EntityRendererComposite(createMockCtx());
  return new Set(composite.getSupportedEntityTypes());
}

describe('Entity render coverage — declarative registry ↔ live dispatchers (ADR-550 Φ3)', () => {
  describe('2D — EntityRendererComposite', () => {
    const live = supported2DTypes();

    it('κάθε δηλωμένο d2:true είναι registered στο live 2D composite', () => {
      const declared2D = RENDERABLE_ENTITY_TYPES.filter((t) => ENTITY_RENDER_SURFACES[t].d2);
      const missing = declared2D.filter((t) => !live.has(t));
      expect(missing).toEqual([]);
    });

    it('κάθε live-registered type είναι δηλωμένο στο canonical μητρώο (no orphan)', () => {
      const canonical = new Set<string>(RENDERABLE_ENTITY_TYPES);
      const orphan = [...live].filter((t) => !canonical.has(t));
      expect(orphan).toEqual([]);
    });
  });

  describe('3D — BimSceneLayer converter types', () => {
    const live3D = new Set<string>(BIM_3D_CONVERTER_TYPES);

    it('κάθε δηλωμένο d3:true έχει ζωντανό 3D converter', () => {
      const declared3D = RENDERABLE_ENTITY_TYPES.filter((t) => ENTITY_RENDER_SURFACES[t].d3);
      const missing = declared3D.filter((t) => !live3D.has(t));
      expect(missing).toEqual([]);
    });

    it('κάθε 3D converter type είναι δηλωμένο d3:true (no orphan)', () => {
      const notDeclared = BIM_3D_CONVERTER_TYPES.filter((t) => !ENTITY_RENDER_SURFACES[t].d3);
      expect(notDeclared).toEqual([]);
    });
  });

  describe('Συμμετρία 2D↔3D', () => {
    it('κάθε BIM type (εκτός των ρητών 2D-only) έχει ΚΑΙ 2D ΚΑΙ 3D', () => {
      const only2D = new Set<string>(BIM_2D_ONLY_TYPES);
      const asymmetric = BIM_RENDERABLE_TYPES
        .filter((t) => !only2D.has(t))
        .filter((t) => !(ENTITY_RENDER_SURFACES[t].d2 && ENTITY_RENDER_SURFACES[t].d3));
      expect(asymmetric).toEqual([]);
    });

    it('κάθε ρητός 2D-only type είναι d2:true και d3:false', () => {
      const wrong = BIM_2D_ONLY_TYPES.filter(
        (t) => !(ENTITY_RENDER_SURFACES[t].d2 && !ENTITY_RENDER_SURFACES[t].d3),
      );
      expect(wrong).toEqual([]);
    });
  });

  describe('DXF primitives', () => {
    it('όλοι οι DXF types είναι d2:true και d3:false (2D underlay μόνο)', () => {
      const wrong = DXF_RENDERABLE_TYPES.filter(
        (t) => !(ENTITY_RENDER_SURFACES[t].d2 && !ENTITY_RENDER_SURFACES[t].d3),
      );
      expect(wrong).toEqual([]);
    });
  });
});

describe('Entity Render Contract Registry (ADR-550 Φ2)', () => {
  describe('Invariants', () => {
    it('d3Builder !== "none" ⟺ d3 === true (κανένα 3D χωρίς builder, κανένας builder χωρίς 3D)', () => {
      const broken = RENDERABLE_ENTITY_TYPES.filter((t) => {
        const c = ENTITY_RENDER_CONTRACTS[t];
        return (c.d3Builder !== 'none') !== c.d3;
      });
      expect(broken).toEqual([]);
    });

    it('το derived ENTITY_RENDER_SURFACES ταυτίζεται με το contract (μία πηγή)', () => {
      const drift = RENDERABLE_ENTITY_TYPES.filter((t) => {
        const c = ENTITY_RENDER_CONTRACTS[t];
        const s = ENTITY_RENDER_SURFACES[t];
        return s.d2 !== c.d2 || s.d3 !== c.d3;
      });
      expect(drift).toEqual([]);
    });
  });

  describe('Auto-wiring binding: declaration ↔ executable point registry', () => {
    it('το σύνολο των d3Builder:"point" ταυτίζεται με τα types του POINT_ENTITY_CONTRACTS (no drift)', () => {
      expect(asSorted(POINT_CONTRACT_TYPES)).toEqual(asSorted(POINT_BUILT_TYPES));
    });

    it('point ∪ bespoke ταξινομεί ΑΚΡΙΒΩΣ τους ζωντανούς 3D converter types', () => {
      const classified = asSorted([...POINT_BUILT_TYPES, ...BESPOKE_BUILT_TYPES]);
      expect(classified).toEqual(asSorted(BIM_3D_CONVERTER_TYPES));
    });

    it('κανένας point type δεν είναι ταυτόχρονα bespoke (ξένα σύνολα)', () => {
      const bespoke = new Set<string>(BESPOKE_BUILT_TYPES);
      const overlap = POINT_BUILT_TYPES.filter((t) => bespoke.has(t));
      expect(overlap).toEqual([]);
    });
  });
});

describe('Φ-Ghost binding: declaration ↔ 3D ghost factory registry (ADR-550 Φ-Ghost)', () => {
  it('placementGhost3D ⟹ d3 (κανένα ghost χωρίς 3D geometry)', () => {
    const broken = RENDERABLE_ENTITY_TYPES.filter((t) => {
      const c = ENTITY_RENDER_CONTRACTS[t];
      return c.placementGhost3D && !c.d3;
    });
    expect(broken).toEqual([]);
  });

  it('το σύνολο των placementGhost3D:true ταυτίζεται με τα types του PLACEMENT_GHOST_3D_FACTORIES (no drift)', () => {
    expect(asSorted(PLACEMENT_GHOST_3D_TYPES)).toEqual(asSorted(GHOST_BUILT_TYPES));
  });

  it('κάθε factory παράγει instance της αντίστοιχης ghost class (liveness — no lie, no orphan)', () => {
    const scene = new THREE.Scene();
    const checks: Array<
      [keyof typeof PLACEMENT_GHOST_3D_FACTORIES, new (s: THREE.Scene) => { dispose(): void }]
    > = [
      ['column', ColumnPlacementGhost],
      ['wall', WallPlacementGhost],
      ['beam', BeamFromWallGhost],
      ['furniture', FurniturePlacementGhost],
      ['generic-solid', GenericSolidPlacementGhost],
      ['electrical-panel', ElectricalPanelPlacementGhost],
      ['mep-fixture', MepFixturePlacementGhost],
      ['mep-segment', MepSegmentPlacementGhost],
      ['mep-manifold', MepManifoldPlacementGhost],
      ['mep-radiator', MepRadiatorPlacementGhost],
      ['mep-boiler', MepBoilerPlacementGhost],
      ['mep-water-heater', MepWaterHeaterPlacementGhost],
    ];
    // Κάθε δηλωμένος ghost type έχει check (η λίστα καλύπτει όλο το registry).
    expect(asSorted(checks.map(([t]) => t))).toEqual(asSorted([...PLACEMENT_GHOST_3D_TYPES]));
    for (const [type, Cls] of checks) {
      const instance = PLACEMENT_GHOST_3D_FACTORIES[type](scene);
      expect(instance).toBeInstanceOf(Cls);
      instance.dispose();
    }
  });
});
