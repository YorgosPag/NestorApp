/**
 * ADR-539 Φ4b — resolveFaceMaterial base+override cascade (Revit «Paint» + type material /
 * Cinema 4D base material tag). resolve(face) = appearance[face] ?? appearance['*'] ?? base.
 */

import * as THREE from 'three';
import { resolveFaceMaterial } from '../face-appearance-material';

const hexOf = (m: THREE.Material) => (m as THREE.MeshStandardMaterial).color.getHexString();

describe('resolveFaceMaterial — base+override cascade', () => {
  it('returns the SAME base material when neither the face nor "*" is painted', () => {
    const base = new THREE.MeshStandardMaterial();
    expect(resolveFaceMaterial('top', {}, base)).toBe(base);
    expect(resolveFaceMaterial('top', { 'side:0': { colorHex: '#ffffff' } }, base)).toBe(base);
  });

  it('resolves a per-face override to a new flat material', () => {
    const base = new THREE.MeshStandardMaterial();
    const m = resolveFaceMaterial('top', { top: { colorHex: '#C0392B' } }, base);
    expect(m).not.toBe(base);
    expect(hexOf(m)).toBe('c0392b');
  });

  it('falls back to the base "*" appearance for an unpainted face («βάψε όλο»)', () => {
    const base = new THREE.MeshStandardMaterial();
    const m = resolveFaceMaterial('side:3', { '*': { colorHex: '#27AE60' } }, base);
    expect(m).not.toBe(base);
    expect(hexOf(m)).toBe('27ae60');
  });

  it('a per-face override wins over the base "*"', () => {
    const base = new THREE.MeshStandardMaterial();
    const m = resolveFaceMaterial('top', { '*': { colorHex: '#000000' }, top: { colorHex: '#C0392B' } }, base);
    expect(hexOf(m)).toBe('c0392b');
  });
});
