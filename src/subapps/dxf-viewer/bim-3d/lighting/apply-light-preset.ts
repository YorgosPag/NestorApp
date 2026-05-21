// ============================================================================
// APPLY LIGHT PRESET — pure light-setting helpers.
// Extracted from ThreeJsSceneManager to keep that class under the 500-line cap.
// ============================================================================

import * as THREE from 'three';
import type { LightPreset } from './lighting-presets';
import type { EnvmapGenerator } from './envmap-generator';

/** Place the directional sun light by azimuth/elevation in degrees. */
export function updateSunDirection(
  sun: THREE.DirectionalLight,
  azimuthDeg: number,
  elevationDeg: number,
): void {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const x = Math.cos(elRad) * Math.sin(azRad);
  const y = Math.sin(elRad);
  const z = Math.cos(elRad) * Math.cos(azRad);
  sun.position.set(x * 15, y * 15, z * 15);
  sun.visible = elevationDeg > -5;
}

export interface SceneLightTriad {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
}

/** Apply a `LightPreset` to the three scene lights + refresh envmap. */
export function applyLightPresetToScene(
  lights: SceneLightTriad,
  preset: LightPreset,
  envmapGenerator: EnvmapGenerator,
): void {
  const { sun, ambient, hemi } = lights;
  sun.color.set(preset.sunColor);
  sun.intensity = preset.sunIntensity;
  ambient.intensity = preset.ambientIntensity;
  hemi.color.set(preset.skyColor);
  hemi.groundColor.set(preset.groundColor);
  hemi.intensity = preset.hemisphereIntensity;
  updateSunDirection(sun, preset.azimuthDeg, preset.elevationDeg);
  envmapGenerator.updateForPreset(preset);
}
