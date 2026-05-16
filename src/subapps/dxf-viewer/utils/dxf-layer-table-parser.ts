/**
 * DXF LAYER Table Parser — ADR-358 §5.2 Phase 3A (G4 full).
 *
 * Replaces the legacy `parseLayerColors()` 2-field reader with a complete
 * `SceneLayer`-emitting parser covering the 11 DXF layer fields plus the two
 * Q15 / Q16 scaffold fields preserved via XDATA round-trip.
 *
 * Group codes consumed:
 *   2     name
 *   6     linetype name        → resolved via LinetypeRegistry
 *   62    color (ACI, negative = OFF)
 *   70    flag bit field       (bit 1 = frozen, bit 4 = locked)
 *   290   plottable            ('1' = true, default true when absent)
 *   370   lineweight           (int → mm via parseDxfCode370)
 *   420   true color           (0x00RRGGBB)
 *
 * XDATA AppIds consumed (1001 group):
 *   AcCmTransparency    → 1071 int → transparency 0-90%
 *   NestorAec           → 1000 "category=<aec>" + "tag=<lowercase>" repeated
 *   NestorLayerMeta     → 1000 "description=<utf8>"
 *   NestorBimCategory   → 1000 "category=<ifc>"            (Q15 scaffold round-trip)
 *   NestorVpOverride    → 1000 "vpOverrides=<json>"        (Q16 scaffold round-trip)
 *
 * Pre-pass requirement: `parseLinetypeTable()` MUST run first so custom DXF
 * linetypes are already registered when the LAYER 6 group is resolved.
 *
 * Pre-commit ratchet `dxf-layer-parser` (Tier 3) restricts inline parsing of
 * layer group codes (e.g. `code === '370'`) to this file.
 */

import { getAciColor } from '../settings/standards/aci';
import {
  parseDxfCode370,
} from '../config/lineweight-iso-catalog';
import { resolveLinetype } from '../stores/LinetypeRegistry';
import {
  DEFAULT_LINETYPE_NAME,
} from '../config/linetype-iso-catalog';
import { createSceneLayer, type AecLayerCategory, type LineweightMm, type SceneLayer, type VpLayerProps } from '../types/entities';

export interface ParseLayerWarning {
  readonly layer: string;
  readonly message: string;
}

export interface ParseLayerTableResult {
  readonly layers: ReadonlyArray<SceneLayer>;
  readonly warnings: ReadonlyArray<ParseLayerWarning>;
}

const AEC_CATEGORY_SET: ReadonlySet<AecLayerCategory> = new Set<AecLayerCategory>([
  'architectural', 'structural', 'electrical', 'mechanical', 'plumbing',
  'fire', 'civil', 'telecom', 'interior', 'general',
]);

interface MutableLayerDraft {
  name?: string;
  colorAci?: number;
  colorTrueColor?: number | null;
  linetypeName?: string;
  lineweight?: LineweightMm;
  flag?: number;
  plottable?: boolean;
  /** Raw XDATA payload accumulated during entry parse (replayed at flush). */
  xdataBuf: XDataPair[];
}

type XDataPair = { app: string; code: string; value: string };

/**
 * Parse the LAYER table out of a tokenised DXF line array.
 *
 * `parseLinetypeTable()` must have run first; this parser calls
 * `resolveLinetype(name)` and warns on misses (falling back to "Continuous").
 */
export function parseLayerTable(lines: string[]): ParseLayerTableResult {
  const layers: SceneLayer[] = [];
  const warnings: ParseLayerWarning[] = [];

  let inTables = false;
  let inLayerTable = false;
  let inLayerEntry = false;
  let current: MutableLayerDraft = { xdataBuf: [] };
  let currentXDataApp: string | null = null;
  let prevCode = '';
  let prevValue = '';

  const flush = (): void => {
    if (!inLayerEntry) return;
    if (!current.name) {
      warnings.push({
        layer: '<unknown>',
        message: 'LAYER entry missing required group code 2 (name) — skipped.',
      });
      current = { xdataBuf: [] };
      currentXDataApp = null;
      return;
    }
    layers.push(buildSceneLayer(current, warnings));
    current = { xdataBuf: [] };
    currentXDataApp = null;
  };

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() ?? '';

    if (prevCode === '0' && prevValue === 'SECTION' && code === '2' && value === 'TABLES') {
      inTables = true;
      prevCode = code; prevValue = value; continue;
    }

    if (code === '0' && value === 'ENDSEC' && inTables) {
      if (inLayerTable) flush();
      break;
    }

    if (!inTables) { prevCode = code; prevValue = value; continue; }

    if (prevCode === '0' && prevValue === 'TABLE' && code === '2' && value === 'LAYER') {
      inLayerTable = true;
      prevCode = code; prevValue = value; continue;
    }

    if (code === '0' && value === 'ENDTAB' && inLayerTable) {
      flush();
      inLayerTable = false;
      inLayerEntry = false;
      prevCode = code; prevValue = value; continue;
    }

    if (!inLayerTable) { prevCode = code; prevValue = value; continue; }

    if (code === '0' && value === 'LAYER') {
      flush();
      current = { xdataBuf: [] };
      currentXDataApp = null;
      inLayerEntry = true;
      prevCode = code; prevValue = value; continue;
    }

    if (!inLayerEntry) { prevCode = code; prevValue = value; continue; }

    if (code === '1001') {
      currentXDataApp = value;
      prevCode = code; prevValue = value; continue;
    }

    if (currentXDataApp && (code === '1000' || code === '1071' || code === '1070' || code === '1040')) {
      current.xdataBuf.push({ app: currentXDataApp, code, value });
      prevCode = code; prevValue = value; continue;
    }

    switch (code) {
      case '2':
        current.name = value;
        break;
      case '62':
        current.colorAci = Number.parseInt(value, 10);
        break;
      case '6':
        current.linetypeName = value;
        break;
      case '70':
        current.flag = Number.parseInt(value, 10) || 0;
        break;
      case '290':
        current.plottable = value === '1';
        break;
      case '370': {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) current.lineweight = parseDxfCode370(n);
        break;
      }
      case '420': {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n) && n >= 0) current.colorTrueColor = n & 0xffffff;
        break;
      }
      default:
        break;
    }

    prevCode = code;
    prevValue = value;
  }

  return {
    layers: Object.freeze(layers),
    warnings: Object.freeze(warnings),
  };
}

function buildSceneLayer(draft: MutableLayerDraft, warnings: ParseLayerWarning[]): SceneLayer {
  const name = draft.name as string;
  const aciRaw = draft.colorAci ?? 7;
  const visible = aciRaw >= 0;
  const aci = Math.abs(aciRaw) || 7;
  const flag = draft.flag ?? 0;
  const frozen = (flag & 1) !== 0;
  const locked = (flag & 4) !== 0;

  const linetypeRequested = draft.linetypeName ?? DEFAULT_LINETYPE_NAME;
  const resolved = resolveLinetype(linetypeRequested);
  const linetype = resolved ? resolved.name : DEFAULT_LINETYPE_NAME;
  if (!resolved && draft.linetypeName) {
    warnings.push({
      layer: name,
      message: `Linetype "${linetypeRequested}" not found in registry — fell back to "${DEFAULT_LINETYPE_NAME}". (LTYPE pre-pass missed this entry?)`,
    });
  }

  const xd = collectXData(draft.xdataBuf);

  return createSceneLayer({
    name,
    color: draft.colorTrueColor != null
      ? hex(draft.colorTrueColor)
      : getAciColor(aci),
    colorAci: aci,
    colorTrueColor: draft.colorTrueColor ?? null,
    linetype,
    lineweight: draft.lineweight ?? -3,
    transparency: xd.transparency,
    visible,
    frozen,
    locked,
    plottable: draft.plottable ?? true,
    description: xd.description,
    source: 'dxf-import',
    category: xd.aecCategory ?? 'general',
    tags: xd.tags,
    bimCategory: xd.bimCategory,
    vpOverrides: xd.vpOverrides,
  });
}

interface CollectedXData {
  transparency: number;
  description: string | undefined;
  aecCategory: AecLayerCategory | undefined;
  tags: ReadonlyArray<string>;
  bimCategory: string | null;
  vpOverrides: Record<string, Partial<VpLayerProps>> | null;
}

function collectXData(pairs: ReadonlyArray<XDataPair>): CollectedXData {
  let transparency = 0;
  let description: string | undefined;
  let aecCategory: AecLayerCategory | undefined;
  const tags: string[] = [];
  let bimCategory: string | null = null;
  let vpOverrides: Record<string, Partial<VpLayerProps>> | null = null;

  for (const p of pairs) {
    if (p.app === 'AcCmTransparency' && p.code === '1071') {
      const raw = Number.parseInt(p.value, 10);
      if (Number.isFinite(raw)) {
        const alpha = raw & 0xff;
        transparency = Math.round((1 - alpha / 255) * 90);
      }
      continue;
    }
    if (p.code !== '1000') continue;
    if (p.app === 'NestorAec') {
      const [k, v] = splitKv(p.value);
      if (k === 'category' && AEC_CATEGORY_SET.has(v as AecLayerCategory)) {
        aecCategory = v as AecLayerCategory;
      } else if (k === 'tag' && v) {
        tags.push(v.toLowerCase());
      }
    } else if (p.app === 'NestorLayerMeta') {
      const [k, v] = splitKv(p.value);
      if (k === 'description') description = v;
    } else if (p.app === 'NestorBimCategory') {
      const [k, v] = splitKv(p.value);
      if (k === 'category') bimCategory = v;
    } else if (p.app === 'NestorVpOverride') {
      const [k, v] = splitKv(p.value);
      if (k === 'vpOverrides' && v) {
        try {
          vpOverrides = JSON.parse(v) as Record<string, Partial<VpLayerProps>>;
        } catch {
          // intentionally swallow — opaque preservation falls back to null
        }
      }
    }
  }

  return {
    transparency,
    description,
    aecCategory,
    tags: Object.freeze(tags.slice(0, 8)),
    bimCategory,
    vpOverrides,
  };
}

function splitKv(raw: string): [string, string] {
  const eq = raw.indexOf('=');
  if (eq < 0) return [raw, ''];
  return [raw.slice(0, eq), raw.slice(eq + 1)];
}

function hex(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`;
}
