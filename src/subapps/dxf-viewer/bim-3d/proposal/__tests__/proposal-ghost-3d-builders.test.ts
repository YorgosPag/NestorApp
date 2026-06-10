/**
 * proposal-ghost-3d-builders — pure builder + flatten tests for the 3D MEP proposal ghost.
 *
 * Covers: electrical conduit build (mesh + tint + empty), the discipline-agnostic
 * network → tube flatten (one tube/segment, network elevation, SSoT classification colour),
 * and the segment → tube sweep (mesh/tube, radius scales with DN, elevation, empty).
 */

import * as THREE from 'three';
import {
  buildElectricalGhost3D,
  buildSegmentGhost3D,
  pipeNetworksToGhostTubes,
  type GhostPipeNetwork,
  type ProposalGhostTube,
} from '../proposal-ghost-3d-builders';
import { hexToThreeInt, resolveSegmentClassificationColor } from '../../../bim/mep-systems/mep-system-color';
import type { CircuitWirePath } from '../../../bim/mep-systems/mep-wire-routing';

function wirePath(colorHex = '#2563eb'): CircuitWirePath {
  return { systemId: 's1', colorHex, points: [{ x: 0, y: 0, zMm: 0 }, { x: 10, y: 0, zMm: 0 }] };
}

function worldSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
}

function worldCenter(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
}

describe('buildElectricalGhost3D', () => {
  it('sweeps one translucent tube per circuit wire path', () => {
    const out = buildElectricalGhost3D([wirePath(), wirePath()], 'm');
    expect(out).toHaveLength(2);
    expect(out[0]).toBeInstanceOf(THREE.Mesh);
    expect((out[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.TubeGeometry);
  });

  it('tints each conduit with the circuit colour, translucent + non-pickable', () => {
    const [mesh] = buildElectricalGhost3D([wirePath('#ff0000')], 'm') as THREE.Mesh[];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.getHex()).toBe(0xff0000);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
    expect(mesh.raycast).toBeInstanceOf(Function);
  });

  it('returns an empty array for no wire paths', () => {
    expect(buildElectricalGhost3D([], 'm')).toEqual([]);
  });
});

describe('pipeNetworksToGhostTubes', () => {
  const network: GhostPipeNetwork = {
    sourceElevationMm: 2800,
    classification: 'domestic-cold-water',
    segments: [
      { start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, diameterMm: 25 },
      { start: { x: 5, y: 0 }, end: { x: 5, y: 5 }, diameterMm: 20 },
    ],
  };

  it('emits exactly one tube per segment', () => {
    expect(pipeNetworksToGhostTubes([network])).toHaveLength(2);
  });

  it('carries the network source elevation + SSoT classification colour onto each tube', () => {
    const [t0] = pipeNetworksToGhostTubes([network]);
    expect(t0.elevationMm).toBe(2800);
    expect(t0.diameterMm).toBe(25);
    expect(t0.colorHex).toBe(resolveSegmentClassificationColor('domestic-cold-water')!);
  });

  it('flattens multiple networks (e.g. heating supply + return)', () => {
    const ret: GhostPipeNetwork = { ...network, classification: 'hydronic-return', segments: [network.segments[0]] };
    expect(pipeNetworksToGhostTubes([network, ret])).toHaveLength(3);
  });

  it('returns an empty array for no networks', () => {
    expect(pipeNetworksToGhostTubes([])).toEqual([]);
  });
});

describe('buildSegmentGhost3D', () => {
  const tube = (diameterMm: number, elevationMm = 0, colorHex?: string): ProposalGhostTube => ({
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    diameterMm,
    elevationMm,
    colorHex,
  });

  it('sweeps one tube mesh per proposed segment', () => {
    const out = buildSegmentGhost3D([tube(50), tube(40)], 'm');
    expect(out).toHaveLength(2);
    expect(out[0]).toBeInstanceOf(THREE.Mesh);
    expect((out[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.TubeGeometry);
  });

  it('scales the tube radius with the segment diameter', () => {
    const [wide] = buildSegmentGhost3D([tube(200)], 'm') as THREE.Mesh[];
    const [narrow] = buildSegmentGhost3D([tube(20)], 'm') as THREE.Mesh[];
    // Cross-section (world Y extent) of the larger DN is bigger.
    expect(worldSize(wide).y).toBeGreaterThan(worldSize(narrow).y);
  });

  it('places the run at the tube elevation (world Y = elevationMm × 0.001)', () => {
    const [mesh] = buildSegmentGhost3D([tube(50, 3000)], 'm') as THREE.Mesh[];
    expect(worldCenter(mesh).y).toBeCloseTo(3, 2);
  });

  it('tints with the classification colour, falling back to neutral when absent', () => {
    const hex = resolveSegmentClassificationColor('fire-sprinkler')!;
    const [coloured] = buildSegmentGhost3D([tube(50, 0, hex)], 'm') as THREE.Mesh[];
    expect((coloured.material as THREE.MeshStandardMaterial).color.getHex()).toBe(hexToThreeInt(hex));
    // No colour ⇒ a mesh still builds (neutral default), never throws.
    expect(buildSegmentGhost3D([tube(50)], 'm')).toHaveLength(1);
  });

  it('returns an empty array for no tubes', () => {
    expect(buildSegmentGhost3D([], 'm')).toEqual([]);
  });
});
