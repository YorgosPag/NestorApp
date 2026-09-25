/**
 * ⚓ ADR-884 Φ0.2 — τα αναλλοίωτα που επιβάλλει ο διακομιστής, ως καθαρές συναρτήσεις.
 * #1 βάση λήψης · #2 υπογράφων ΤΕΕ · #3 κοινό/ράφι · #4 μία ενεργή κάτοψη · #5 σύνδεσμοι + αφαίρεση κόμβου.
 */

import { MAX_TOUR_NODES } from '@/constants/spatial-tour-vocabulary';
import type { TourCapture, TourNode } from '@/types/spatial-tour';

import { checkTourGraph, removeTourNode } from '../spatial-tour-graph';
import {
  audienceTransition,
  checkTourCapture,
  mayEnterPublicShelf,
  selectShelfCaptures,
} from '../tour-capture-invariants';
import { CAPTURE, TOUR } from './spatial-tour-fixtures';

const kinds = (violations: readonly { kind: string }[]) => violations.map((v) => v.kind);
const node = (id: string, links: string[] = []): TourNode => ({
  id,
  levelKey: { kind: 'floor', floorId: 'flr_1' },
  position: null,
  links: links.map((toNodeId) => ({ toNodeId, via: 'manual' })),
});

describe('#4/#5 — checkTourGraph', () => {
  it('✅ έγκυρος γράφος ⇒ καμία παράβαση (μάρτυρας)', () => {
    expect(checkTourGraph(TOUR)).toEqual([]);
  });

  it('🔴 #5 σύνδεσμος προς κόμβο που δεν υπάρχει / προς τον εαυτό του', () => {
    expect(kinds(checkTourGraph({ ...TOUR, nodes: [node('a', ['ghost'])] }))).toEqual(['dangling-link']);
    expect(kinds(checkTourGraph({ ...TOUR, nodes: [node('a', ['a'])] }))).toEqual(['self-link']);
  });

  it('🔴 διπλό id κόμβου · κόμβος σε όροφο που δεν δηλώθηκε', () => {
    const stray: TourNode = { ...node('b'), levelKey: { kind: 'local', ordinal: 9 } };
    expect(kinds(checkTourGraph({ ...TOUR, nodes: [node('a'), node('a'), stray] })))
      .toEqual(['duplicate-node-id', 'node-on-unknown-level']);
  });

  it('🔴 #4 κανένα ή δύο ενεργά σχέδια ορόφου', () => {
    const [plan] = TOUR.levels[0].floorPlans;
    const none = [{ key: TOUR.levels[0].key, floorPlans: [{ ...plan, state: 'superseded' as const }] }];
    const two = [{ key: TOUR.levels[0].key, floorPlans: [plan, plan] }];
    expect(kinds(checkTourGraph({ ...TOUR, levels: none }))).toContain('active-floor-plan-count');
    expect(kinds(checkTourGraph({ ...TOUR, levels: two }))).toContain('active-floor-plan-count');
  });

  it('🔴 αρχείο κάτοψης ⇔ πηγή ≠ `none`', () => {
    const [plan] = TOUR.levels[0].floorPlans;
    const levels = [{ key: TOUR.levels[0].key, floorPlans: [{ ...plan, fileId: null }] }];
    expect(kinds(checkTourGraph({ ...TOUR, levels }))).toEqual(['floor-plan-file-mismatch']);
  });

  it('🔴 όριο κόμβων', () => {
    const nodes = Array.from({ length: MAX_TOUR_NODES + 1 }, (_, i) => node(`n${i}`));
    expect(kinds(checkTourGraph({ ...TOUR, nodes }))).toEqual(['too-many-nodes']);
  });
});

describe('#5 — removeTourNode', () => {
  it('σβήνει τον κόμβο ΚΑΙ κάθε εισερχόμενο σύνδεσμο στην ίδια πράξη — κανένας ορφανός', () => {
    const after = removeTourNode([node('a', ['b', 'c']), node('b', ['a']), node('c', ['b'])], 'b');

    expect(after.map((n) => [n.id, n.links.map((l) => l.toNodeId)])).toEqual([['a', ['c']], ['c', []]]);
    expect(checkTourGraph({ ...TOUR, nodes: after })).toEqual([]);
  });

  it('είναι ιδεμποτική — ανύπαρκτος κόμβος ⇒ ίδιος γράφος', () => {
    const nodes = [node('a', ['b']), node('b')];
    expect(removeTourNode(nodes, 'zzz')).toEqual(nodes);
  });
});

describe('#1/#2 — checkTourCapture', () => {
  const base = { id: 'tcap_base', nodeId: 'tnod_a', provenance: 'as-built' as const };
  const staging: TourCapture = { ...CAPTURE, id: 'tcap_st', provenance: 'virtual-staging', baseCaptureId: 'tcap_base' };
  const person = { name: 'Μαρία', discipline: 'αρχιτέκτων', studiedAt: '2026-08-01' };
  const tee = { state: 'declared' as const, registration: { authorityKind: 'national' as const, authority: 'tee' as const, number: '123456' } };

  it('✅ as-built χωρίς βάση · staging πάνω σε as-built ίδιου κόμβου (μάρτυρες)', () => {
    expect(checkTourCapture(CAPTURE, null)).toEqual([]);
    expect(checkTourCapture(staging, base)).toEqual([]);
  });

  it('🔴 #1 staging χωρίς βάση · βάση που δεν είναι as-built · βάση άλλου κόμβου · as-built με βάση', () => {
    expect(kinds(checkTourCapture({ ...staging, baseCaptureId: null }, null))).toEqual(['base-capture-missing']);
    expect(kinds(checkTourCapture(staging, { ...base, provenance: 'virtual-staging' }))).toEqual(['base-capture-not-as-built']);
    expect(kinds(checkTourCapture(staging, { ...base, nodeId: 'tnod_b' }))).toEqual(['base-capture-other-node']);
    expect(kinds(checkTourCapture({ ...CAPTURE, baseCaptureId: 'x' }, null))).toEqual(['base-capture-unexpected']);
  });

  it('🔴 #1 το έγγραφο βάσης πρέπει να είναι ΑΥΤΟ που δηλώνει το baseCaptureId', () => {
    expect(kinds(checkTourCapture(staging, { ...base, id: 'άλλη' }))).toEqual(['base-capture-missing']);
  });

  it('🔴 #2 μελέτη: χωρίς υπογράφοντα · με κενό όνομα · χωρίς ΤΕΕ · με άλλη αρχή — ✅ με ΤΕΕ declared', () => {
    const study: TourCapture = { ...staging, provenance: 'design-study' };
    const lawyer = { state: 'declared' as const, registration: { authorityKind: 'national' as const, authority: 'gemi' as const, number: '1' } };
    expect(kinds(checkTourCapture(study, base))).toEqual(['design-study-unsigned']);
    expect(kinds(checkTourCapture({ ...study, signatory: { person: { ...person, name: '  ' }, attestation: tee } }, base)))
      .toEqual(['design-study-unsigned']);
    expect(kinds(checkTourCapture({ ...study, signatory: { person, attestation: { state: 'unknown' } } }, base)))
      .toEqual(['design-study-unregistered']);
    expect(kinds(checkTourCapture({ ...study, signatory: { person, attestation: lawyer } }, base)))
      .toEqual(['design-study-unregistered']);
    expect(checkTourCapture({ ...study, signatory: { person, attestation: tee } }, base)).toEqual([]);
  });
});

describe('#3 — δημόσιο ράφι και κοινό', () => {
  it('μόνο public-listing ∧ published ∧ public φτάνει στο ράφι', () => {
    expect(mayEnterPublicShelf(CAPTURE, TOUR)).toBe(true);
    expect(mayEnterPublicShelf({ audience: 'project-team' }, TOUR)).toBe(false);
    expect(mayEnterPublicShelf({ audience: 'unit-owner' }, TOUR)).toBe(false);
    expect(mayEnterPublicShelf(CAPTURE, { ...TOUR, lifecycle: 'draft' })).toBe(false);
    expect(mayEnterPublicShelf(CAPTURE, { ...TOUR, visibility: 'on-request' })).toBe(false);
  });

  it('για κάθε κόμβο ΜΟΝΟ η πιο πρόσφατη δημόσια λήψη· λήψη χωρίς αναγνώσιμη ημερομηνία δεν κερδίζει ποτέ', () => {
    const older = { ...CAPTURE, id: 'old', capturedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...CAPTURE, id: 'new', capturedAt: '2026-06-01T00:00:00.000Z' };
    const team = { ...CAPTURE, id: 'team', capturedAt: '2026-09-01T00:00:00.000Z', audience: 'project-team' as const };
    const broken = { ...CAPTURE, id: 'zzz', capturedAt: 'χθες' };
    const other = { ...CAPTURE, id: 'b', nodeId: 'tnod_b' };

    expect(selectShelfCaptures([newer, broken, team, older, other], TOUR).map((c) => c.id)).toEqual(['new', 'b']);
  });

  it('προς public-listing μόνο με ρητή πράξη· στένεμα επιτρέπεται', () => {
    expect(audienceTransition('project-team', 'public-listing', false)).toBe('requires-explicit-act');
    expect(audienceTransition('project-team', 'public-listing', true)).toBe('allowed');
    expect(audienceTransition('public-listing', 'project-team', false)).toBe('allowed');
    expect(audienceTransition('unit-owner', 'unit-owner', false)).toBe('unchanged');
  });
});
