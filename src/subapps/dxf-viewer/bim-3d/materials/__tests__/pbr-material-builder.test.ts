/**
 * buildMat tests (ADR-687 Φ5) — the SOLE PBR face factory.
 *
 * Focus: the Φ5 two-tier engine switch. `buildMat` must upgrade to the (heavier)
 * `MeshPhysicalMaterial` ONLY when a def carries an ACTIVE physical effect (clearcoat
 * or transmission), and otherwise stay on the cheaper `MeshStandardMaterial` — so the
 * thousands of category-driven BIM solids never pay the physical cost (perf guard).
 *
 * Real `three` (material construction needs no GL context, like face-material-catalog).
 */

import * as THREE from 'three';
import { buildMat, applyTextureSet } from '../pbr-material-builder';
import type { PbrMaterialDef } from '../../../bim/materials/material-catalog-defs';
import type { LoadedTextureSet } from '../bim-texture-cache';

const baseDef: PbrMaterialDef = { color: 0x8b5e3c, roughness: 0.5, metalness: 0.2 };

describe('buildMat — Φ5 two-tier engine switch', () => {
  it('stays MeshStandardMaterial when no physical effect is active', () => {
    const mat = buildMat(baseDef);
    expect(mat.type).toBe('MeshStandardMaterial');
    expect(mat).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });

  it('stays MeshStandardMaterial when ior/thickness are set but clearcoat/transmission are 0 (perf guard)', () => {
    // appearanceToDef always fills ior: 1.5 — presence alone must NOT upgrade the material.
    const mat = buildMat({ ...baseDef, clearcoat: 0, transmission: 0, ior: 1.5, thickness: 0 });
    expect(mat.type).toBe('MeshStandardMaterial');
  });

  it('upgrades to MeshPhysicalMaterial when clearcoat > 0', () => {
    const mat = buildMat({ ...baseDef, clearcoat: 1, clearcoatRoughness: 0.3 });
    expect(mat.type).toBe('MeshPhysicalMaterial');
    const phys = mat as THREE.MeshPhysicalMaterial;
    expect(phys.clearcoat).toBeCloseTo(1);
    expect(phys.clearcoatRoughness).toBeCloseTo(0.3);
  });

  it('upgrades to MeshPhysicalMaterial when transmission > 0 (carries ior + thickness)', () => {
    const mat = buildMat({ ...baseDef, transmission: 0.9, ior: 1.5, thickness: 2 });
    expect(mat.type).toBe('MeshPhysicalMaterial');
    const phys = mat as THREE.MeshPhysicalMaterial;
    expect(phys.transmission).toBeCloseTo(0.9);
    expect(phys.ior).toBeCloseTo(1.5);
    expect(phys.thickness).toBeCloseTo(2);
  });

  it('preserves the shared base params (colour/roughness/metalness) on the physical tier', () => {
    const mat = buildMat({ ...baseDef, emissive: 0xff0000, emissiveIntensity: 0.5, transmission: 1 });
    expect(mat.color.getHex()).toBe(0x8b5e3c);
    expect(mat.roughness).toBeCloseTo(0.5);
    expect(mat.metalness).toBeCloseTo(0.2);
    expect(mat.emissive.getHex()).toBe(0xff0000);
    expect(mat.emissiveIntensity).toBeCloseTo(0.5);
    expect(mat.side).toBe(THREE.FrontSide);
  });
});

describe('applyTextureSet — ADR-687 Φ7 shared texture-apply (extracted SSoT)', () => {
  it('attaches the albedo map, whitens the base colour, and sets optional maps', () => {
    const set: LoadedTextureSet = {
      map: new THREE.Texture(),
      normalMap: new THREE.Texture(),
      roughnessMap: new THREE.Texture(),
      aoMap: new THREE.Texture(),
    };
    const mat = applyTextureSet(baseDef, set);
    expect(mat.map).toBe(set.map);
    expect(mat.color.getHex()).toBe(0xffffff); // white so the texture shows its natural colour
    expect(mat.normalMap).toBe(set.normalMap);
    expect(mat.roughnessMap).toBe(set.roughnessMap);
    expect(mat.aoMap).toBe(set.aoMap);
    expect(mat.aoMapIntensity).toBeCloseTo(0.5);
  });

  it('leaves optional maps unset when the set only has albedo', () => {
    const mat = applyTextureSet(baseDef, { map: new THREE.Texture() });
    expect(mat.map).not.toBeNull();
    expect(mat.normalMap).toBeNull();
    expect(mat.aoMap).toBeNull();
  });
});
