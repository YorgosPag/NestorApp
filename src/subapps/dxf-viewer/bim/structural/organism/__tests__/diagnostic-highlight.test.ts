/**
 * collectEntityHighlights — ADR-489 SSoT projection tests.
 */

import { collectEntityHighlights } from '../diagnostic-highlight';
import type {
  StructuralDiagnostic,
  StructuralDiagnosticSeverity,
} from '../structural-organism-types';

const diag = (
  id: string,
  severity: StructuralDiagnosticSeverity,
  code: string,
  entityIds: string[],
): StructuralDiagnostic => ({
  id,
  code: code as StructuralDiagnostic['code'],
  severity,
  messageKey: `k.${code}`,
  primaryEntityId: entityIds[0]!,
  entityIds,
});

describe('collectEntityHighlights (ADR-489)', () => {
  it('επισημαίνει error & warning, αγνοεί info', () => {
    const out = collectEntityHighlights([
      diag('d1', 'error', 'beamUnsupportedEnd', ['beam-1']),
      diag('d2', 'warning', 'ratioOutOfRange', ['col-1']),
      diag('d3', 'info', 'memberMissingReinforcement', ['col-2']),
    ]);
    expect(out.get('beam-1')?.severity).toBe('error');
    expect(out.get('col-1')?.severity).toBe('warning');
    expect(out.has('col-2')).toBe(false); // info → όχι highlight
  });

  it('κρατά τη ΧΕΙΡΟΤΕΡΗ severity ανά μέλος (error νικά warning)', () => {
    const out = collectEntityHighlights([
      diag('d1', 'warning', 'ratioOutOfRange', ['beam-1']),
      diag('d2', 'error', 'beamUnsupportedEnd', ['beam-1']),
    ]);
    expect(out.get('beam-1')?.severity).toBe('error');
    expect(out.get('beam-1')?.codes).toEqual(expect.arrayContaining(['ratioOutOfRange', 'beamUnsupportedEnd']));
  });

  it('ενώνει πολλαπλά sets (organism + FEM) στο ίδιο entity', () => {
    const organism = [diag('o1', 'warning', 'memberIsolated', ['beam-1'])];
    const fem = [diag('f1', 'error', 'staticAnalysisUnstable', ['beam-1'])];
    const out = collectEntityHighlights(organism, fem);
    expect(out.get('beam-1')?.severity).toBe('error');
  });

  it('ένα εύρημα επισημαίνει ΟΛΑ τα entityIds του', () => {
    const out = collectEntityHighlights([
      diag('d1', 'error', 'analyticalModelUnstable', ['beam-1', 'col-1', 'col-2']),
    ]);
    expect(out.get('beam-1')?.severity).toBe('error');
    expect(out.get('col-1')?.severity).toBe('error');
    expect(out.get('col-2')?.severity).toBe('error');
  });

  it('κενά sets → κενό map', () => {
    expect(collectEntityHighlights([]).size).toBe(0);
    expect(collectEntityHighlights().size).toBe(0);
  });
});
