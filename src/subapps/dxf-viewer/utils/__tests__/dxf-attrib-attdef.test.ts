/**
 * ADR-635 Φάση B Batch 2 — ATTRIB / ATTDEF → type:'text' converters + block-expander
 * ATTDEF guard.
 *
 * Proves:
 *  - ATTRIB value (code 1) becomes visible text at its own WCS position/rotation/height.
 *  - tag (code 2) → attributeTag (survives without a cast, N.2).
 *  - 70 bit 1 (invisible) → visible:false (imported but hidden — AutoCAD parity).
 *  - ATTDEF renders its default value (code 1); the prompt (code 3) is NOT rendered.
 *  - empty value → null (skip), color (code 62) round-trips.
 *  - GUARD: an ATTDEF template inside a BLOCK is skipped per-INSERT (no stale default
 *    stamped); only the standalone ATTRIB's real value reaches the scene.
 */
import { convertAttrib, convertAttdef } from '../dxf-text-converters';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { AnySceneEntity } from '../../types/scene';

type TextShape = {
  type: string;
  text: string;
  visible: boolean;
  attributeTag?: string;
  rotation?: number;
  height?: number;
  position: { x: number; y: number };
  color?: string;
};
const asText = (e: AnySceneEntity | null): TextShape => e as unknown as TextShape;

function attribData(overrides: Record<string, string> = {}): Record<string, string> {
  return { '10': '500', '20': '400', '40': '2.5', '50': '0', '1': 'DOOR-01', '2': 'DOOR', ...overrides };
}

describe('convertAttrib (ADR-635 Φάση B Batch 2)', () => {
  it('εξάγει το value (code 1) ως ορατό text στη θέση/ύψος/γωνία του', () => {
    const e = asText(convertAttrib(attribData({ '50': '90' }), 'A1', 0));
    expect(e.type).toBe('text');
    expect(e.text).toBe('DOOR-01');
    expect(e.position).toEqual({ x: 500, y: 400 });
    expect(e.height).toBe(2.5);
    expect(e.rotation).toBe(90);
    expect(e.visible).toBe(true);
  });

  it('χαρτογραφεί το tag (code 2) → attributeTag (χωρίς cast, N.2)', () => {
    expect(asText(convertAttrib(attribData(), 'A1', 1)).attributeTag).toBe('DOOR');
  });

  it('70 bit 1 (invisible) → visible:false αλλά εισάγεται', () => {
    const e = asText(convertAttrib(attribData({ '70': '1' }), 'A1', 2));
    expect(e.visible).toBe(false);
    expect(e.text).toBe('DOOR-01');
  });

  it('επιστρέφει null όταν το value είναι κενό (skip)', () => {
    expect(convertAttrib(attribData({ '1': '   ' }), 'A1', 3)).toBeNull();
    expect(convertAttrib(attribData({ '1': '' }), 'A1', 4)).toBeNull();
  });

  it('εξάγει χρώμα από code 62 (ACI)', () => {
    expect(asText(convertAttrib(attribData({ '62': '1' }), 'A1', 5)).color).toBeDefined();
  });

  it('δεν θέτει attributeTag όταν λείπει το code 2', () => {
    const e = attribData();
    delete e['2'];
    expect(asText(convertAttrib(e, 'A1', 6)).attributeTag).toBeUndefined();
  });
});

describe('convertAttdef (ADR-635 Φάση B Batch 2)', () => {
  it('ζωγραφίζει το default value (code 1), ΟΧΙ το prompt (code 3)', () => {
    const e = asText(convertAttdef(attribData({ '1': 'DEFAULT', '3': 'Enter door id:' }), 'A1', 0));
    expect(e.type).toBe('text');
    expect(e.text).toBe('DEFAULT');
    expect(e.text).not.toContain('Enter door id');
  });

  it('επιστρέφει null όταν το default value είναι κενό (μόνο tag/prompt)', () => {
    expect(convertAttdef({ '10': '0', '20': '0', '2': 'DOOR', '3': 'Enter:' }, 'A1', 1)).toBeNull();
  });
});

// ── Block-expander ATTDEF guard (integration via DxfSceneBuilder) ──────────────

function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

/** Minimal DXF with a BLOCKS body + an ENTITIES body, built at mm (scale factor 1). */
function build(blocks: string[], entities: string[]): AnySceneEntity[] {
  const content = [
    ...lines(['0', 'SECTION'], ['2', 'BLOCKS']), ...blocks, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...entities, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'EOF']),
  ].join('\n');
  return DxfSceneBuilder.buildScene(content, 'mm').entities;
}

describe('block-expander ATTDEF guard (ADR-635 Φάση B Batch 2)', () => {
  it('ΔΕΝ κάνει stamp το ATTDEF default σε κάθε INSERT — μόνο το πραγματικό ATTRIB φτάνει', () => {
    const es = build(
      // BLOCK TITLE: μια LINE (ορατή geometry) + ένα ATTDEF template (tag DOOR, default "N/A")
      lines(
        ['0', 'BLOCK'], ['2', 'TITLE'], ['10', 0], ['20', 0], ['30', 0],
        ['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 10], ['21', 0],
        ['0', 'ATTDEF'], ['8', '0'], ['10', 0], ['20', 0], ['40', 2.5], ['1', 'N/A'], ['2', 'DOOR'], ['3', 'Enter:'],
        ['0', 'ENDBLK'],
      ),
      // INSERT του TITLE + το standalone ATTRIB με το πραγματικό value "REAL"
      [
        ...lines(['0', 'INSERT'], ['2', 'TITLE'], ['10', 100], ['20', 100]),
        ...lines(['0', 'ATTRIB'], ['8', '0'], ['10', 100], ['20', 100], ['40', 2.5], ['1', 'REAL'], ['2', 'DOOR']),
      ],
    );

    const texts = es.filter(e => e.type === 'text').map(asText);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('REAL');
    expect(texts.some(t => t.text === 'N/A')).toBe(false);
    // Η geometry του block πρέπει να παραμένει (guard δεν σκοτώνει το block).
    expect(es.some(e => e.type === 'line')).toBe(true);
  });
});
