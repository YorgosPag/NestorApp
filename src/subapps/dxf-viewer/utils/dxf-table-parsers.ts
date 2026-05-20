/**
 * DXF Table Parsers — DIMSTYLE & LAYER
 *
 * State machine parsers for DXF TABLES section.
 * Extracted from DxfEntityParser class for SRP compliance (ADR-065 Phase 4).
 *
 * @module dxf-viewer/utils/dxf-table-parsers
 * @see dxf-entity-parser.ts - Main parser class
 */

import { getAciColor } from '../settings/standards/aci';
import { DXF_DEFAULT_LAYER } from '../config/layer-config';
import type { DimStyleEntry, DimStyleMap, LayerColorEntry, LayerColorMap } from './dxf-parser-types';
import { DEFAULT_DIMSTYLE } from './dxf-parser-types';

// ============================================================================
// DIMSTYLE TABLE PARSER
// ============================================================================

/** Apply DEFAULT_DIMSTYLE fallbacks to a partially-parsed style entry. */
function finalizeDimStyleEntry(s: Partial<DimStyleEntry>): DimStyleEntry {
  const d = DEFAULT_DIMSTYLE;
  return {
    name:              s.name ?? 'Standard',
    dimscale:          s.dimscale          ?? d.dimscale,
    dimasz:            s.dimasz            ?? d.dimasz,
    dimexo:            s.dimexo            ?? d.dimexo,
    dimdli:            s.dimdli            ?? d.dimdli,
    dimexe:            s.dimexe            ?? d.dimexe,
    dimrnd:            s.dimrnd            ?? d.dimrnd,
    dimtp:             s.dimtp             ?? d.dimtp,
    dimtm:             s.dimtm             ?? d.dimtm,
    dimtxt:            s.dimtxt            ?? d.dimtxt,
    dimcen:            s.dimcen            ?? d.dimcen,
    dimaltf:           s.dimaltf           ?? d.dimaltf,
    dimlfac:           s.dimlfac           ?? d.dimlfac,
    dimtfac:           s.dimtfac           ?? d.dimtfac,
    dimgap:            s.dimgap            ?? d.dimgap,
    dimaltrnd:         s.dimaltrnd         ?? d.dimaltrnd,
    dimtol:            s.dimtol            ?? d.dimtol,
    dimlim:            s.dimlim            ?? d.dimlim,
    dimtih:            s.dimtih            ?? d.dimtih,
    dimtoh:            s.dimtoh            ?? d.dimtoh,
    suppressExtLine1:  s.suppressExtLine1  ?? d.suppressExtLine1,
    suppressExtLine2:  s.suppressExtLine2  ?? d.suppressExtLine2,
    dimtad:            s.dimtad            ?? d.dimtad,
    dimzin:            s.dimzin            ?? d.dimzin,
    dimalt:            s.dimalt            ?? d.dimalt,
    dimaltd:           s.dimaltd           ?? d.dimaltd,
    dimtofl:           s.dimtofl           ?? d.dimtofl,
    dimtix:            s.dimtix            ?? d.dimtix,
    dimclrd:           s.dimclrd           ?? d.dimclrd,
    dimclre:           s.dimclre           ?? d.dimclre,
    dimclrt:           s.dimclrt           ?? d.dimclrt,
    dimadec:           s.dimadec           ?? d.dimadec,
    dimlunit:          s.dimlunit          ?? d.dimlunit,
    dimdec:            s.dimdec            ?? d.dimdec,
    dimtdec:           s.dimtdec           ?? d.dimtdec,
    dimaltu:           s.dimaltu           ?? d.dimaltu,
    dimaunit:          s.dimaunit          ?? d.dimaunit,
    dimdsep:           s.dimdsep           ?? d.dimdsep,
    dimtmove:          s.dimtmove          ?? d.dimtmove,
    suppressDimLine1:  s.suppressDimLine1  ?? d.suppressDimLine1,
    suppressDimLine2:  s.suppressDimLine2  ?? d.suppressDimLine2,
    dimtolj:           s.dimtolj           ?? d.dimtolj,
    dimatfit:          s.dimatfit          ?? d.dimatfit,
  };
}

/**
 * Parse DIMSTYLE table from TABLES section.
 *
 * Extracts DIMSTYLE variables for dimension rendering + roundtrip (ADR-362 H1).
 *
 * @param lines - All lines from DXF file
 * @returns Map of style names to their dimension properties
 */
export function parseDimStyles(lines: string[]): DimStyleMap {
  const dimStyles: DimStyleMap = {};
  dimStyles['Standard'] = { ...DEFAULT_DIMSTYLE };

  let inTables = false;
  let inDimStyleTable = false;
  let inDimStyleEntry = false;
  let currentStyle: Partial<DimStyleEntry> = {};

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() || '';

    if (code === '2' && value === 'TABLES') {
      inTables = true;
      continue;
    }

    if (code === '0' && value === 'ENDSEC' && inTables) {
      break;
    }

    if (!inTables) continue;

    if (code === '2' && value === 'DIMSTYLE' && !inDimStyleTable) {
      inDimStyleTable = true;
      continue;
    }

    if (code === '0' && value === 'ENDTAB' && inDimStyleTable) {
      if (inDimStyleEntry && currentStyle.name) {
        dimStyles[currentStyle.name] = finalizeDimStyleEntry(currentStyle);
      }
      inDimStyleTable = false;
      inDimStyleEntry = false;
      continue;
    }

    if (!inDimStyleTable) continue;

    if (code === '0' && value === 'DIMSTYLE') {
      if (inDimStyleEntry && currentStyle.name) {
        dimStyles[currentStyle.name] = finalizeDimStyleEntry(currentStyle);
      }
      currentStyle = {};
      inDimStyleEntry = true;
      continue;
    }

    if (!inDimStyleEntry) continue;

    switch (code) {
      case '2':   currentStyle.name        = value; break;
      // Scale / geometry
      // ADR-362 R10: preserve 0 (annotative sentinel) — `||` was converting it
      // to the default (1), hiding the $DIMSCALE header value at import time.
      case '40':  { const _v = parseFloat(value); currentStyle.dimscale = Number.isFinite(_v) ? _v : DEFAULT_DIMSTYLE.dimscale; break; }
      case '41':  currentStyle.dimasz      = parseFloat(value) || DEFAULT_DIMSTYLE.dimasz; break;
      case '42':  currentStyle.dimexo      = parseFloat(value) || DEFAULT_DIMSTYLE.dimexo; break;
      case '43':  currentStyle.dimdli      = parseFloat(value) || DEFAULT_DIMSTYLE.dimdli; break;
      case '44':  currentStyle.dimexe      = parseFloat(value) || DEFAULT_DIMSTYLE.dimexe; break;
      case '45':  currentStyle.dimrnd      = parseFloat(value) || 0; break;
      case '47':  currentStyle.dimtp       = parseFloat(value) || 0; break;
      case '48':  currentStyle.dimtm       = -(parseFloat(value) || 0); break; // stored negative
      // Text
      case '140': currentStyle.dimtxt      = parseFloat(value) || DEFAULT_DIMSTYLE.dimtxt; break;
      case '141': currentStyle.dimcen      = parseFloat(value) || DEFAULT_DIMSTYLE.dimcen; break;
      case '143': currentStyle.dimaltf     = parseFloat(value) || DEFAULT_DIMSTYLE.dimaltf; break;
      case '144': currentStyle.dimlfac     = parseFloat(value) || DEFAULT_DIMSTYLE.dimlfac; break;
      case '146': currentStyle.dimtfac     = parseFloat(value) || DEFAULT_DIMSTYLE.dimtfac; break;
      case '147': currentStyle.dimgap      = parseFloat(value) || DEFAULT_DIMSTYLE.dimgap; break;
      case '148': currentStyle.dimaltrnd   = parseFloat(value) || 0; break;
      // Flags
      case '71':  currentStyle.dimtol      = value === '1'; break;
      case '72':  currentStyle.dimlim      = value === '1'; break;
      case '73':  currentStyle.dimtih      = value !== '0'; break;
      case '74':  currentStyle.dimtoh      = value !== '0'; break;
      case '75':  currentStyle.suppressExtLine1 = value === '1'; break;
      case '76':  currentStyle.suppressExtLine2 = value === '1'; break;
      case '77':  currentStyle.dimtad      = parseInt(value, 10) || 0; break;
      case '78':  currentStyle.dimzin      = parseInt(value, 10) || 0; break;
      // Alternate / color
      case '170': currentStyle.dimalt      = value === '1'; break;
      case '171': currentStyle.dimaltd     = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimaltd; break;
      case '172': currentStyle.dimtofl     = value === '1'; break;
      case '174': currentStyle.dimtix      = value === '1'; break;
      case '176': currentStyle.dimclrd     = parseInt(value, 10) || 0; break;
      case '177': currentStyle.dimclre     = parseInt(value, 10) || 0; break;
      case '178': currentStyle.dimclrt     = parseInt(value, 10) || 0; break;
      case '179': currentStyle.dimadec     = parseInt(value, 10) || 0; break;
      // Units
      case '270': currentStyle.dimlunit    = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimlunit; break;
      case '271': currentStyle.dimdec      = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimdec; break;
      case '272': currentStyle.dimtdec     = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimtdec; break;
      case '273': currentStyle.dimaltu     = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimaltu; break;
      case '275': currentStyle.dimaunit    = parseInt(value, 10) || 0; break;
      case '278': currentStyle.dimdsep     = parseInt(value, 10) || 46; break;
      case '279': currentStyle.dimtmove    = parseInt(value, 10) || 0; break;
      case '281': currentStyle.suppressDimLine1 = value === '1'; break;
      case '282': currentStyle.suppressDimLine2 = value === '1'; break;
      case '283': { const n = parseInt(value, 10); currentStyle.dimtolj = Number.isNaN(n) ? undefined : n; break; }
      case '289': currentStyle.dimatfit    = parseInt(value, 10) || DEFAULT_DIMSTYLE.dimatfit; break;
    }
  }

  const styleCount = Object.keys(dimStyles).length;
  if (styleCount > 1) {
    console.debug('📏 DXF DIMSTYLES parsed:', {
      count: styleCount,
      styles: Object.entries(dimStyles).map(([name, style]) => ({
        name,
        dimtxt: style.dimtxt,
        dimscale: style.dimscale
      }))
    });
  }

  return dimStyles;
}

// ============================================================================
// LAYER TABLE PARSER
// ============================================================================

/**
 * Parse LAYER table from TABLES section — LEGACY 2-field reader.
 *
 * @deprecated ADR-358 Phase 3 — superseded by `parseLayerTable()` in
 * `dxf-layer-table-parser.ts`, which emits full `SceneLayer[]` with the 11
 * DXF layer fields + scaffold round-trip. This wrapper is kept for the
 * `dxf-scene-builder.ts` legacy consumer until Phase 4 migrates the renderer
 * pipeline to consume `SceneLayer` directly.
 *
 * @param lines - All lines from DXF file
 * @returns Map of layer names to their color properties
 */
export function parseLayerColors(lines: string[]): LayerColorMap {
  const layerColors: LayerColorMap = {};

  layerColors[DXF_DEFAULT_LAYER] = {
    name: DXF_DEFAULT_LAYER,
    colorIndex: 7,
    color: getAciColor(7),
    visible: true
  };

  let inTablesSection = false;
  let inLayerTable = false;
  let inLayerEntry = false;
  let currentLayer: Partial<LayerColorEntry> = {};
  let prevCode = '';
  let prevValue = '';

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() || '';

    if (prevCode === '0' && prevValue === 'SECTION' && code === '2' && value === 'TABLES') {
      inTablesSection = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDSEC' && inTablesSection) {
      break;
    }

    if (!inTablesSection) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (prevCode === '0' && prevValue === 'TABLE' && code === '2' && value === 'LAYER') {
      inLayerTable = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDTAB' && inLayerTable) {
      if (inLayerEntry && currentLayer.name) {
        const colorIndex = currentLayer.colorIndex ?? 7;
        layerColors[currentLayer.name] = {
          name: currentLayer.name,
          colorIndex: Math.abs(colorIndex),
          color: getAciColor(Math.abs(colorIndex)),
          visible: colorIndex >= 0
        };
      }
      inLayerTable = false;
      inLayerEntry = false;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLayerTable) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'LAYER') {
      if (inLayerEntry && currentLayer.name) {
        const colorIndex = currentLayer.colorIndex ?? 7;
        layerColors[currentLayer.name] = {
          name: currentLayer.name,
          colorIndex: Math.abs(colorIndex),
          color: getAciColor(Math.abs(colorIndex)),
          visible: colorIndex >= 0
        };
      }
      currentLayer = {};
      inLayerEntry = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLayerEntry) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    switch (code) {
      case '2':
        currentLayer.name = value;
        break;
      case '62':
        currentLayer.colorIndex = parseInt(value, 10) || 7;
        break;
    }

    prevCode = code;
    prevValue = value;
  }

  const layerCount = Object.keys(layerColors).length;
  if (layerCount > 0) {
    console.debug('🎨 DXF LAYER COLORS parsed:', {
      count: layerCount,
      layers: Object.entries(layerColors).map(([name, layer]) => ({
        name,
        colorIndex: layer.colorIndex,
        color: layer.color,
        visible: layer.visible
      }))
    });
  }

  return layerColors;
}
