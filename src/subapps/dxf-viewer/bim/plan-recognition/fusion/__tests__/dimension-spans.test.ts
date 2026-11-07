/**
 * ⚓ ADR-929 Φ5.5 — **δέσιμο από τις γραμμές επέκτασης**: ποιες παρειές μετρά κάθε διάσταση, από το ίδιο το σχέδιο.
 *
 * Το σπίτι του `fusion-fixture.ts` (ταυτοτική ευθυγράμμιση, ακριβής αλήθεια) + μια γραμμή διάστασης κάτω από αυτό
 * (y = 4800 mm) με κατακόρυφες επεκτάσεις που σταματούν λίγο πριν από τον τοίχο (πόδι στο y = 4185, παρειά στο 4125).
 */

import { describe, expect, it } from '@jest/globals';
import type { PlanExtensionAnchor, PlanSegmentRole, RasterSegment } from '../../plan-recognition-types';
import { fusePlan } from '../plan-fusion';
import type { PlanFusionInput, PlanFusionResult } from '../plan-fusion-types';
import { KNOWN_SCALE, PX_PER_MM, dimensionOf, fusionInput, houseSegments, reading, segment, textAt } from './fusion-fixture';

const DIM_Y = 4800;
const FOOT_Y = 4185;
/** Επέκταση: αρχή λίγο πέρα από τη γραμμή διάστασης, τέλος (= πόδι) λίγο πριν από τον τοίχο. */
const ext = (id: string, x: number, footY = FOOT_Y): RasterSegment => segment(id, x, DIM_Y + 50, x, footY);
const foot = (id: string): PlanExtensionAnchor => ({ extensionId: id, foot: 'end' });
const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });

interface DrawnDimension {
  /** Τα κομμάτια της γραμμής διάστασης `[x0, x1]` (mm) και οι επεκτάσεις που αγκυρώνει το καθένα. */
  readonly pieces: readonly { readonly x0: number; readonly x1: number; readonly anchors: readonly string[] }[];
  readonly extensions: readonly RasterSegment[];
}

/** Το σπίτι + μια σχεδιασμένη διάσταση, με ρόλους και άγκυρες όπως θα τα έδινε ο ταξινομητής. */
function drawn(d: DrawnDimension, withAnchors = true): Pick<PlanFusionInput, 'segments' | 'segmentRoles' | 'extensionAnchors'> {
  const pieces = d.pieces.map((p, i) => ({ seg: segment(`d${i}`, p.x0, DIM_Y, p.x1, DIM_Y), anchors: p.anchors }));
  const roles = new Map<string, PlanSegmentRole>([
    ...pieces.map((p) => [p.seg.id, 'dimension-line'] as const),
    ...d.extensions.map((e) => [e.id, 'extension-line'] as const),
  ]);
  const anchors = new Map(pieces.filter((p) => p.anchors.length > 0).map((p) => [p.seg.id, p.anchors.map(foot)] as const));
  return {
    segments: [...houseSegments(), ...pieces.map((p) => p.seg), ...d.extensions],
    segmentRoles: roles,
    extensionAnchors: withAnchors ? anchors : undefined,
  };
}

const lineOf = (r: PlanFusionResult, segmentId: string): string | undefined => r.faceLines.find((l) => l.segmentIds.includes(segmentId))?.id;

/** Η ολική διάσταση από εξωτερική σε εξωτερική παρειά (−125 … 6125). */
const OVERALL: DrawnDimension = {
  pieces: [{ x0: -125, x1: 6125, anchors: ['e-west', 'e-east'] }],
  extensions: [ext('e-west', -125), ext('e-east', 6125)],
};

describe('ADR-929 Φ5.5 — ανοίγματα διαστάσεων χωρίς ανάγνωση', () => {
  it('ολική διάσταση ⇒ ένα άνοιγμα, με τις δύο εξωτερικές παρειές και την απόστασή τους', () => {
    const r = fusePlan(fusionInput({ ...drawn(OVERALL), reading: null }));
    expect(r.dimensionSpans).toHaveLength(1);
    const [span] = r.dimensionSpans;
    expect(new Set(span.ends.map((e) => e.lineId))).toEqual(new Set([lineOf(r, 'v0'), lineOf(r, 'v5')]));
    expect(span.gapPx).toBeCloseTo(6250 * PX_PER_MM, 1);
  });

  it('αλυσίδα σε ΕΝΑ τμήμα (ενδιάμεση επέκταση που το τέμνει) ⇒ δύο ανοίγματα με κοινή παρειά', () => {
    const chain: DrawnDimension = {
      pieces: [{ x0: -125, x1: 6125, anchors: ['e-west', 'e-mid', 'e-east'] }],
      extensions: [ext('e-west', -125), ext('e-mid', 3450, 3935), ext('e-east', 6125)],
    };
    const r = fusePlan(fusionInput({ ...drawn(chain), reading: null }));
    const pairs = r.dimensionSpans.map((s) => new Set(s.ends.map((e) => e.lineId)));
    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual(new Set([lineOf(r, 'v0'), lineOf(r, 'v2')]));
    expect(pairs).toContainEqual(new Set([lineOf(r, 'v2'), lineOf(r, 'v5')]));
  });

  it('κείμενο που διακόπτει τη γραμμή (δύο κομμάτια, άγκυρες στα έξω άκρα) ⇒ ΕΝΑ άνοιγμα, όχι κανένα', () => {
    const interrupted: DrawnDimension = {
      pieces: [{ x0: -125, x1: 2600, anchors: ['e-west'] }, { x0: 3400, x1: 6125, anchors: ['e-east'] }],
      extensions: [ext('e-west', -125), ext('e-east', 6125)],
    };
    const r = fusePlan(fusionInput({ ...drawn(interrupted), reading: null }));
    expect(r.dimensionSpans).toHaveLength(1);
  });

  it('δύο άσχετα κομμάτια με μεγάλο κενό ανάμεσα ⇒ κανένα άνοιγμα (το μελάνι δεν καλύπτει)', () => {
    const apart: DrawnDimension = {
      pieces: [{ x0: -125, x1: 400, anchors: ['e-west'] }, { x0: 5600, x1: 6125, anchors: ['e-east'] }],
      extensions: [ext('e-west', -125), ext('e-east', 6125)],
    };
    expect(fusePlan(fusionInput({ ...drawn(apart), reading: null })).dimensionSpans).toEqual([]);
  });

  it('πόδι που δεν καταλήγει σε παρειά ⇒ `lineId: null`, ποτέ μαντεψιά', () => {
    const toNowhere: DrawnDimension = {
      pieces: [{ x0: -125, x1: 1500, anchors: ['e-west', 'e-void'] }],
      extensions: [ext('e-west', -125), ext('e-void', 1500)],
    };
    const r = fusePlan(fusionInput({ ...drawn(toNowhere), reading: null }));
    expect(r.dimensionSpans).toHaveLength(1);
    expect(r.dimensionSpans[0].ends.map((e) => e.lineId)).toContain(null);
  });

  it('χωρίς άγκυρες (παλιά αποθηκευμένη εκτέλεση) ⇒ κανένα άνοιγμα, η σύντηξη όπως πριν', () => {
    expect(fusePlan(fusionInput({ ...drawn(OVERALL, false), reading: null })).dimensionSpans).toEqual([]);
  });
});

describe('ADR-929 Φ5.5 — οι επεκτάσεις είναι η δέση, η τιμή κρίνεται από τον λύτη', () => {
  /** «5.75» στη μέση της ολικής: ταιριάζει ΚΑΤΑ ΣΥΜΠΤΩΣΗ στις εσωτερικές παρειές (125 … 5875), επίσης κεντραρισμένες. */
  const wrongValue = () => read(reading({ texts: [textAt('t', '5.75', 3000, 4720, 'h')], dimensions: [dimensionOf('t', 5750)] }));

  it('έλεγχος: χωρίς άγκυρες η Φ4 δένει σιωπηλά τις εσωτερικές παρειές (το σφάλμα που κλείνει η Φ5.5)', () => {
    const r = fusePlan(fusionInput({ ...drawn(OVERALL, false), reading: wrongValue(), knownScale: KNOWN_SCALE }));
    const b = r.dimensions[0].binding;
    expect(new Set([b?.lineA, b?.lineB])).toEqual(new Set([lineOf(r, 'v1'), lineOf(r, 'v4')]));
  });

  it('με άγκυρες: δέση στις εξωτερικές, εκτός ανοχής ⇒ σύγκρουση και ερώτηση, όχι «διόρθωση»', () => {
    const r = fusePlan(fusionInput({ ...drawn(OVERALL), reading: wrongValue(), knownScale: KNOWN_SCALE }));
    const d = r.dimensions[0];
    expect(new Set([d.binding?.lineA, d.binding?.lineB])).toEqual(new Set([lineOf(r, 'v0'), lineOf(r, 'v5')]));
    expect(d.binding?.source).toBe('extension');
    expect(d.binding?.withinTolerance).toBe(false);
    expect(d.status).toBe('conflict');
    expect(r.questions.map((q) => q.kind)).toContain('dimension-conflict');
  });

  it('αλυσίδα με σωστές τιμές ⇒ κάθε κείμενο στο δικό του άνοιγμα, πηγή «extension», συνεπείς', () => {
    const chain = drawn({
      pieces: [{ x0: -125, x1: 6125, anchors: ['e-west', 'e-mid', 'e-east'] }],
      extensions: [ext('e-west', -125), ext('e-mid', 3450, 3935), ext('e-east', 6125)],
    });
    const texts = [textAt('t-a', '3.575', 1662.5, 4720, 'h'), textAt('t-b', '2.675', 4787.5, 4720, 'h')];
    const dims = [dimensionOf('t-a', 3575), dimensionOf('t-b', 2675)];
    const r = fusePlan(fusionInput({ ...chain, reading: read(reading({ texts, dimensions: dims })), knownScale: KNOWN_SCALE }));
    const byText = new Map(r.dimensions.map((d) => [d.textId, d]));
    expect(new Set([byText.get('t-a')?.binding?.lineA, byText.get('t-a')?.binding?.lineB])).toEqual(new Set([lineOf(r, 'v0'), lineOf(r, 'v2')]));
    expect(new Set([byText.get('t-b')?.binding?.lineA, byText.get('t-b')?.binding?.lineB])).toEqual(new Set([lineOf(r, 'v2'), lineOf(r, 'v5')]));
    for (const d of r.dimensions) {
      expect(d.binding?.source).toBe('extension');
      expect(d.status).not.toBe('conflict');
    }
  });
});
