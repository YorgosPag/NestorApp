/**
 * ADR-377 Phase E — bim-three-edges (3D edge-attach SSoT) tests.
 *
 * Verifies the parity contract: `attachEdgesProjection` reads the live
 * `useBimRenderSettingsStore.objectStyles` (the SAME source the 2D renderers
 * read) so user V/G category + subcategory pen/colour/pattern overrides reach
 * the 3D edge overlay. Also covers the per-geometry `subcategoryKey` routing
 * and the dashed-pattern propagation.
 */
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { attachEdgesProjection } from '../bim-three-edges';
import { bimEdgeResolutionStore } from '../../edges/bim-edge-resolution-store';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { DEFAULT_OBJECT_STYLES, BIM_CATEGORY_LINE_COLORS } from '../../../config/bim-object-styles';
import type { BimCategory, ObjectStyle } from '../../../config/bim-object-styles';

function makeBoxMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

function setObjectStyles(styles: Partial<Record<BimCategory, ObjectStyle>>): void {
  useBimRenderSettingsStore.setState({
    objectStyles: { ...DEFAULT_OBJECT_STYLES, ...styles } as Record<BimCategory, ObjectStyle>,
  });
}

function overlayOf(mesh: THREE.Mesh): LineSegments2 | undefined {
  return mesh.children.find((c) => c instanceof LineSegments2) as LineSegments2 | undefined;
}

describe('ADR-377 Phase E — attachEdgesProjection (3D edge SSoT)', () => {
  const originalStyles = useBimRenderSettingsStore.getState().objectStyles;

  beforeEach(() => {
    bimEdgeResolutionStore.setSize(800, 600);
  });

  afterEach(() => {
    setObjectStyles(originalStyles);
    useBimRenderSettingsStore.getState().setBackgroundMode('environment');
  });

  describe('store-read parity (V/G + subcategory)', () => {
    it('default styles → attaches a solid edge overlay', () => {
      setObjectStyles({});
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      const overlay = overlayOf(mesh);
      expect(overlay).toBeInstanceOf(LineSegments2);
      expect((overlay!.material as LineMaterial).dashed).toBe(false);
    });

    it('v2.22 — 3D edge uses a UNIFORM silhouette colour, not the V/G projection colour', () => {
      // Revit "Shaded with Edges" draws one uniform dark line colour; the per-category
      // 2D projection colour (here #ff0000) must NOT bleed into the 3D edge overlay.
      setObjectStyles({
        wall: {
          projectionPen: 5,
          cutPen: 7,
          subcategories: { 'common-edges': { projectionColor: '#ff0000' } },
        },
      });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      const mat = overlayOf(mesh)!.material as LineMaterial;
      expect(mat.color.getHex()).toBe(0x1a1a1a); // uniform near-black, not 0xff0000
    });

    it('ADR-446 §2 — dark background → FULL SSoT 2D colour (per-category), NOT the uniform silhouette', () => {
      // «σαν 2Δ»: the uniform near-black override is dropped, so each entity keeps the
      // EXACT 2D resolver colour — default wall = wallExterior (#2b2f36), not 0x1a1a1a.
      useBimRenderSettingsStore.getState().setBackgroundMode('dark');
      setObjectStyles({});
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      const mat = overlayOf(mesh)!.material as LineMaterial;
      expect(mat.color.getHex()).toBe(new THREE.Color(BIM_CATEGORY_LINE_COLORS.wallExterior).getHex());
      expect(mat.color.getHex()).not.toBe(0x1a1a1a);
    });

    it('ADR-446 §2 — dark background + explicit V/G colour → that colour (2D parity)', () => {
      // With a dark background the uniform-silhouette override is dropped, so the
      // resolver's per-category colour reaches the edge (matches the 2D line work).
      useBimRenderSettingsStore.getState().setBackgroundMode('dark');
      setObjectStyles({
        wall: {
          projectionPen: 5,
          cutPen: 7,
          subcategories: { 'common-edges': { projectionColor: '#ff0000' } },
        },
      });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      const mat = overlayOf(mesh)!.material as LineMaterial;
      expect(mat.color.getHex()).toBe(0xff0000);
    });

    it('ADR-445 — beam keeps its amber category edge colour on LIGHT bg (δεν καταπίνεται)', () => {
      // A beam flush on a wall (same footprint + σοβατισμένη όψη) would «λιώνει» if its
      // edges fell to the uniform near-black silhouette. Structural framing keeps its
      // category colour (amber) in EVERY background so its outline reads apart.
      useBimRenderSettingsStore.getState().setBackgroundMode('environment');
      setObjectStyles({});
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'beam');
      const mat = overlayOf(mesh)!.material as LineMaterial;
      expect(mat.color.getHex()).toBe(new THREE.Color(BIM_CATEGORY_LINE_COLORS.beam).getHex());
      expect(mat.color.getHex()).not.toBe(0x1a1a1a);
    });

    it('ADR-445 — wall still uses the uniform near-black silhouette on LIGHT bg (μηδέν regression)', () => {
      // The beam exception must NOT leak to other categories: a wall on light bg keeps
      // the v2.22 uniform near-black silhouette.
      useBimRenderSettingsStore.getState().setBackgroundMode('environment');
      setObjectStyles({});
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      expect((overlayOf(mesh)!.material as LineMaterial).color.getHex()).toBe(0x1a1a1a);
    });

    it('subcategory projection pattern override → dashed 3D edge', () => {
      setObjectStyles({
        wall: {
          projectionPen: 5,
          cutPen: 7,
          subcategories: { 'common-edges': { linePattern: 'dashed' } },
        },
      });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      expect((overlayOf(mesh)!.material as LineMaterial).dashed).toBe(true);
    });

    it('V/G category visible=false → no overlay attached', () => {
      setObjectStyles({ wall: { projectionPen: 5, cutPen: 7, visible: false } });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'wall', 'common-edges');
      expect(overlayOf(mesh)).toBeUndefined();
      expect(mesh.children.length).toBe(0);
    });
  });

  describe('subcategoryKey routing', () => {
    it('an override on a DIFFERENT subcategory does NOT leak to this pass', () => {
      setObjectStyles({
        stair: {
          projectionPen: 3,
          cutPen: 5,
          subcategories: { risers: { projectionColor: '#00ff00' } },
        },
      });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'stair', 'treads'); // treads, not risers
      const mat = overlayOf(mesh)!.material as LineMaterial;
      expect(mat.color.getHex()).not.toBe(0x00ff00);
    });

    it('omitted subcategoryKey → parent style (no leak from any subcategory)', () => {
      setObjectStyles({
        beam: {
          projectionPen: 4,
          cutPen: 6,
          subcategories: { 'hidden-lines': { linePattern: 'dashed' } },
        },
      });
      const mesh = makeBoxMesh();
      attachEdgesProjection(mesh, 'beam'); // no subcategoryKey → parent (solid)
      expect((overlayOf(mesh)!.material as LineMaterial).dashed).toBe(false);
    });
  });
});
