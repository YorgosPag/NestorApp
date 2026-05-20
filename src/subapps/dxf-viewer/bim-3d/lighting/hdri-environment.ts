const PH_BASE = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k';
const PH_THUMB = 'https://cdn.polyhaven.com/asset_img/thumbs';

export interface HdriPreset {
  id: string;
  /** Suffix for t(`lighting.hdri.${labelKey}`) */
  labelKey: string;
  url: string;
  thumbnail: string;
}

export const HDRI_PRESETS: HdriPreset[] = [
  {
    id: 'noon_grass',
    labelKey: 'noonGrass',
    url: `${PH_BASE}/noon_grass_1k.hdr`,
    thumbnail: `${PH_THUMB}/noon_grass.png?width=200`,
  },
  {
    id: 'overcast_soil_puresky',
    labelKey: 'overcast',
    url: `${PH_BASE}/overcast_soil_puresky_1k.hdr`,
    thumbnail: `${PH_THUMB}/overcast_soil_puresky.png?width=200`,
  },
  {
    id: 'golden_bay',
    labelKey: 'goldenHour',
    url: `${PH_BASE}/golden_bay_1k.hdr`,
    thumbnail: `${PH_THUMB}/golden_bay.png?width=200`,
  },
  {
    id: 'blue_hour_8k',
    labelKey: 'blueHour',
    // Polyhaven slug includes original resolution; 1k download appends _1k
    url: `${PH_BASE}/blue_hour_8k_1k.hdr`,
    thumbnail: `${PH_THUMB}/blue_hour_8k.png?width=200`,
  },
  {
    id: 'studio_small_04',
    labelKey: 'studio',
    url: `${PH_BASE}/studio_small_04_1k.hdr`,
    thumbnail: `${PH_THUMB}/studio_small_04.png?width=200`,
  },
  {
    id: 'urban_street_04',
    labelKey: 'urban',
    url: `${PH_BASE}/urban_street_04_1k.hdr`,
    thumbnail: `${PH_THUMB}/urban_street_04.png?width=200`,
  },
  {
    id: 'coast_land',
    labelKey: 'coast',
    url: `${PH_BASE}/coast_land_1k.hdr`,
    thumbnail: `${PH_THUMB}/coast_land.png?width=200`,
  },
  {
    id: 'mountain_meadow_2',
    labelKey: 'mountain',
    url: `${PH_BASE}/mountain_meadow_2_1k.hdr`,
    thumbnail: `${PH_THUMB}/mountain_meadow_2.png?width=200`,
  },
];

export const DEFAULT_HDRI_PRESET_ID = 'noon_grass';

export function getHdriPreset(id: string): HdriPreset | undefined {
  return HDRI_PRESETS.find((p) => p.id === id);
}
