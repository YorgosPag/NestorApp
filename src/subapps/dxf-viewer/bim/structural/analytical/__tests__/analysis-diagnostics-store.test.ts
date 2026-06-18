/**
 * Analysis diagnostics store + shared indexer tests (ADR-482, T3-UI).
 */

import { indexDiagnosticsByEntity } from '../../organism/diagnostics-index';
import {
  AnalysisDiagnosticsStore,
  EMPTY_ANALYSIS_DIAGNOSTICS,
} from '../analysis-diagnostics-store';
import type { StructuralDiagnostic } from '../../organism/structural-organism-types';

function diag(id: string, entityIds: readonly string[]): StructuralDiagnostic {
  return {
    id,
    code: 'staticAnalysisMemberSkipped',
    severity: 'warning',
    messageKey: 'staticAnalysis.diagnostics.memberSkipped',
    primaryEntityId: entityIds[0],
    entityIds: [...entityIds],
  };
}

describe('indexDiagnosticsByEntity', () => {
  it('χαρτογραφεί ένα εύρημα σε ΟΛΑ τα entityIds του', () => {
    const d = diag('unstable', ['a', 'b', 'c']);
    const map = indexDiagnosticsByEntity([d]);
    expect(map.get('a')).toEqual([d]);
    expect(map.get('b')).toEqual([d]);
    expect(map.get('c')).toEqual([d]);
  });

  it('σωρεύει πολλαπλά ευρήματα στο ίδιο entity', () => {
    const d1 = diag('d1', ['a']);
    const d2 = diag('d2', ['a']);
    const map = indexDiagnosticsByEntity([d1, d2]);
    expect(map.get('a')).toEqual([d1, d2]);
  });

  it('κενή λίστα → κενό map', () => {
    expect(indexDiagnosticsByEntity([]).size).toBe(0);
  });
});

describe('AnalysisDiagnosticsStore', () => {
  afterEach(() => AnalysisDiagnosticsStore.set([]));

  it('set + getForEntity επιστρέφει τα ευρήματα του entity', () => {
    const d = diag('skip:m1', ['m1']);
    AnalysisDiagnosticsStore.set([d]);
    expect(AnalysisDiagnosticsStore.getForEntity('m1')).toEqual([d]);
    expect(AnalysisDiagnosticsStore.getAll()).toEqual([d]);
  });

  it('entity χωρίς εύρημα → σταθερή κενή αναφορά', () => {
    AnalysisDiagnosticsStore.set([diag('skip:m1', ['m1'])]);
    expect(AnalysisDiagnosticsStore.getForEntity('zzz')).toBe(EMPTY_ANALYSIS_DIAGNOSTICS);
  });

  it('set([]) → καθαρίζει σε σταθερή κενή αναφορά', () => {
    AnalysisDiagnosticsStore.set([diag('skip:m1', ['m1'])]);
    AnalysisDiagnosticsStore.set([]);
    expect(AnalysisDiagnosticsStore.getAll()).toBe(EMPTY_ANALYSIS_DIAGNOSTICS);
  });

  it('subscribe ειδοποιείται σε κάθε set και unsubscribe σταματά', () => {
    let calls = 0;
    const unsub = AnalysisDiagnosticsStore.subscribe(() => { calls += 1; });
    AnalysisDiagnosticsStore.set([diag('a', ['a'])]);
    expect(calls).toBe(1);
    unsub();
    AnalysisDiagnosticsStore.set([diag('b', ['b'])]);
    expect(calls).toBe(1);
  });
});
