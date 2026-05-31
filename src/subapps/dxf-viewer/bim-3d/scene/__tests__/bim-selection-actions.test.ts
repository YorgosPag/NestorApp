/**
 * ADR-402 Phase C — applyBimSelection (the Shift+click selection mutation extracted
 * from ThreeJsSceneManager). Verifies replace vs toggle update the store and keep
 * the highlighter in sync with the resulting multi-selection.
 */

import * as THREE from 'three';
import { applyBimSelection } from '../scene-manager-actions';
import { useSelection3DStore } from '../../stores/Selection3DStore';
import { BimSelectionHighlighter } from '../../systems/selection/BimSelectionHighlighter';

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

const highlighted = (m: THREE.Mesh): boolean =>
  (m.material as THREE.MeshStandardMaterial).emissiveIntensity === 0.3;

beforeEach(() => {
  useSelection3DStore.getState().clearSelection();
});

describe('applyBimSelection', () => {
  it('replace selects one entity (resolving its type) and highlights it', () => {
    const { group, meshes } = makeGroup();
    const h = new BimSelectionHighlighter(group);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['a']);
    expect(useSelection3DStore.getState().selectedBimType).toBe('wall');
    expect(highlighted(meshes.a)).toBe(true);
    expect(highlighted(meshes.b)).toBe(false);
  });

  it('toggle adds a second entity and highlights both', () => {
    const { group, meshes } = makeGroup();
    const h = new BimSelectionHighlighter(group);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'b', 'toggle');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['a', 'b']);
    expect(highlighted(meshes.a)).toBe(true);
    expect(highlighted(meshes.b)).toBe(true);
  });

  it('toggle removes an already-selected entity', () => {
    const { group, meshes } = makeGroup();
    const h = new BimSelectionHighlighter(group);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'b', 'toggle');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'toggle');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['b']);
    expect(highlighted(meshes.a)).toBe(false);
    expect(highlighted(meshes.b)).toBe(true);
  });

  it('replace null clears the selection and restores materials', () => {
    const { group, meshes } = makeGroup();
    const origA = meshes.a.material;
    const h = new BimSelectionHighlighter(group);

    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, 'a', 'replace');
    applyBimSelection({ bimGroup: group, selectionHighlighter: h }, null, 'replace');

    expect(useSelection3DStore.getState().selectedBimIds).toEqual([]);
    expect(meshes.a.material).toBe(origA);
  });
});
