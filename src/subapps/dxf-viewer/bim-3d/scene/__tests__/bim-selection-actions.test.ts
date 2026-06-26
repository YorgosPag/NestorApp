/**
 * ADR-402 Phase C — applyBimSelection (the Shift+click selection mutation extracted
 * from ThreeJsSceneManager). Verifies replace vs toggle update the store and keep
 * the highlighter in sync with the resulting multi-selection.
 */

import * as THREE from 'three';
import { applyBimSelection } from '../scene-manager-actions';
import { useSelection3DStore } from '../../stores/Selection3DStore';
import { BimSelectionHighlighter } from '../../systems/selection/BimSelectionHighlighter';
import { SelectionOutlinePass } from '../../systems/selection/SelectionOutlinePass';

function makeOutline(): SelectionOutlinePass {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  return new SelectionOutlinePass(new THREE.Vector2(800, 600), scene, camera);
}

function makeGroup(): { group: THREE.Group; meshes: Record<string, THREE.Mesh> } {
  const group = new THREE.Group();
  const meshes: Record<string, THREE.Mesh> = {};
  const data: [string, string][] = [
    ['a', 'wall'],
    ['b', 'column'],
  ];
  for (const [id, type] of data) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    m.userData['bimId'] = id;
    m.userData['bimType'] = type;
    group.add(m);
    meshes[id] = m;
  }
  return { group, meshes };
}

// ADR-536 — highlight = silhouette outline membership (NOT material mutation).
const highlighted = (outline: SelectionOutlinePass, m: THREE.Mesh): boolean =>
  outline.pass.selectedObjects.includes(m);

beforeEach(() => {
  useSelection3DStore.getState().clearSelection();
});

describe('applyBimSelection', () => {
  it('replace selects one entity (resolving its type) and highlights it', () => {
    const { group, meshes } = makeGroup();
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['a']);
    expect(useSelection3DStore.getState().selectedBimType).toBe('wall');
    expect(highlighted(outline, meshes.a)).toBe(true);
    expect(highlighted(outline, meshes.b)).toBe(false);
  });

  it('toggle adds a second entity and highlights both', () => {
    const { group, meshes } = makeGroup();
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'b', 'toggle');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['a', 'b']);
    expect(highlighted(outline, meshes.a)).toBe(true);
    expect(highlighted(outline, meshes.b)).toBe(true);
  });

  it('toggle removes an already-selected entity', () => {
    const { group, meshes } = makeGroup();
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'b', 'toggle');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'toggle');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['b']);
    expect(highlighted(outline, meshes.a)).toBe(false);
    expect(highlighted(outline, meshes.b)).toBe(true);
  });

  it('replace null clears the selection and the outline (material always untouched)', () => {
    const { group, meshes } = makeGroup();
    const origA = meshes.a.material;
    const outline = makeOutline();
    const h = new BimSelectionHighlighter(group, outline);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, null, 'replace');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual([]);
    expect(meshes.a.material).toBe(origA); // ADR-536 — body material never mutated
    expect(outline.hasSelection()).toBe(false);
  });
});
