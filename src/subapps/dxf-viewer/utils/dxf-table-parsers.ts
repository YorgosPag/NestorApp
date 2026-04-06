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

/**
 * Parse DIMSTYLE table from TABLES section.
 *
 * Extracts the real DIMTXT values for dimension text height calculation.
 * Without this parsing, dimensions use fallback values that don't match the drawing.
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
        dimStyles[currentStyle.name] = {
          name: currentStyle.name,
          dimtxt: currentStyle.dimtxt ?? DEFAULT_DIMSTYLE.dimtxt,
          dimscale: currentStyle.dimscale ?? DEFAULT_DIMSTYLE.dimscale,
          dimtfac: currentStyle.dimtfac ?? DEFAULT_DIMSTYLE.dimtfac,
          dimasz: currentStyle.dimasz ?? DEFAULT_DIMSTYLE.dimasz
        };
      }
      inDimStyleTable = false;
      inDimStyleEntry = false;
      continue;
    }

    if (!inDimStyleTable) continue;

    if (code === '0' && value === 'DIMSTYLE') {
      if (inDimStyleEntry && currentStyle.name) {
        dimStyles[currentStyle.name] = {
          name: currentStyle.name,
          dimtxt: currentStyle.dimtxt ?? DEFAULT_DIMSTYLE.dimtxt,
          dimscale: currentStyle.dimscale ?? DEFAULT_DIMSTYLE.dimscale,
          dimtfac: currentStyle.dimtfac ?? DEFAULT_DIMSTYLE.dimtfac,
          dimasz: currentStyle.dimasz ?? DEFAULT_DIMSTYLE.dimasz
        };
      }
      currentStyle = {};
      inDimStyleEntry = true;
      continue;
    }

    if (!inDimStyleEntry) continue;

    switch (code) {
      case '2':
        currentStyle.name = value;
        break;
      case '140':
        currentStyle.dimtxt = parseFloat(value) || DEFAULT_DIMSTYLE.dimtxt;
        break;
      case '40':
        currentStyle.dimscale = parseFloat(value) || DEFAULT_DIMSTYLE.dimscale;
        break;
      case '41':
        currentStyle.dimasz = parseFloat(value) || DEFAULT_DIMSTYLE.dimasz;
        break;
      case '146':
        currentStyle.dimtfac = parseFloat(value) || DEFAULT_DIMSTYLE.dimtfac;
        break;
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
 * Parse LAYER table from TABLES section.
 *
 * Extracts the REAL ACI colors for each layer.
 * Replaces the old hash-based color assignment with actual DXF colors.
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
