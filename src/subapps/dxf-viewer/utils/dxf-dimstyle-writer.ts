/**
 * DXF DIMSTYLE Table Writer — ADR-362 Phase H1 + Round 25 (production wiring).
 *
 * SSoT for the DXF DIMSTYLE group-code mapping. The per-style core (`emitDimStyle`)
 * writes through the generic `DimGroupSink`, so it serves BOTH:
 *   - `writeDimStyleTable(...)` — standalone `TABLES` section, unscaled `string[]`
 *     for the in-process roundtrip tests (write → `parseDimStyles()`, lossless);
 *   - the production client-side exporter (`export/core/dxf-ascii-writer.ts`),
 *     which prepends a `TABLES → DIMSTYLE` section (the styles the exported
 *     dimensions reference) so they resolve to a real style instead of STANDARD.
 *
 * Model-space scaling: DIMSCALE (code 40) is multiplied by the coordinate `scale`
 * — a SINGLE knob that scales every dimension SIZE field (arrows/text/gaps) in
 * AutoCAD, so the appearance stays correct after unit conversion (mm→m, …). At
 * scale 1 (default mm→mm export) it is a no-op → the roundtrip tests are unchanged.
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
import type { DimGroupSink } from './dxf-dimension-writer';
import type { HandleAllocator } from '../export/core/dxf-ascii-handle-allocator';
import { findClosestAci } from '../settings/standards/aci';
import { trueColorToHex } from './dxf-true-color';

/**
 * ADR-562 Φ7 — DIMSTYLE colours are ACI-only in DXF (no true-color group code).
 * When a Nestor true-color companion is present, degrade to the nearest ACI so the
 * exported 176/177/178 codes stay valid. (The ribbon bridge already keeps the ACI
 * channel in sync, so this is belt-and-suspenders for any true-color-only path.)
 */
function dimColorAci(aci: number, trueColor?: number | null): number {
  return trueColor != null ? findClosestAci(trueColorToHex(trueColor)) : aci;
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

// ──────────────────────────────────────────────────────────────────────────────
// Per-style emitter (SSoT core — shared by the test table writer + production)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit ONE DIMSTYLE record through `sink`. `scale` (coordinate scale) is applied
 * ONLY to DIMSCALE (code 40) — AutoCAD's single multiplier for every dimension
 * SIZE field — so the appearance stays correct after unit conversion. All other
 * fields are unit-independent (factors/flags/enums/colours) or are paper-relative
 * sizes that DIMSCALE governs. At scale 1 it is a no-op.
 */
export function emitDimStyle(
  sink: DimGroupSink, s: DimStyle, scale = 1,
  ownerHandle?: string, allocator?: HandleAllocator,
): void {
  sink(0, 'DIMSTYLE');
  // ADR-644 (#9) — R2018 DIMSTYLE record: handle is group **105** (not 5), owner 330 → the DIMSTYLE
  // table, plus the two subclass markers. Gated on the allocator so `writeDimStyleTable` (round-trip)
  // stays byte-identical. Emitted FIRST so the writer's lazy-injection sink sees 105 and skips.
  if (allocator && ownerHandle) {
    sink(105, allocator.next());
    sink(330, ownerHandle);
    sink(100, 'AcDbSymbolTableRecord');
    sink(100, 'AcDbDimStyleTableRecord');
  }
  sink(2, s.name);
  sink(70, 0);                          // flags (standard = 0)

  // ── Scale / geometry (codes 40-48) ────────────────────────────────────────
  sink(40, s.dimscale * scale);         // DIMSCALE × coordinate scale (model-space sizing)
  sink(41, s.dimasz);
  sink(42, s.dimexo);
  sink(43, s.dimdli);
  sink(44, s.dimexe);
  sink(45, s.dimrnd);
  sink(46, 0);                          // DIMDLE (ext line extension beyond ticks)
  sink(47, s.dimtp);
  sink(48, Math.abs(s.dimtm));          // DIMTM emitted as positive (AutoCAD spec)

  // ── Text / tolerances (codes 140-148) ─────────────────────────────────────
  sink(140, s.dimtxt);
  sink(141, s.dimcen);
  sink(142, 0);                         // DIMTSZ (tick size, 0 = use arrows)
  sink(143, s.dimaltf);
  sink(144, s.dimlfac);
  sink(145, 0);                         // DIMTVP (text vertical position offset)
  sink(146, s.dimtfac);
  sink(147, s.dimgap);
  sink(148, s.dimaltrnd);

  // ── Boolean / enum flags (codes 71-79) ────────────────────────────────────
  sink(71, flag(s.dimtol));
  sink(72, flag(s.dimlim));
  sink(73, flag(s.dimtih));
  sink(74, flag(s.dimtoh));
  sink(75, flag(s.suppressExtLine1));
  sink(76, flag(s.suppressExtLine2));
  sink(77, TEXT_VERTICAL_DXF[s.dimtad]);
  sink(78, s.dimzin);
  sink(79, 0);                          // DIMAZIN (angular zero suppression)

  // ── Alternate units flags (codes 170-178) ─────────────────────────────────
  sink(170, flag(s.dimalt));
  sink(171, s.dimaltd);
  sink(172, flag(s.dimtofl));
  // DIMSAH (separate arrowheads, use DIMBLK1/2). ADR-362 Round 36 — per-side
  // endpoint-marker visibility (`suppressArrow1/2`) is an INTERNAL channel persisted
  // via the scene model (`entity.overrides`), so it round-trips losslessly inside the
  // app. It is NOT emitted here: this simplified writer never emits arrowhead BLOCK
  // names/handles either (342-344 = 0 below → default closed-filled), so there is no
  // block to degrade to `_NONE`. Faking DIMSAH=1 without block records would produce
  // an invalid DIMSTYLE. Extension/dim-line suppression DO round-trip (codes 75/76/281/282).
  sink(173, 0);
  sink(174, flag(s.dimtix));
  sink(175, 0);                         // DIMSOXD

  // ── Colors (codes 176-178) ────────────────────────────────────────────────
  // ADR-562 Φ7 — degrade any true-color companion to nearest ACI (no true-color
  // group code exists for DIMSTYLE).
  sink(176, dimColorAci(s.dimclrd, s.dimclrdTrueColor));
  sink(177, dimColorAci(s.dimclre, s.dimclreTrueColor));
  sink(178, dimColorAci(s.dimclrt, s.dimclrtTrueColor));

  // ── Angular precision (code 179) ──────────────────────────────────────────
  sink(179, s.dimadec);

  // ── Unit format codes (270-289) ───────────────────────────────────────────
  sink(270, LINEAR_UNIT_DXF[s.dimlunit]);
  sink(271, s.dimdec);
  sink(272, s.dimtdec);
  sink(273, LINEAR_UNIT_DXF[s.dimaltu]);
  sink(274, 2);                         // DIMALTTD (alt tolerance dec — default to dimdec)
  sink(275, ANGULAR_UNIT_DXF[s.dimaunit]);
  sink(276, 0);                         // DIMFRAC (fractional format, 0=horizontal)
  sink(277, LINEAR_UNIT_DXF[s.dimlunit]); // duplicate of 270 (DIMLUNIT in some R2000 files)
  sink(278, s.dimdsep === '.' ? 46 : 44); // ASCII: '.'=46  ','=44
  sink(279, s.dimtmove);
  sink(280, 0);                         // DIMJUST (horizontal text position, 0=centred)
  sink(281, flag(s.suppressDimLine1));
  sink(282, flag(s.suppressDimLine2));
  sink(283, TOL_JUSTIFY_DXF[s.dimtolj]);
  sink(284, 0);                         // DIMTZIN
  sink(285, 0);                         // DIMALTZ
  sink(286, 0);                         // DIMALTTZ
  sink(288, 0);                         // DIMUPT
  sink(289, s.dimatfit);

  // ── Handles (340-344) — 0 = no explicit style/block ref ───────────────────
  sink(340, 0);  // DIMTXSTY (text style)
  sink(341, 0);  // DIMLDRBLK (leader arrowhead)
  sink(342, 0);  // DIMBLK
  sink(343, 0);  // DIMBLK1
  sink(344, 0);  // DIMBLK2

  // ── Line weights (371-372) ─────────────────────────────────────────────────
  sink(371, -2); // DIMLWD (ByLayer = -2)
  sink(372, -2); // DIMLWE (ByLayer = -2)
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit a DXF `TABLES` section containing the DIMSTYLE table for the given styles.
 * Returns alternating code/value lines (line 2i = code, 2i+1 = value), unscaled,
 * for the in-process roundtrip tests. Production export feeds `emitDimStyle` a
 * scaled `pair` sink directly (see `export/core/dxf-ascii-writer.ts`).
 */
export function writeDimStyleTable(styles: ReadonlyArray<DimStyle>): string[] {
  const out: string[] = [];
  const sink: DimGroupSink = (code, value) => {
    out.push(String(code), typeof value === 'number' ? String(value) : value);
  };

  sink(0, 'SECTION');
  sink(2, 'TABLES');
  sink(0, 'TABLE');
  sink(2, 'DIMSTYLE');
  sink(70, styles.length);

  for (const style of styles) {
    emitDimStyle(sink, style, 1);
  }

  sink(0, 'ENDTAB');
  sink(0, 'ENDSEC');

  return out;
}
