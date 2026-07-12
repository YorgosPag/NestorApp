/**
 * ADR-510 Φ2H — imported dashed line renders at a VISIBLE density (regression for the
 * "ΔΙΑΚΕΚΟΜΜΕΝΗ.dxf → looks solid" bug).
 *
 * The source is a faithful minimal copy of the user's R12/AC1009 file: one LINE on a
 * meter-scale drawing (no $INSUNITS → ADR-462 detects metres → geometry ×1000) with an
 * explicit `ACAD_ISO10W100` linetype (group 6, period 18). Without the per-scene LTSCALE
 * the 18 mm pattern on a 13272 mm line = 737 sub-pixel periods → solid. With it, the
 * scene carries an auto-fit `linetypeScale` that lands the density in a visible band.
 */

import { runDxfParse } from '../run-dxf-parse';

const DXF = [
  '0', 'SECTION', '2', 'HEADER',
  '9', '$ACADVER', '1', 'AC1009',
  '9', '$LTSCALE', '40', '1.0',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'TABLES',
  '0', 'TABLE', '2', 'LTYPE', '70', '2',
  '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
  '0', 'LTYPE', '2', 'ACAD_ISO10W100', '70', '0',
  '3', 'ISO dash dot __ . __ . __ . __ . __ . __ . __ .',
  '72', '65', '73', '4', '40', '18.0',
  '49', '12.0', '49', '-3.0', '49', '0.0', '49', '-3.0',
  '0', 'ENDTAB',
  '0', 'TABLE', '2', 'LAYER', '70', '2',
  '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
  '0', 'LAYER', '2', '06', '70', '0', '62', '1', '6', 'CONTINUOUS',
  '0', 'ENDTAB',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LINE', '5', '2B8', '8', '06', '6', 'ACAD_ISO10W100',
  '10', '2684.5235298532948036', '20', '1545.299004671998091', '30', '0.0',
  '11', '2684.5235298532948036', '21', '1532.0262260665078884', '31', '0.0',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

const PATTERN_PERIOD_MM = 18; // 12 + 3 + 0 + 3

test('meter-scale ACAD_ISO10W100 line gets a per-scene LTSCALE → visible dash density', () => {
  const result = runDxfParse(DXF, undefined, { normalizeBounds: true });
  expect(result.success).toBe(true);
  const scene = result.scene!;

  // Geometry baked to mm (metres ×1000) — the ADR-462 canonical-mm scale.
  const line = scene.entities.find((e) => e.type === 'line') as
    | { start: { x: number; y: number }; end: { x: number; y: number }; linetypeName?: string }
    | undefined;
  expect(line?.linetypeName).toBe('ACAD_ISO10W100');
  const lineLenMm = Math.hypot(line!.end.x - line!.start.x, line!.end.y - line!.start.y);
  expect(lineLenMm).toBeGreaterThan(10_000); // ≈ 13272 mm

  // A per-scene base LTSCALE was resolved (auto-fit, since file $LTSCALE == 1 default).
  expect(scene.linetypeScale).toBeDefined();
  expect(scene.linetypeScale!).toBeGreaterThan(1); // meter-scale → scaled UP

  // The effective dash density on the line is now visible (not 737 sub-pixel periods,
  // not <1 single dash) — the whole point of the fix.
  const periodsOnLine = lineLenMm / (PATTERN_PERIOD_MM * scene.linetypeScale!);
  expect(periodsOnLine).toBeGreaterThan(8);
  expect(periodsOnLine).toBeLessThan(60);
});

test('explicit non-default file $LTSCALE is honoured verbatim (faithful)', () => {
  // Same content, but the drawing declares an explicit non-default $LTSCALE → trusted.
  const src = DXF.replace('$LTSCALE\n40\n1.0', '$LTSCALE\n40\n0.25');
  expect(src).toContain('$LTSCALE\n40\n0.25'); // guard: the swap actually happened
  const result = runDxfParse(src, undefined, { normalizeBounds: true });
  expect(result.success).toBe(true);
  expect(result.scene!.linetypeScale).toBe(0.25);
});
