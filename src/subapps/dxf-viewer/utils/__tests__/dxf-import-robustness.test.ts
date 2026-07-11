import { DxfSceneBuilder } from '../dxf-scene-builder';
import { DxfEntityParser } from '../dxf-entity-parser';
import {
  summarizeDiagnostics,
  totalSkipped,
  isClean,
  type ImportDiagnostics,
} from '../dxf-import-diagnostics';

/**
 * ADR-635 Φ3 — fault-tolerant DXF import (Revit/Figma-level robustness).
 *
 * A professional importer never aborts a whole file over one bad entity, never hangs on a
 * malformed/huge MINSERT array, and reports what it skipped. These tests pin that contract.
 */

function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

function buildDiag(entities: string[], blocks: string[] = []): {
  count: number;
  diagnostics: ImportDiagnostics;
} {
  const content = [
    ...lines(['0', 'SECTION'], ['2', 'BLOCKS']), ...blocks, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...entities, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'EOF']),
  ].join('\n');
  const { scene, diagnostics } = DxfSceneBuilder.buildSceneWithDiagnostics(content, 'mm');
  return { count: scene.entities.length, diagnostics };
}

describe('ADR-635 Φ3 — fault-tolerant import diagnostics', () => {
  it('reports a fully clean import (nothing skipped/failed/clamped)', () => {
    const { count, diagnostics } = buildDiag(
      lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 10], ['21', 10]),
    );
    expect(count).toBe(1);
    expect(isClean(diagnostics)).toBe(true);
    expect(diagnostics.parsedByType.LINE).toBe(1);
    expect(summarizeDiagnostics(diagnostics)).toEqual([]);
  });

  it('imports supported entities AND records unsupported ones instead of dropping silently', () => {
    // SOLID is parsed but has no converter → previously vanished with no trace; now counted.
    const { count, diagnostics } = buildDiag([
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 10], ['21', 10]),
      ...lines(['0', 'SOLID'], ['8', '0'], ['10', 0], ['20', 0]),
      ...lines(['0', 'SOLID'], ['8', '0'], ['10', 5], ['20', 5]),
    ]);
    expect(count).toBe(1);                       // only the LINE became a scene entity
    expect(diagnostics.parsedByType.LINE).toBe(1);
    expect(diagnostics.skippedByType.SOLID).toBe(2);
    expect(totalSkipped(diagnostics)).toBe(2);
    expect(summarizeDiagnostics(diagnostics)[0]).toContain('SOLID×2');
  });

  it('bounds a pathological MINSERT array instead of hanging, and records the clamp', () => {
    const block = lines(
      ['0', 'BLOCK'], ['2', 'B'], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 1], ['21', 0],
      ['0', 'ENDBLK'],
    );
    // 100000×100000 = 10^10 requested cells → must clamp to the 10_000 cap.
    const { count, diagnostics } = buildDiag(
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0],
        ['70', 100000], ['71', 100000], ['44', 1], ['45', 1]),
      block,
    );
    expect(count).toBeLessThanOrEqual(10_000);   // one line per cell, capped
    expect(diagnostics.clamps.length).toBeGreaterThan(0);
    expect(diagnostics.clamps[0].kind).toBe('MINSERT');
    expect(summarizeDiagnostics(diagnostics).some(l => l.includes('Expansion limited'))).toBe(true);
  });

  it('does not throw on a truncated DXF (a lone 0 marker at the very end)', () => {
    const content = [
      ...lines(['0', 'SECTION'], ['2', 'ENTITIES']),
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 1], ['21', 1]),
      '0', // dangling code with no value line — would crash an unguarded lines[i+1].trim()
    ].join('\n');
    expect(() => DxfSceneBuilder.buildSceneWithDiagnostics(content, 'mm')).not.toThrow();
  });

  it('keeps buildScene() backward-compatible (returns the scene only)', () => {
    const content = [
      ...lines(['0', 'SECTION'], ['2', 'ENTITIES']),
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 1], ['21', 1]),
      ...lines(['0', 'ENDSEC'], ['0', 'EOF']),
    ].join('\n');
    const scene = DxfSceneBuilder.buildScene(content, 'mm');
    expect(scene.entities).toHaveLength(1);
    expect(scene.units).toBe('mm');
  });
});

describe('ADR-635 Φ3 follow-up — parser-level skipped-warning (unsupported entity TYPES)', () => {
  it('records a genuinely-unsupported TYPE dropped by the parser (REGION never reached the converter loop)', () => {
    // REGION is NOT in SUPPORTED_ENTITY_TYPES → parseEntityAt dropped it BEFORE the scene-builder
    // converter loop, so it used to vanish with zero trace (no scene entity, no warning).
    const { count, diagnostics } = buildDiag([
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 10], ['21', 10]),
      ...lines(['0', 'REGION'], ['8', '0'], ['100', 'AcDbModelerGeometry']),
      ...lines(['0', 'REGION'], ['8', '0'], ['100', 'AcDbModelerGeometry']),
      ...lines(['0', '3DSOLID'], ['8', '0'], ['100', 'AcDbModelerGeometry']),
    ]);
    expect(count).toBe(1); // only the LINE survived
    expect(diagnostics.parsedByType.LINE).toBe(1);
    expect(diagnostics.skippedByType.REGION).toBe(2);
    expect(diagnostics.skippedByType['3DSOLID']).toBe(1);
    expect(totalSkipped(diagnostics)).toBe(3);
    expect(summarizeDiagnostics(diagnostics)[0]).toContain('REGION×2');
  });

  it('records an unsupported TYPE inside a BLOCK definition (lost from every INSERT of that block)', () => {
    const block = lines(
      ['0', 'BLOCK'], ['2', 'B'], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'MESH'], ['8', '0'], ['100', 'AcDbSubDMesh'],
      ['0', 'ENDBLK'],
    );
    const { diagnostics } = buildDiag(
      lines(['0', 'INSERT'], ['2', 'B'], ['10', 0], ['20', 0]),
      block,
    );
    // The MESH member is unsupported → recorded once when the block definition is parsed.
    expect(diagnostics.skippedByType.MESH).toBe(1);
  });

  it('does NOT warn about section markers or structural sub-markers (SEQEND/VERTEX/ENDSEC)', () => {
    // A stray SEQEND leaking to the top-level dispatch must stay silent (structural, not geometry).
    const { diagnostics } = buildDiag([
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 1], ['21', 1]),
      ...lines(['0', 'SEQEND'], ['8', '0']),
    ]);
    expect(diagnostics.skippedByType.SEQEND).toBeUndefined();
    expect(diagnostics.skippedByType.ENDSEC).toBeUndefined();
    expect(totalSkipped(diagnostics)).toBe(0);
    expect(isClean(diagnostics)).toBe(true);
  });

  it('parseEntities stays backward-compatible when no diagnostics collector is threaded', () => {
    // The optional collector is a no-op when absent — the raw parser API must not change behaviour.
    const raw = [
      ...lines(['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 1], ['21', 1]),
      ...lines(['0', 'REGION'], ['8', '0']),
    ];
    const entities = DxfEntityParser.parseEntities(raw);
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe('LINE');
  });
});
