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
  return {
    name: codes.get('2') ?? 'Standard',
    fontFile: codes.get('3') ?? '',
    bigFontFile: codes.get('4') ?? '',
    height: parseFloat(codes.get('40') ?? '0') || 0,
    widthFactor: parseFloat(codes.get('41') ?? '1') || 1,
    obliqueAngle: parseFloat(codes.get('50') ?? '0') || 0,
    flags: parseInt(codes.get('70') ?? '0', 10) || 0,
    textGenerationFlags: parseInt(codes.get('71') ?? '0', 10) || 0,
  };
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot > 0) return filename.slice(0, dot);
  return filename;
}
