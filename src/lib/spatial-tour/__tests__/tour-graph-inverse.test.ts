/**
 * @fileoverview **Η ΑΝΑΙΡΕΣΗ ΤΟΥ ΓΡΑΦΟΥ** (ADR-884 Φ2δ · §4.10) — καθαρή.
 *
 * - **Κ** — ο κύκλος: εκτέλεσε την εντολή με τις **ίδιες** συναρτήσεις του γραφέα, μετά τις εντολές της αναίρεσης ⇒ ο
 *   γράφος ξαναγίνεται **ακριβώς** όπως ήταν (και τα δύο βελάκια).
 * - **Ο** — ό,τι δεν αντιστρέφεται πιστά (αφαίρεση λήψης) **δεν** προσφέρει αναίρεση.
 */

import { linkNodes, nameNode, unlinkNodes, type TourGraphCommand } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import type { SpatialTour, TourNode } from '@/types/spatial-tour';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

const L0 = { kind: 'local', ordinal: 0 } as const;
const node = (id: string, links: TourNode['links'] = []): TourNode => ({ id, levelKey: L0, position: null, links });
const LINKED: Graph = {
  levels: [],
  nodes: [node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }]), node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: 2 }]), node('c')],
};

/** Ο γραφέας σε μικρογραφία — οι ίδιες καθαρές συναρτήσεις που τρέχει ο διακομιστής. */
function apply(graph: Graph, command: TourGraphCommand): Graph {
  const result = command.op === 'link' ? linkNodes(graph, command.fromNodeId, command.toNodeId, command.bearingRad)
    : command.op === 'unlink' ? unlinkNodes(graph, command.fromNodeId, command.toNodeId)
    : command.op === 'name' ? nameNode(graph, command.nodeId, command.room) : null;
  if (result === null) throw new Error('μόνο link/unlink/name εδώ');
  return result.kind === 'edited' ? result.graph : graph;
}

/** Σύγκριση χωρίς εξάρτηση από τη σειρά των συνδέσμων. */
const canonical = (graph: Graph) => graph.nodes.map((n) => ({ id: n.id, links: [...n.links].sort((x, y) => x.toNodeId.localeCompare(y.toNodeId)) }));

function roundTrip(before: Graph, command: TourGraphCommand): Graph {
  const undo = inverseOf(command, before);
  if (undo === null) throw new Error('αναμενόταν αναίρεση');
  return undo.reduce(apply, apply(before, command));
}

describe('Κ — εντολή + αναίρεση = ο ίδιος γράφος', () => {
  it.each<[string, TourGraphCommand]>([
    ['μετακίνηση υπάρχοντος βελακιού', { op: 'link', fromNodeId: 'a', toNodeId: 'b', bearingRad: 3 }],
    ['βελάκι σε νέα σύνδεση', { op: 'link', fromNodeId: 'a', toNodeId: 'c', bearingRad: 0.5 }],
    ['βελάκι της επιστροφής', { op: 'link', fromNodeId: 'b', toNodeId: 'a', bearingRad: 0 }],
    ['αποσύνδεση με δύο βελάκια', { op: 'unlink', fromNodeId: 'a', toNodeId: 'b' }],
    ['αποσύνδεση ανύπαρκτης σύνδεσης', { op: 'unlink', fromNodeId: 'a', toNodeId: 'c' }],
  ])('%s', (_label, command) => {
    expect(canonical(roundTrip(LINKED, command))).toEqual(canonical(LINKED));
  });

  it('η επιστροφή χωρίς βελάκι μένει χωρίς βελάκι — η αναίρεση δεν μαντεύει κατεύθυνση', () => {
    const halfArrowed: Graph = { levels: [], nodes: [node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }]), node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: null }])] };
    const after = roundTrip(halfArrowed, { op: 'unlink', fromNodeId: 'a', toNodeId: 'b' });
    expect(canonical(after)).toEqual(canonical(halfArrowed));
  });
});

describe('Ο — αναίρεση μόνο όπου είναι πιστή', () => {
  it('τοποθέτηση ⇒ αφαίρεση της ίδιας λήψης', () => {
    const place: TourGraphCommand = { op: 'place', captureId: 'tcap_1', target: { kind: 'new-node', levelKey: L0, linkFrom: null } };
    expect(inverseOf(place, LINKED)).toEqual([{ op: 'unplace', captureId: 'tcap_1' }]);
  });

  it('αφαίρεση λήψης ⇒ καμία αναίρεση (το σημείο και τα βελάκια του χάνονται — η οθόνη ρωτά ΠΡΙΝ)', () => {
    expect(inverseOf({ op: 'unplace', captureId: 'tcap_1' }, LINKED)).toBeNull();
  });
});

describe('Χ — αναίρεση ονόματος χώρου (Φ2στ · §4.12)', () => {
  const room = { types: ['office'] as const, label: 'Γραφείο', source: 'manual' as const };
  const NAMED: Graph = { ...LINKED, nodes: LINKED.nodes.map((n) => (n.id === 'a' ? { ...n, room } : n)) };

  it.each<[string, Graph, TourGraphCommand]>([
    ['όνομα σε σημείο χωρίς όνομα', LINKED, { op: 'name', nodeId: 'a', room: { types: ['hallway'], label: null } }],
    ['αλλαγή ονόματος', NAMED, { op: 'name', nodeId: 'a', room: { types: ['hallway'], label: 'Διάδρομος' } }],
    ['σβήσιμο ονόματος', NAMED, { op: 'name', nodeId: 'a', room: null }],
  ])('%s ⇒ ίδιος χώρος μετά την αναίρεση', (_label, before, command) => {
    const after = roundTrip(before, command);
    expect(after.nodes.find((n) => n.id === 'a')?.room ?? null).toEqual(before.nodes.find((n) => n.id === 'a')?.room ?? null);
  });
});
