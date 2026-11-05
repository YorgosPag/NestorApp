import { retentionRate } from '../../clauses/__tests__/clause-fixtures';
import type { ClauseParameterDefinition } from '../../types/clause-parameter';
import { toleranceRulerOf } from '../tolerance-ruler';

describe('tolerance-ruler — ο χάρακας των ζωνών (ADR-928 §5.22)', () => {
  it('κράτηση 3% | 5–10% ελεύθερα | 15%: πέντε ζώνες με τη σειρά, ★ στην αρχή της ελεύθερης', () => {
    const ruler = toleranceRulerOf(retentionRate);
    expect(ruler?.segments.map((segment) => segment.zone)).toEqual(['forbidden', 'approval', 'free', 'approval', 'forbidden']);
    const free = ruler?.segments.find((segment) => segment.zone === 'free');
    expect(ruler?.preferredAt).toBeCloseTo(free?.from ?? -1);
    ruler?.segments.forEach((segment, index, all) => {
      if (index > 0) expect(segment.from).toBeCloseTo(all[index - 1].to);
    });
    expect(ruler?.segments[0].from).toBeCloseTo(0);
    expect(ruler?.segments[ruler.segments.length - 1].to).toBeCloseTo(1);
  });

  it('ανοιχτή πάνω πλευρά ⇒ καμία απαγορευμένη ζώνη δεξιά', () => {
    const open: ClauseParameterDefinition = {
      ...retentionRate,
      tolerance: { kind: 'numeric', acceptable: { min: 500, max: null }, walkAway: { min: 300, max: null } },
    };
    expect(toleranceRulerOf(open)?.segments.map((segment) => segment.zone)).toEqual(['forbidden', 'approval', 'free']);
  });

  it('χωρίς αριθμητική ζώνη, ή με ασυνεπή όρια ⇒ κανένας χάρακας (τα λέει ο κριτής)', () => {
    expect(toleranceRulerOf({ ...retentionRate, tolerance: null })).toBeNull();
    expect(toleranceRulerOf({ ...retentionRate, tolerance: { kind: 'fixed' } })).toBeNull();
    const inverted: ClauseParameterDefinition = {
      ...retentionRate,
      tolerance: { kind: 'numeric', acceptable: { min: 1000, max: 500 }, walkAway: { min: 300, max: 1500 } },
    };
    expect(toleranceRulerOf(inverted)).toBeNull();
  });
});
