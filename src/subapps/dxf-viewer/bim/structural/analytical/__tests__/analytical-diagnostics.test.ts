/**
 * ADR-480 (T2) — analytical diagnostics (pure).
 *
 * Καλύπτει: ολικό μηχανισμό (μέλη χωρίς στήριξη), τοπικό μηχανισμό (αποσπασμένο
 * μέλος), και καθαρό φορέα (κανένα εύρημα).
 */

import { runAnalyticalDiagnostics } from '../analytical-diagnostics';
import {
  FIXED_DOF, FREE_DOF,
  type AnalyticalModel, type AnalyticalMember, type AnalyticalNode,
} from '../analytical-model-types';

const node = (id: string, restrained = false): AnalyticalNode => ({
  id, position: { xM: 0, yM: 0, zM: 0 },
  restraint: restrained ? FIXED_DOF : FREE_DOF, levelId: 'lvl-0',
});

const member = (id: string, i: string, j: string): AnalyticalMember => ({
  id, entityId: id, memberType: 'column', iNodeId: i, jNodeId: j, lengthM: 3,
});

function model(partial: Partial<AnalyticalModel>): AnalyticalModel {
  return { nodes: [], members: [], supports: [], diaphragms: [], levels: [], ...partial };
}

describe('runAnalyticalDiagnostics', () => {
  it('μέλη χωρίς καμία στήριξη → analyticalModelUnstable', () => {
    const d = runAnalyticalDiagnostics(model({
      nodes: [node('an-0'), node('an-1')],
      members: [member('c1', 'an-0', 'an-1')],
    }));
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('analyticalModelUnstable');
    expect(d[0].primaryEntityId).toBe('c1');
  });

  it('αποσπασμένο μέλος (μη προσβάσιμο από στήριξη) → analyticalMemberUnsupported', () => {
    const d = runAnalyticalDiagnostics(model({
      nodes: [node('an-0', true), node('an-1'), node('an-2'), node('an-3')],
      members: [member('c1', 'an-0', 'an-1'), member('c2', 'an-2', 'an-3')],
      supports: [{ nodeId: 'an-0', supportType: 'fixed' }],
    }));
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('analyticalMemberUnsupported');
    expect(d[0].primaryEntityId).toBe('c2');
  });

  it('πλήρως στηριζόμενος φορέας → κανένα εύρημα', () => {
    const d = runAnalyticalDiagnostics(model({
      nodes: [node('an-0', true), node('an-1')],
      members: [member('c1', 'an-0', 'an-1')],
      supports: [{ nodeId: 'an-0', supportType: 'fixed' }],
    }));
    expect(d).toHaveLength(0);
  });

  it('κενό μοντέλο → κανένα εύρημα', () => {
    expect(runAnalyticalDiagnostics(model({}))).toHaveLength(0);
  });
});
