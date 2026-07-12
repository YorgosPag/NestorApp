/**
 * ADR-344 Phase 1 — DXF STYLE symbol table reader.
 *
 * Parses the TABLES section of a DXF file and returns all STYLE table entries.
 * Works with DXF R12 through R2018 (group-code-based format, ASCII).
 *
 * The STYLE table entry carries font filename, height, width factor, and
 * oblique angle — these feed the default TextRunStyle in mtext-parser.ts.
 */

import type { DxfStyleTableEntry } from '../types/text-ast.types';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all STYLE table entries from raw DXF file content.
 * Returns an empty array when no STYLE table is found.
 */
export function parseStyleTable(dxfContent: string): DxfStyleTableEntry[] {
  const lines = dxfContent.split(/\r?\n/);
  const tableStart = findStyleSectionStart(lines);
  if (tableStart < 0) return [];
  const entries: DxfStyleTableEntry[] = [];
  let i = tableStart;
  while (i < lines.length - 1) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (code === '0' && (value === 'ENDSEC' || value === 'ENDTAB')) break;
    if (code === '0' && value === 'STYLE') {
      const { codes, next } = collectGroupCodes(lines, i + 2);
      entries.push(groupCodesToEntry(codes));
      i = next;
    } else {
      i += 2;
    }
  }
  return entries;
}

/**
 * Build a TextRunStyle baseline from a STYLE table entry.
 * Used by mtext-parser.ts to seed the default run style.
 */
export function styleEntryDefaults(entry: DxfStyleTableEntry): {
  fontFamily: string;
  height: number;
  widthFactor: number;
  obliqueAngle: number;
} {
  return {
    fontFamily: stripExtension(entry.fontFile) || 'Standard',
    height: entry.height,
    widthFactor: entry.widthFactor || 1.0,
    obliqueAngle: entry.obliqueAngle,
  };
}

/**
 * ADR-635 Φ C.5 — build a `{ styleName → fontFamily }` map from a DXF's STYLE table,
 * for the import pipeline to resolve a TEXT/MTEXT entity's text-style name (group 7) to the
 * font the render pipeline should use. Thin composition over the existing SSoT
 * (`parseStyleTable` + `styleEntryDefaults`) — NOT a second parser.
 *
 * The stored value is the STRIPPED font-file name (e.g. 'romans'), NOT a pre-substituted web
 * font: `resolveEntityFont()` applies the SHX→web-font substitution downstream (romans →
 * Liberation Sans). Pre-substituting here would (a) double-substitute and (b) wrongly override
 * a company-uploaded exact-match font that the resolver's direct cache hit would have kept.
 */
export function buildStyleFontMap(dxfContent: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of parseStyleTable(dxfContent)) {
    if (!entry.name) continue;
    map[entry.name] = styleEntryDefaults(entry).fontFamily;
  }
  return map;
}

/**
 * ADR-642 Φ2-B — build a `{ styleHandle → fontFamily }` map from a DXF's STYLE table, so the
 * LTYPE reader can resolve a complex-linetype embedded-text `340` (STYLE handle) reference to
 * the font the render pipeline should use. Handle keys are upper-cased (DXF handles are hex,
 * case-insensitive). Entries without a handle (handle-less writer) are skipped. Thin
 * composition over the SSoT (`parseStyleTable` + `styleEntryDefaults`) — NOT a second parser.
 */
export function buildStyleHandleFontMap(dxfContent: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of parseStyleTable(dxfContent)) {
    if (!entry.handle) continue;
    map[entry.handle.toUpperCase()] = styleEntryDefaults(entry).fontFamily;
  }
  return map;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type GroupCodeMap = Map<string, string>;

/**
 * Locate the position in `lines` where STYLE entry records begin.
 * Returns the index of the first line AFTER the "0 TABLE / 2 STYLE" header.
 */
function findStyleSectionStart(lines: string[]): number {
  for (let i = 0; i < lines.length - 3; i++) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim();
    if (code === '0' && value === 'TABLE') {
      if (lines[i + 2]?.trim() === '2' && lines[i + 3]?.trim() === 'STYLE') {
        return i + 2; // start scanning after the "2 STYLE" table-name line
      }
    }
  }
  return -1;
}

/**
 * Collect all group-code / value pairs from `lines[start]` onward,
 * stopping at the next `0` group code (next entity boundary).
 */
function collectGroupCodes(lines: string[], start: number): { codes: GroupCodeMap; next: number } {
  const codes: GroupCodeMap = new Map();
  let i = start;
  while (i < lines.length - 1) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (!code) { i += 2; continue; }
    if (code === '0') break; // next entity starts here
    codes.set(code, value);
    i += 2;
  }
  return { codes, next: i };
}

function groupCodesToEntry(codes: GroupCodeMap): DxfStyleTableEntry {
  const handle = codes.get('5');
  return {
    name: codes.get('2') ?? 'Standard',
    fontFile: codes.get('3') ?? '',
    bigFontFile: codes.get('4') ?? '',
    height: parseFloat(codes.get('40') ?? '0') || 0,
    widthFactor: parseFloat(codes.get('41') ?? '1') || 1,
    obliqueAngle: parseFloat(codes.get('50') ?? '0') || 0,
    flags: parseInt(codes.get('70') ?? '0', 10) || 0,
    textGenerationFlags: parseInt(codes.get('71') ?? '0', 10) || 0,
    // ADR-642 Φ2-B — DXF handle (group 5) for complex-linetype `340` resolution on import.
    ...(handle ? { handle } : {}),
  };
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot > 0) return filename.slice(0, dot);
  return filename;
}
