/**
 * DXF DIMSTYLE Table Writer — ADR-362 Phase H1.
 *
 * Emits a DXF `TABLES` section containing the DIMSTYLE table, mirroring the
 * pattern of `dxf-layer-table-writer.ts`. Output: alternating code/value string[]
 * suitable for in-process roundtrip tests (write → feed to `parseDimStyles()`).
 *
 * NOT a production DXF exporter — production export flows through the ezdxf
 * Python microservice (`types/dxf-export.types.ts`). The writer's purpose is to
 * guarantee that the in-app `DimStyle` data model can survive a tokenised DXF
 * TABLES roundtrip at the DIMSTYLE level (lossless save → load of rendering fields).
 *
 * Mapping notes:
 *   - String enums (DimLinearUnitFormat etc.) → DXF integer codes via local lookup maps.
 *   - Nestor-internal fields (id, isBuiltIn, paperTextHeight, targetLayer, dimInspect,
 *     breakGap, annotative) have no DXF DIMSTYLE equivalent → skipped.
 *   - DIMTM: stored negative in `DimStyle`; emitted as absolute value (AutoCAD convention).
 *   - DIMDSEP: stored as char ('.' / ','); emitted as ASCII code (46 / 44).
 *   - Block handles (DIMBLK/DIMBLK1/DIMBLK2 / DIMTXSTY) emitted as '0' — no block table
 *     in scope for this writer. Caller can patch handles post-hoc if needed.
 */

import type {
  DimStyle,
  DimLinearUnitFormat,
  DimAngularUnitFormat,
  DimTextVerticalPlacement,
  DimToleranceJustify,
} from '../types/dimension';

// ──────────────────────────────────────────────────────────────────────────────
// Emit helper
// ──────────────────────────────────────────────────────────────────────────────

function emit(out: string[], code: string, value: string): void {
  out.push(code, value);
}

// ──────────────────────────────────────────────────────────────────────────────
// Enum → DXF code lookup maps
// ──────────────────────────────────────────────────────────────────────────────

const LINEAR_UNIT_DXF: Record<DimLinearUnitFormat, number> = {
  scientific:     1,
  decimal:        2,
  engineering:    3,
  architectural:  4,
  fractional:     5,
  windowsDesktop: 6,
};

const ANGULAR_UNIT_DXF: Record<DimAngularUnitFormat, number> = {
  decimalDegrees: 0,
  degMinSec:      1,
  gradians:       2,
  radians:        3,
  surveyorUnits:  4,
};

const TEXT_VERTICAL_DXF: Record<DimTextVerticalPlacement, number> = {
  centered: 0,
  above:    1,
  outside:  2,
  jis:      3,
  below:    4,
};

const TOL_JUSTIFY_DXF: Record<DimToleranceJustify, number> = {
  bottom: 0,
  middle: 1,
  top:    2,
};

function flag(b: boolean): string { return b ? '1' : '0'; }
function num(n: number): string   { return String(n); }

// ──────────────────────────────────────────────────────────────────────────────
// Per-style emitter
// ──────────────────────────────────────────────────────────────────────────────

function emitOneDimStyle(out: string[], s: DimStyle): void {
  emit(out, '0', 'DIMSTYLE');
  emit(out, '2', s.name);
  emit(out, '70', '0');                      // flags (standard = 0)

  // ── Scale / geometry (codes 40-48) ────────────────────────────────────────
  emit(out, '40', num(s.dimscale));
  emit(out, '41', num(s.dimasz));
  emit(out, '42', num(s.dimexo));
  emit(out, '43', num(s.dimdli));
  emit(out, '44', num(s.dimexe));
  emit(out, '45', num(s.dimrnd));
  emit(out, '46', '0');                      // DIMDLE (ext line extension beyond ticks)
  emit(out, '47', num(s.dimtp));
  emit(out, '48', num(Math.abs(s.dimtm)));   // DIMTM emitted as positive (AutoCAD spec)

  // ── Text / tolerances (codes 140-148) ─────────────────────────────────────
  emit(out, '140', num(s.dimtxt));
  emit(out, '141', num(s.dimcen));
  emit(out, '142', '0');                     // DIMTSZ (tick size, 0 = use arrows)
  emit(out, '143', num(s.dimaltf));
  emit(out, '144', num(s.dimlfac));
  emit(out, '145', '0');                     // DIMTVP (text vertical position offset)
  emit(out, '146', num(s.dimtfac));
  emit(out, '147', num(s.dimgap));
  emit(out, '148', num(s.dimaltrnd));

  // ── Boolean / enum flags (codes 71-79) ────────────────────────────────────
  emit(out, '71', flag(s.dimtol));
  emit(out, '72', flag(s.dimlim));
  emit(out, '73', flag(s.dimtih));
  emit(out, '74', flag(s.dimtoh));
  emit(out, '75', flag(s.suppressExtLine1));
  emit(out, '76', flag(s.suppressExtLine2));
  emit(out, '77', num(TEXT_VERTICAL_DXF[s.dimtad]));
  emit(out, '78', num(s.dimzin));
  emit(out, '79', '0');                      // DIMAZIN (angular zero suppression)

  // ── Alternate units flags (codes 170-178) ─────────────────────────────────
  emit(out, '170', flag(s.dimalt));
  emit(out, '171', num(s.dimaltd));
  emit(out, '172', flag(s.dimtofl));
  emit(out, '173', '0');                     // DIMSAH (separate arrowheads, use DIMBLK1/2)
  emit(out, '174', flag(s.dimtix));
  emit(out, '175', '0');                     // DIMSOXD

  // ── Colors (codes 176-178) ────────────────────────────────────────────────
  emit(out, '176', num(s.dimclrd));
  emit(out, '177', num(s.dimclre));
  emit(out, '178', num(s.dimclrt));

  // ── Angular precision (code 179) ──────────────────────────────────────────
  emit(out, '179', num(s.dimadec));

  // ── Unit format codes (270-289) ───────────────────────────────────────────
  emit(out, '270', num(LINEAR_UNIT_DXF[s.dimlunit]));
  emit(out, '271', num(s.dimdec));
  emit(out, '272', num(s.dimtdec));
  emit(out, '273', num(LINEAR_UNIT_DXF[s.dimaltu]));
  emit(out, '274', '2');                     // DIMALTTD (alt tolerance dec — default to dimdec)
  emit(out, '275', num(ANGULAR_UNIT_DXF[s.dimaunit]));
  emit(out, '276', '0');                     // DIMFRAC (fractional format, 0=horizontal)
  emit(out, '277', num(LINEAR_UNIT_DXF[s.dimlunit]));  // duplicate of 270 (DIMLUNIT in some R2000 files)
  emit(out, '278', num(s.dimdsep === '.' ? 46 : 44));  // ASCII: '.'=46  ','=44
  emit(out, '279', num(s.dimtmove));
  emit(out, '280', '0');                     // DIMJUST (horizontal text position, 0=centred)
  emit(out, '281', flag(s.suppressDimLine1));
  emit(out, '282', flag(s.suppressDimLine2));
  emit(out, '283', num(TOL_JUSTIFY_DXF[s.dimtolj]));
  emit(out, '284', '0');                     // DIMTZIN
  emit(out, '285', '0');                     // DIMALTZ
  emit(out, '286', '0');                     // DIMALTTZ
  emit(out, '288', '0');                     // DIMUPT
  emit(out, '289', num(s.dimatfit));

  // ── Handles (340-344) — 0 = no explicit style/block ref ───────────────────
  emit(out, '340', '0');  // DIMTXSTY (text style)
  emit(out, '341', '0');  // DIMLDRBLK (leader arrowhead)
  emit(out, '342', '0');  // DIMBLK
  emit(out, '343', '0');  // DIMBLK1
  emit(out, '344', '0');  // DIMBLK2

  // ── Line weights (371-372) ─────────────────────────────────────────────────
  emit(out, '371', '-2'); // DIMLWD (ByLayer = -2)
  emit(out, '372', '-2'); // DIMLWE (ByLayer = -2)
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit a DXF `TABLES` section containing the DIMSTYLE table for the given styles.
 * Returns alternating code/value lines (line 2i = code, 2i+1 = value).
 * Wrap in the caller's SECTION/ENDSEC markers if composing a full DXF file,
 * or pass directly to `parseDimStyles()` for roundtrip testing.
 */
export function writeDimStyleTable(styles: ReadonlyArray<DimStyle>): string[] {
  const out: string[] = [];

  emit(out, '0', 'SECTION');
  emit(out, '2', 'TABLES');
  emit(out, '0', 'TABLE');
  emit(out, '2', 'DIMSTYLE');
  emit(out, '70', String(styles.length));

  for (const style of styles) {
    emitOneDimStyle(out, style);
  }

  emit(out, '0', 'ENDTAB');
  emit(out, '0', 'ENDSEC');

  return out;
}
