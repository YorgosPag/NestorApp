/**
 * ADR-929 Φ3 — το συμβόλαιο σύρματος του αναγνώστη: ένα σχήμα zod ⇒ strict JSON schema της OpenAI **και** έλεγχος.
 */

import { parsePlanViewReading, planReadingJsonSchema, PLAN_VIEW_GRID } from '../reading/plan-reading-wire';

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Κάθε αντικείμενο του σχήματος, αναδρομικά. */
function objectsOf(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((n) => objectsOf(n, out));
  else if (isNode(node)) {
    if (node.type === 'object') out.push(node);
    Object.values(node).forEach((v) => objectsOf(v, out));
  }
  return out;
}

const box = { x0: 10, y0: 20, x1: 30, y1: 25 };
const valid = {
  texts: [
    { id: 't1', kind: 'dimension', raw: '3.50', box, confidence: 0.9 },
    { id: 't2', kind: 'room-name', raw: 'ΣΑΛΟΝΙ', box, confidence: 0.8 },
  ],
  dimensions: [{ textId: 't1', valueMm: 3500, segmentIds: ['ps1', 'ps2'], confidence: 0.9 }],
  writtenScale: null,
  rooms: [{ name: 'ΣΑΛΟΝΙ', nameTextId: 't2', writtenAreaM2: null, boundarySegmentIds: ['ps1'], confidence: 0.7 }],
  openings: [{ kind: 'door', hostSegmentId: 'ps2', alongFraction: 0.4, sizeTextId: null, confidence: 0.6 }],
};

describe('planReadingJsonSchema — OpenAI strict mode', () => {
  const schema = planReadingJsonSchema();

  it('has no $schema dialect key at the root', () => {
    expect(schema).not.toHaveProperty('$schema');
    expect(schema.type).toBe('object');
  });

  it('every object is closed and requires every property (strict structured outputs)', () => {
    const objects = objectsOf(schema);
    // ρίζα · κείμενο · πλαίσιο · διάσταση · κλίμακα · χώρος · άνοιγμα: μια πύλη που σαρώνει 0 αντικείμενα είναι κι αυτή «πράσινη».
    expect(objects).toHaveLength(7);
    for (const o of objects) {
      expect(o.additionalProperties).toBe(false);
      expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as Node).sort());
    }
  });
});

describe('parsePlanViewReading', () => {
  it('accepts a valid reading unchanged when every reference exists', () => {
    const r = parsePlanViewReading(valid, ['ps1', 'ps2']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dropped).toEqual({ unknownSegmentRefs: 0, unknownTextRefs: 0, openingsWithoutHost: 0 });
    expect(r.reading.dimensions[0].segmentIds).toEqual(['ps1', 'ps2']);
  });

  it('drops invented segment ids and counts them; an opening on an invented host is dropped whole', () => {
    const r = parsePlanViewReading(valid, ['ps1']);
    expect(r.ok && r.dropped).toEqual({ unknownSegmentRefs: 1, unknownTextRefs: 0, openingsWithoutHost: 1 });
    expect(r.ok && r.reading.dimensions[0].segmentIds).toEqual(['ps1']);
    expect(r.ok && r.reading.openings).toEqual([]);
  });

  it('drops a dimension whose text does not exist, and nulls a dangling room-name reference', () => {
    const raw = { ...valid, dimensions: [{ ...valid.dimensions[0], textId: 'tX' }], rooms: [{ ...valid.rooms[0], nameTextId: 'tY' }] };
    const r = parsePlanViewReading(raw, ['ps1', 'ps2']);
    expect(r.ok && r.reading.dimensions).toEqual([]);
    expect(r.ok && r.reading.rooms[0].nameTextId).toBeNull();
    expect(r.ok && r.dropped.unknownTextRefs).toBe(2);
  });

  it('clamps confidences and boxes instead of rejecting the whole reading', () => {
    const raw = { ...valid, texts: [{ ...valid.texts[0], confidence: 1.4, box: { x0: 1200, y0: -5, x1: 40, y1: 30 } }, valid.texts[1]] };
    const r = parsePlanViewReading(raw, ['ps1', 'ps2']);
    expect(r.ok && r.reading.texts[0].confidence).toBe(1);
    expect(r.ok && r.reading.texts[0].box).toEqual({ x0: 40, y0: 0, x1: PLAN_VIEW_GRID, y1: 30 });
  });

  it('keeps only the first of two texts with the same id', () => {
    const raw = { ...valid, texts: [...valid.texts, { ...valid.texts[0], raw: '9.99' }] };
    const r = parsePlanViewReading(raw, ['ps1', 'ps2']);
    expect(r.ok && r.reading.texts.map((t) => t.raw)).toEqual(['3.50', 'ΣΑΛΟΝΙ']);
  });

  it('a scale with a non-positive denominator is not a scale', () => {
    const raw = { ...valid, writtenScale: { textId: 't1', denominator: 0, confidence: 0.9 } };
    const r = parsePlanViewReading(raw, ['ps1']);
    expect(r.ok).toBe(true);
    expect(r.ok && r.reading.writtenScale).toBeNull();
  });

  it('a shape violation (missing field, unknown kind) fails with issues', () => {
    const { openings: _o, ...missing } = valid;
    expect(parsePlanViewReading(missing, []).ok).toBe(false);
    const badKind = { ...valid, texts: [{ ...valid.texts[0], kind: 'furniture' }] };
    const r = parsePlanViewReading(badKind, []);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.join(' ')).toMatch(/texts\.0\.kind/);
  });
});
