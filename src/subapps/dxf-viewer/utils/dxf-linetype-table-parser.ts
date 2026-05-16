/**
 * DXF LTYPE Table Parser — ADR-358 §5.2 Phase 3A (G4 pre-pass).
 *
 * Reads the `TABLES > LTYPE` section of a DXF file and produces `LinetypeDef[]`
 * entries ready for `LinetypeRegistry.registerLinetypes()`. This pre-pass MUST
 * run before the LAYER table parser so that custom linetypes referenced by
 * layers (group code 6) resolve via `resolveLinetype()` instead of falling back
 * to `Continuous` with a warning.
 *
 * DXF LTYPE entry shape (codes consumed):
 *   2   linetype name (AutoCAD case-sensitive identifier)
 *   3   human-readable description (optional)
 *   73  dash element count
 *   40  total pattern length (mm, drawing units)
 *   49  dash element value (positive=dash, negative=gap, 0=dot)
 *
 * Codes ignored (preserved by writer when re-emitted): 70 (flags), 72 (alignment).
 *
 * Round-trip strategy: every parsed entry is stamped with `origin: 'dxf-import'`
 * so the LayerStore + writer can distinguish DXF-sourced linetypes from ISO
 * baseline and user-created ones.
 */

import type { LinetypeDef } from '../config/linetype-iso-catalog';

export interface ParseLinetypeWarning {
  /** Linetype name when known, else `"<unknown>"`. */
  readonly linetype: string;
  /** Human-readable explanation. */
  readonly message: string;
}

export interface ParseLinetypeTableResult {
  readonly linetypes: ReadonlyArray<LinetypeDef>;
  readonly warnings: ReadonlyArray<ParseLinetypeWarning>;
}

/**
 * Parse the LTYPE table out of a tokenised DXF line array.
 * Returns every custom linetype definition found (ISO baseline entries already
 * present in the file are returned too — the registry dedupes by name).
 */
export function parseLinetypeTable(lines: string[]): ParseLinetypeTableResult {
  const linetypes: LinetypeDef[] = [];
  const warnings: ParseLinetypeWarning[] = [];

  let inTables = false;
  let inLtypeTable = false;
  let inLtypeEntry = false;
  let current: Partial<MutableLinetypeDraft> = {};
  let prevCode = '';
  let prevValue = '';

  const flush = (): void => {
    if (!inLtypeEntry) return;
    const draft = current;
    if (!draft.name) {
      warnings.push({
        linetype: '<unknown>',
        message: 'LTYPE entry missing required group code 2 (name) — skipped.',
      });
      current = {};
      return;
    }
    const pattern = Object.freeze((draft.pattern ?? []).slice());
    linetypes.push(
      Object.freeze({
        name: draft.name,
        description: draft.description ?? '',
        pattern,
        origin: 'dxf-import' as const,
      }),
    );
    current = {};
  };

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() ?? '';

    if (prevCode === '0' && prevValue === 'SECTION' && code === '2' && value === 'TABLES') {
      inTables = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDSEC' && inTables) {
      if (inLtypeTable) flush();
      break;
    }

    if (!inTables) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (prevCode === '0' && prevValue === 'TABLE' && code === '2' && value === 'LTYPE') {
      inLtypeTable = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'ENDTAB' && inLtypeTable) {
      flush();
      inLtypeTable = false;
      inLtypeEntry = false;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLtypeTable) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (code === '0' && value === 'LTYPE') {
      flush();
      current = { pattern: [] };
      inLtypeEntry = true;
      prevCode = code;
      prevValue = value;
      continue;
    }

    if (!inLtypeEntry) {
      prevCode = code;
      prevValue = value;
      continue;
    }

    switch (code) {
      case '2':
        current.name = value;
        break;
      case '3':
        current.description = value;
        break;
      case '49': {
        const n = Number.parseFloat(value);
        if (Number.isFinite(n)) {
          (current.pattern ??= []).push(n);
        } else {
          warnings.push({
            linetype: current.name ?? '<unknown>',
            message: `LTYPE pattern element (group 49) not a finite number: "${value}".`,
          });
        }
        break;
      }
      default:
        break;
    }

    prevCode = code;
    prevValue = value;
  }

  return {
    linetypes: Object.freeze(linetypes),
    warnings: Object.freeze(warnings),
  };
}

interface MutableLinetypeDraft {
  name?: string;
  description?: string;
  pattern?: number[];
}
