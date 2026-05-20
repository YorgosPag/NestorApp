export type LightPresetId = 'morning' | 'noon' | 'afternoon' | 'sunset' | 'cloudy' | 'night';

export interface LightPreset {
  id: LightPresetId;
  /** Sun azimuth in degrees (0=North, clockwise) */
  azimuthDeg: number;
  /** Sun elevation in degrees (0=horizon, 90=zenith) */
  elevationDeg: number;
  /** DirectionalLight color hex */
  sunColor: number;
  /** DirectionalLight intensity */
  sunIntensity: number;
  /** AmbientLight intensity */
  ambientIntensity: number;
  /** HemisphereLight sky color */
  skyColor: number;
  /** HemisphereLight ground color */
  groundColor: number;
  /** HemisphereLight intensity */
  hemisphereIntensity: number;
}

export const LIGHT_PRESETS: Record<LightPresetId, LightPreset> = {
  morning:   { id: 'morning',   azimuthDeg: 90,  elevationDeg: 20, sunColor: 0xffddaa, sunIntensity: 1.5, ambientIntensity: 0.4, skyColor: 0xffeedd, groundColor: 0x8b7355, hemisphereIntensity: 0.2 },
  noon:      { id: 'noon',      azimuthDeg: 180, elevationDeg: 65, sunColor: 0xfffaf0, sunIntensity: 3.0, ambientIntensity: 0.5, skyColor: 0x87ceeb, groundColor: 0x8b7355, hemisphereIntensity: 0.3 },
  afternoon: { id: 'afternoon', azimuthDeg: 225, elevationDeg: 35, sunColor: 0xffcc88, sunIntensity: 2.0, ambientIntensity: 0.4, skyColor: 0x87ceeb, groundColor: 0x8b7355, hemisphereIntensity: 0.25 },
  sunset:    { id: 'sunset',    azimuthDeg: 270, elevationDeg: 5,  sunColor: 0xff7722, sunIntensity: 1.2, ambientIntensity: 0.3, skyColor: 0xff9966, groundColor: 0x6b4c2a, hemisphereIntensity: 0.2 },
  cloudy:    { id: 'cloudy',    azimuthDeg: 180, elevationDeg: 45, sunColor: 0xccddee, sunIntensity: 0.8, ambientIntensity: 0.8, skyColor: 0xaabbcc, groundColor: 0x8b7355, hemisphereIntensity: 0.5 },
  night:     { id: 'night',     azimuthDeg: 0,   elevationDeg: -10, sunColor: 0x223344, sunIntensity: 0.1, ambientIntensity: 0.1, skyColor: 0x0a0a1a, groundColor: 0x1a1a2a, hemisphereIntensity: 0.05 },
};

export const DEFAULT_PRESET: LightPresetId = 'noon';
export const PRESET_ORDER: LightPresetId[] = ['morning', 'noon', 'afternoon', 'sunset', 'cloudy', 'night'];
