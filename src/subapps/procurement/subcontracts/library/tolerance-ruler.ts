/**
 * @fileoverview **Ο χάρακας των ζωνών** μιας αριθμητικής παραμέτρου — απαγορεύεται | θέλει έγκριση | ελεύθερα | ★
 *   (ADR-928 §5.22) — καθαρό.
 * @module subapps/procurement/subcontracts/library/tolerance-ruler
 *
 * 🔑 Ο συντάκτης της ρήτρας **βλέπει** το playbook που γράφει: τέσσερα όρια σε μια γραμμή, με την προτιμώμενη ως ★.
 *    Κανένα CLM δεν το δείχνει έτσι (Evisort: τρεις ετικέτες σε λίστα). Οι λέξεις κάτω από τον χάρακα είναι του
 *    **ίδιου** `tolerance-text` με τον έλεγχο, άρα γράφεται ό,τι διαβάζει ο εγκρίνων.
 * 🔑 Τα όρια ερμηνεύονται όπως ο κριτής (`inNumericRange`, συμπεριληπτικά): η ελεύθερη ζώνη είναι το `acceptable`, η
 *    επιτρεπτή το `walkAway`, ό,τι ανάμεσα θέλει έγκριση. Ασυνεπείς ζώνες ⇒ κανένας χάρακας (ο κριτής τις λέει).
 */

import type { ClauseParameterDefinition, NumericTolerance } from '../types/clause-parameter';
import { numericValueOf } from '../clauses/tolerance-verdict';

export type RulerZone = 'forbidden' | 'approval' | 'free';

export interface RulerSegment {
  readonly zone: RulerZone;
  /** Θέση στον χάρακα, 0–1. */
  readonly from: number;
  readonly to: number;
}

export interface ToleranceRuler {
  readonly segments: readonly RulerSegment[];
  /** Η θέση της προτιμώμενης (★), 0–1· `null` όταν δεν είναι αριθμός. */
  readonly preferredAt: number | null;
}

const isOrdered = (values: readonly (number | null)[]): boolean => {
  const present = values.filter((value): value is number => value !== null);
  return present.every((value, index) => index === 0 || present[index - 1] <= value);
};

interface Domain {
  readonly lo: number;
  readonly hi: number;
}

/** Το εύρος του χάρακα: όλα τα όρια + η προτιμώμενη, με περιθώριο όπου μια πλευρά είναι ανοιχτή. */
function domainOf(tolerance: NumericTolerance, preferred: number | null): Domain {
  const points = [tolerance.walkAway.min, tolerance.acceptable.min, tolerance.acceptable.max, tolerance.walkAway.max, preferred]
    .filter((value): value is number => value !== null);
  const min = points.length > 0 ? Math.min(...points) : 0;
  const max = points.length > 0 ? Math.max(...points) : 1;
  const pad = Math.max((max - min) * 0.25, 1);
  return {
    lo: tolerance.walkAway.min === null ? Math.max(0, min - pad) : Math.max(0, min - pad / 2),
    hi: max + (tolerance.walkAway.max === null ? pad : pad / 2),
  };
}

export function toleranceRulerOf(definition: ClauseParameterDefinition): ToleranceRuler | null {
  const tolerance = definition.tolerance;
  if (tolerance?.kind !== 'numeric') return null;
  const { walkAway, acceptable } = tolerance;
  if (!isOrdered([walkAway.min, acceptable.min, acceptable.max, walkAway.max])) return null;
  const preferred = numericValueOf(definition.preferred);
  const { lo, hi } = domainOf(tolerance, preferred);
  const at = (value: number) => (value - lo) / (hi - lo);
  const a = walkAway.min ?? lo;
  const b = acceptable.min ?? a;
  const d = walkAway.max ?? hi;
  const c = acceptable.max ?? d;
  const raw: readonly RulerSegment[] = [
    { zone: 'forbidden', from: at(lo), to: at(a) },
    { zone: 'approval', from: at(a), to: at(b) },
    { zone: 'free', from: at(b), to: at(c) },
    { zone: 'approval', from: at(c), to: at(d) },
    { zone: 'forbidden', from: at(d), to: at(hi) },
  ];
  return { segments: raw.filter((segment) => segment.to > segment.from), preferredAt: preferred === null ? null : at(preferred) };
}
