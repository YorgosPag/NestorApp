/**
 * @fileoverview **Η απόκλιση στιγμιότυπου ↔ ζωντανού υπολογισμού, με απόδοση αιτίας** (ADR-947 Δ3 · Φ2). Υπολογίζεται
 * **κατά την ανάγνωση**, ποτέ δεν αποθηκεύεται (ADR-889 §10.2). Καθαρή συνάρτηση, χωρίς I/O.
 * @related `objective-value-snapshot.ts` (η είσοδος) · `compute-objective-value.ts` (η ΕΝΑ μηχανή) ·
 *   `objective-value-document-reading.ts` `zoneCheckOf` (ίδιο ιδίωμα: κλειστή ένωση + ανοχή)
 * @module lib/objective-value/objective-value-divergence
 *
 * 🏆 **Variance analysis, όχι «άλλαξε κατά Χ €»**: η διαφορά αποσυντίθεται σε **σκαλοπάτια**, ένα αίτιο τη φορά, με
 *    όλα τα άλλα σταθερά — όπως η ανάλυση αποκλίσεων στα οικονομικά:
 *    1. `engine` — η **τρέχουσα** μηχανή στις ίδιες εισόδους, ίδια ζώνη, ίδια ημερομηνία.
 *    2. `zoneTable` — ίδιες είσοδοι, η **τρέχουσα** τιμή ζώνης στην ίδια θέση/μέτωπο (μόνο για τιμή από τα δεδομένα ζωνών).
 *    3. `time` — όλα όπως στο 2, με τη **σημερινή** ημερομηνία (η παλαιότητα αλλάζει κλιμάκιο με τον χρόνο).
 *    Το άθροισμα των σκαλοπατιών **είναι** η συνολική διαφορά — κανένα αίτιο δεν μετριέται δύο φορές.
 *    Σε κάθε σκαλοπάτι φαίνεται **ποιοι συντελεστές** κινήθηκαν, με το άρθρο τους.
 * 🔑 Σκαλοπάτι που δεν μπορεί να υπολογιστεί (η ζώνη δεν διαβάζεται · η νέα μηχανή ζητά στοιχείο) **σταματά** την
 *    αλυσίδα με ρητό λόγο — ποτέ μαντεψιά, ποτέ «μηδέν διαφορά» στη θέση του αγνώστου.
 * ⏭️ Φ5: τέταρτο σκαλοπάτι `declarations` (άλλαξαν οι δηλώσεις του δεμένου ακινήτου), μαζί με το δεμένο υποκείμενο.
 */

import { computeObjectiveValue } from './compute-objective-value';
import { draftToInput } from './objective-value-draft';
import type { ObjectiveValueEngineIdentity } from './objective-value-engine-version';
import {
  snapshotEffectiveDraft,
  type ObjectiveValueSnapshotContent,
  type ObjectiveValueSnapshotZone,
} from './objective-value-snapshot';
import type { AppliedFactor, ComputedObjectiveValue, ObjectiveValueMissing } from './objective-value-types';

/** Κάτω από μισό λεπτό του ευρώ = ίδιο ποσό (θόρυβος κινητής υποδιαστολής). */
const SAME_VALUE_EPSILON = 0.005;
const SAME_FACTOR_EPSILON = 1e-9;

/** Ό,τι ξέρει **σήμερα** ο server: η μηχανή, η ημερομηνία, και η τρέχουσα ζώνη στη θέση του στιγμιότυπου. */
export interface ObjectiveValueLiveContext {
  readonly engine: ObjectiveValueEngineIdentity;
  /** `YYYY-MM-DD`. */
  readonly today: string;
  /** Η τρέχουσα τιμή στη θέση/μέτωπο του στιγμιότυπου — `null` = δεν διαβάστηκε ή δεν υπάρχει πια. */
  readonly zone: Omit<Extract<ObjectiveValueSnapshotZone, { kind: 'valueZones' }>, 'kind' | 'point' | 'frontKey'> | null;
}

export type DivergenceCause = 'engine' | 'zoneTable' | 'time';

/** Ένας συντελεστής που κινήθηκε (`null` = δεν εφαρμοζόταν / δεν εφαρμόζεται πια). */
export interface DivergenceFactorMove {
  readonly key: AppliedFactor['key'];
  readonly level?: number;
  readonly from: number | null;
  readonly to: number | null;
  readonly ref: string;
}

export interface DivergenceStep {
  readonly cause: DivergenceCause;
  readonly from: number;
  readonly to: number;
  readonly factors: readonly DivergenceFactorMove[];
}

/** Γιατί η αλυσίδα σταμάτησε πριν φτάσει στο σήμερα. */
export type DivergenceStop =
  | { readonly kind: 'zone-unavailable' }
  | { readonly kind: 'not-computed'; readonly cause: DivergenceCause; readonly missing: readonly ObjectiveValueMissing[] };

export interface ObjectiveValueDivergence {
  readonly snapshotValue: number;
  /** Το σημερινό ποσό — `null` όταν η αλυσίδα σταμάτησε. */
  readonly liveValue: number | null;
  /** Μόνο τα σκαλοπάτια που **άλλαξαν** κάτι (ποσό ή συντελεστή). */
  readonly steps: readonly DivergenceStep[];
  readonly stop: DivergenceStop | null;
  /** Άλλαξε η ταυτότητα της μηχανής, ακόμη κι αν το ποσό έμεινε ίδιο. */
  readonly engineChanged: boolean;
  /** Άλλαξε ο πίνακας ζωνών, ακόμη κι αν η τιμή της θέσης έμεινε ίδια. */
  readonly zoneTableChanged: boolean;
}

type Evaluation =
  | { readonly kind: 'computed'; readonly result: ComputedObjectiveValue }
  | { readonly kind: 'pending'; readonly missing: readonly ObjectiveValueMissing[] };

function evaluate(content: ObjectiveValueSnapshotContent, zone: ObjectiveValueSnapshotZone, date: string): Evaluation {
  const result = computeObjectiveValue(draftToInput(snapshotEffectiveDraft(content.draft, zone), date));
  return result.kind === 'computed' ? { kind: 'computed', result } : { kind: 'pending', missing: result.missing };
}

function factorId(factor: AppliedFactor): string {
  return `${factor.key}|${factor.level ?? ''}`;
}

/** Οι συντελεστές που διαφέρουν ανάμεσα σε δύο αποτελέσματα — κάθε κλειδί (και επίπεδο) μία φορά. */
function movedFactors(from: ComputedObjectiveValue, to: ComputedObjectiveValue): readonly DivergenceFactorMove[] {
  const before = new Map(from.factors.map((factor) => [factorId(factor), factor]));
  const after = new Map(to.factors.map((factor) => [factorId(factor), factor]));
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.flatMap((id) => {
    const a = before.get(id);
    const b = after.get(id);
    const known = b ?? a;
    if (known === undefined) return [];
    const same = a !== undefined && b !== undefined && Math.abs(a.factor - b.factor) < SAME_FACTOR_EPSILON && a.ref === b.ref;
    if (same) return [];
    const move: DivergenceFactorMove = { key: known.key, from: a?.factor ?? null, to: b?.factor ?? null, ref: known.ref };
    return [known.level === undefined ? move : { ...move, level: known.level }];
  });
}

function stepOf(cause: DivergenceCause, from: ComputedObjectiveValue, to: ComputedObjectiveValue): DivergenceStep | null {
  const factors = movedFactors(from, to);
  if (factors.length === 0 && Math.abs(from.value - to.value) < SAME_VALUE_EPSILON) return null;
  return { cause, from: from.value, to: to.value, factors };
}

/** Η ζώνη του σκαλοπατιού `zoneTable`: η τρέχουσα τιμή στην ίδια θέση · η χειροκίνητη μένει ως έχει. */
function liveZoneOf(snapshot: ObjectiveValueSnapshotContent, live: ObjectiveValueLiveContext): ObjectiveValueSnapshotZone | null {
  const { zone } = snapshot;
  if (zone.kind === 'manual') return zone;
  return live.zone === null ? null : { ...zone, ...live.zone, kind: 'valueZones' };
}

function zoneTableChangedOf(snapshot: ObjectiveValueSnapshotContent, live: ObjectiveValueLiveContext): boolean {
  return snapshot.zone.kind === 'valueZones' && live.zone !== null && snapshot.zone.table.sha256 !== live.zone.table.sha256;
}

interface Chain {
  readonly current: ComputedObjectiveValue;
  readonly steps: readonly DivergenceStep[];
}

/** Προχωρά την αλυσίδα ένα σκαλοπάτι — ή επιστρέφει τη στάση της. */
function advance(chain: Chain, cause: DivergenceCause, next: Evaluation): Chain | DivergenceStop {
  if (next.kind === 'pending') return { kind: 'not-computed', cause, missing: next.missing };
  const step = stepOf(cause, chain.current, next.result);
  return { current: next.result, steps: step === null ? chain.steps : [...chain.steps, step] };
}

function isStop(value: Chain | DivergenceStop): value is DivergenceStop {
  return 'kind' in value;
}

/**
 * **Η απόκλιση** — τρία σκαλοπάτια, με τη σειρά μηχανή → πίνακας ζωνών → χρόνος. Χωρίς αλλαγή ⇒ `steps` κενό και
 * `liveValue === snapshotValue`.
 */
export function objectiveValueDivergence(snapshot: ObjectiveValueSnapshotContent, live: ObjectiveValueLiveContext): ObjectiveValueDivergence {
  const base = {
    snapshotValue: snapshot.result.value,
    engineChanged: snapshot.engine.version !== live.engine.version || snapshot.engine.tablesSha256 !== live.engine.tablesSha256,
    zoneTableChanged: zoneTableChangedOf(snapshot, live),
  };
  const stopped = (chain: Chain, stop: DivergenceStop): ObjectiveValueDivergence => ({ ...base, liveValue: null, steps: chain.steps, stop });
  let chain: Chain = { current: snapshot.result, steps: [] };

  const engine = advance(chain, 'engine', evaluate(snapshot, snapshot.zone, snapshot.valuationDate));
  if (isStop(engine)) return stopped(chain, engine);
  chain = engine;

  const zone = liveZoneOf(snapshot, live);
  if (zone === null) return stopped(chain, { kind: 'zone-unavailable' });
  const table = advance(chain, 'zoneTable', evaluate(snapshot, zone, snapshot.valuationDate));
  if (isStop(table)) return stopped(chain, table);
  chain = table;

  const time = advance(chain, 'time', evaluate(snapshot, zone, live.today));
  if (isStop(time)) return stopped(chain, time);
  return { ...base, liveValue: time.current.value, steps: time.steps, stop: null };
}
