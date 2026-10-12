/**
 * ADR-911 Φ4-3β — ό,τι η προεπισκόπηση ανοιγμάτων δείχνει ΕΚΤΟΣ της καλής διαδρομής (η καλή
 * διαδρομή — «ό,τι φωτίστηκε είναι ό,τι γράφτηκε» — κρίνεται από τη γραμμένη σκηνή, στη σουίτα
 * του ελεγκτή).
 *
 *   · άρνηση του σχεδίου εγγραφής φαίνεται ΠΡΙΝ από την έγκριση, και τα «θα γραφτούν» δεν χάνονται
 *     από τον καμβά — πέφτουν στη λωρίδα τους·
 *   · «προς απόφαση» χωρίς θέση φωτίζει το ίδιο το σύμβολό του, ΚΑΙ όταν είναι τόξο·
 *   · οι ένοικοι ενός κενού είναι οι γραμμές που κρατά, όχι όλες οι ξένες γραμμές.
 */

import type { Entity } from '../../../types/entities';
import { isArcEntity } from '../../../types/entities';
import * as writePlan from '../opening-write-plan';
import { buildOpeningPreview } from '../opening-preview';
import type { OpeningProposal } from '../opening-proposal';
import { ENTITIES, LEVEL, OPENING, colorOf, propose, sceneOf, writtenWalls } from './opening-fixture';

jest.mock('../opening-write-plan', () => {
  const actual = jest.requireActual('../opening-write-plan');
  return { ...actual, planOpeningWrite: jest.fn(actual.planOpeningWrite) };
});
const planOpeningWrite = writePlan.planOpeningWrite as jest.MockedFunction<typeof writePlan.planOpeningWrite>;

const SCENE = sceneOf(writtenWalls(true));
const previewOf = (proposal: OpeningProposal, entities: readonly Entity[] = SCENE) =>
  buildOpeningPreview({ proposal, entities, levelId: LEVEL, sceneUnits: 'mm', choices: new Map() });

beforeEach(() => planOpeningWrite.mockClear());

describe('ADR-911 Φ4-3β — άρνηση του σχεδίου εγγραφής, ορατή πριν από την έγκριση', () => {
  it('η άρνηση περνά στην προεπισκόπηση· τα «θα γραφτούν» φωτίζονται ως λωρίδα, δεν εξαφανίζονται', () => {
    const proposal = propose(SCENE);
    planOpeningWrite.mockReturnValueOnce({ ok: false, refusal: 'overlap' });

    const preview = previewOf(proposal);

    expect(preview.refusal).toBe('overlap');
    const writable = preview.zones.filter((z) => z.status === 'door' || z.status === 'window');
    expect(writable).toHaveLength(12);
    for (const zone of writable) {
      expect(zone.pieces).toHaveLength(1);
      expect(zone.pieces[0]).toHaveLength(4);
    }
  });

  it('χωρίς άρνηση το πεδίο ΔΕΝ υπάρχει — ούτε ως undefined', () => {
    expect('refusal' in previewOf(propose(SCENE))).toBe(false);
  });

  it('τίποτα εγγράψιμο ⇒ το σχέδιο δεν ρωτιέται καν, και δεν υπάρχει άρνηση να φανεί', () => {
    const proposal = propose(SCENE);
    const onlyGaps: OpeningProposal = { ...proposal, items: proposal.items.filter((i) => i.symbol === 'none') };

    const preview = previewOf(onlyGaps);

    expect(planOpeningWrite).not.toHaveBeenCalled();
    expect('refusal' in preview).toBe(false);
  });

  it('το σχέδιο εγγραφής λαμβάνει ΜΟΝΟ τα εγγράψιμα στοιχεία, πάνω στη σκηνή της πρότασης', () => {
    const proposal = propose(SCENE);
    previewOf(proposal);

    const [input] = planOpeningWrite.mock.calls[0];
    expect(input.items.map((i) => i.status).every((s) => s === 'door' || s === 'window')).toBe(true);
    expect(input.items).toHaveLength(12);
    expect(input.entities).toBe(SCENE);
    expect(input.layerId).toBe(LEVEL);
  });
});

describe('ADR-911 Φ4-3β — «προς απόφαση» χωρίς θέση φωτίζει το σύμβολό του', () => {
  const ARC = ENTITIES.filter(isArcEntity).find((e) => colorOf(e) === OPENING)!;
  const noSpan: OpeningProposal = {
    items: [{ key: 'door:x', status: 'needs-decision', symbol: 'door', sourceIds: [ARC.id], reason: 'no-jamb' }],
    unexplainedIds: [],
  };

  it('στοιχείο χωρίς λωρίδα ⇒ καμία ζώνη, αλλά το ΤΟΞΟ του φωτίζεται δειγματισμένο', () => {
    const preview = previewOf(noSpan);

    expect(preview.zones[0].pieces).toEqual([]);
    expect(preview.loose.length).toBeGreaterThan(1);
    // Κάθε δείγμα κάθεται πάνω στο τόξο: απόσταση από το κέντρο = ακτίνα.
    for (const segment of preview.loose) {
      expect(Math.hypot(segment.start.x - ARC.center.x, segment.start.y - ARC.center.y)).toBeCloseTo(ARC.radius, 3);
    }
  });

  it('στοιχείο ΜΕ λωρίδα δεν φωτίζει το σύμβολό του δεύτερη φορά', () => {
    expect(previewOf(propose(SCENE)).loose).toEqual([]);
  });
});

describe('ADR-911 Φ4-3β — ένοικοι και ανεξήγητες', () => {
  it('ένοικοι = ΑΚΡΙΒΩΣ οι γραμμές που δηλώνουν τα κενά, μία γραμμή σχεδίου ανά ένοικο', () => {
    const proposal = propose(SCENE);
    const declared = proposal.items.flatMap((i) => i.occupantIds ?? []);

    expect(declared.length).toBeGreaterThan(0);
    expect(previewOf(proposal).occupants).toHaveLength(declared.length);
  });

  it('κάθε ζώνη κενού δηλώνει ότι κρατά κάτι· κάθε ζώνη συμβόλου ότι όχι', () => {
    const proposal = propose(SCENE);
    const preview = previewOf(proposal);
    for (const item of proposal.items) {
      const zone = preview.zones.find((z) => z.key === item.key)!;
      expect(zone.occupied).toBe((item.occupantIds?.length ?? 0) > 0);
      expect(zone.dismissed).toBe(false);
    }
  });

  it('οι ανεξήγητες γραμμές του ρόλου φωτίζονται μία προς μία', () => {
    const proposal = propose(SCENE);
    const line = SCENE.find((e) => e.type === 'line' && colorOf(e) === OPENING)!;
    expect(previewOf(proposal).unexplained).toEqual([]);
    expect(previewOf({ ...proposal, unexplainedIds: [line.id] }).unexplained).toHaveLength(1);
  });
});
