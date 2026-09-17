/**
 * @fileoverview **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΑΚΜΗΣ** — «υπάρχει ακμή ανάμεσα σε αυτό το πρόσωπο και αυτόν τον χώρο;»
 * @related ADR-867 §3 · §5 · §7 Α1/Α2 · ADR-834 §5 Β (α) ① · (δ) ②
 * @module lib/network-edge/edge-judge
 *
 * 🔑 **Ο κριτής ΔΕΝ ξέρει τι είναι «εντολή»** (ADR-834 (δ) ②). Δέχεται **τεκμήρια** με
 * ετικέτα είδους και ένα **μητρώο προβολέων** — ένας προβολέας ανά είδος πράξης — και ρωτά
 * μόνο *«ποιες ακμές βγάζουν αυτά τα τεκμήρια, και ποιες ενώνουν τα δύο άκρα;»*.
 * Νέα πηγή ακμής (ADR-862 Φ1 — συμμετοχή) = **μία** γραμμή στο `edge-sources.ts`, **καμία** εδώ.
 *
 * ⛔ **Αυτό το αρχείο δεν εισάγει τίποτα από εντολές, ιδιοκτησίες ή υπηρεσίες.** Το φυλάει
 * άγκυρα που διαβάζει τις εισαγωγές του **και** εκτελεί τον κριτή με **ψεύτικη** δεύτερη πηγή.
 *
 * ⚠️ **Καθαρή συνάρτηση, κανένα δίκτυο**: τα τεκμήρια τα φέρνει ο καλών (Β4/Β5). Το «πού
 * ψάχνω» είναι IO και ανήκει στον διακομιστή· το «τι μετράει ως ακμή» είναι **εδώ**, μία φορά.
 */

/**
 * **Μία ακμή** = μία αποδεκτή πράξη ανάμεσα σε **χώρο** (το άκρο που φιλοξενεί το νήμα της
 * πράξης, ADR-834 (γ) ①) και **πρόσωπο** (το άλλο άκρο). Ίδιο σχήμα με το σκέλος `act` του
 * `NetworkThreadTopic` — η ακμή **είναι** το θέμα του νήματος πριν γραφτεί.
 */
export interface NetworkEdge<K extends string = string> {
  readonly actKind: K;
  /** Η ταυτότητα της πράξης· σπόρος για τα ντετερμινιστικά ids νήματος/ομάδας. */
  readonly actSeed: string;
  readonly hostCompanyId: string;
  readonly counterpartUid: string;
}

/** Τα δύο άκρα της ερώτησης. */
export interface EdgeEnds {
  readonly personUid: string;
  readonly companyId: string;
}

/** Χάρτης «είδος πράξης → σχήμα τεκμηρίου». Κάθε πηγή δηλώνει το δικό της. */
export type EdgeEvidenceMap = Readonly<Record<string, unknown>>;

/** Το μητρώο: **ένας** προβολέας ανά είδος — πλήρες, αφού ο τύπος απαιτεί κάθε κλειδί. */
export type EdgeProjectors<M extends EdgeEvidenceMap> = {
  readonly [K in keyof M & string]: (payload: M[K]) => readonly NetworkEdge<K>[];
};

/** Ένα τεκμήριο με ετικέτα — η συσχετισμένη ένωση (TS #47109) κρατά είδος και σχήμα **μαζί**. */
export type EdgeEvidence<M extends EdgeEvidenceMap, K extends keyof M & string = keyof M & string> = {
  readonly [P in K]: { readonly kind: P; readonly payload: M[P] };
}[K];

export type EdgeVerdict<K extends string = string> =
  | { readonly kind: 'connected'; readonly edges: readonly NetworkEdge<K>[] }
  | { readonly kind: 'none' };

const NONE = { kind: 'none' } as const;

/** Κενή/απούσα ταυτότητα **δεν ταιριάζει με καμία** — άγνωστο ≠ κενό (ίδιο ιδίωμα με CHECK 3.35). */
export function presentId(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function project<M extends EdgeEvidenceMap, K extends keyof M & string>(
  evidence: EdgeEvidence<M, K>,
  projectors: EdgeProjectors<M>,
): readonly NetworkEdge<K>[] {
  return projectors[evidence.kind](evidence.payload);
}

/**
 * **Όλες οι ακμές** που βγάζουν τα τεκμήρια — **χωρίς διπλότυπα**: η ίδια πράξη που φτάνει
 * δύο φορές (π.χ. από δύο ερωτήματα) είναι **μία** ακμή (N.7.2 #3).
 */
export function edgesOf<M extends EdgeEvidenceMap>(
  evidence: readonly EdgeEvidence<M>[],
  projectors: EdgeProjectors<M>,
): readonly NetworkEdge<keyof M & string>[] {
  const byAct = new Map<string, NetworkEdge<keyof M & string>>();
  for (const item of evidence) {
    for (const edge of project(item, projectors)) {
      const key = `${edge.actKind}:${edge.actSeed}`;
      if (!byAct.has(key)) byAct.set(key, edge);
    }
  }
  return [...byAct.values()];
}

/**
 * 🔑 **Ο κριτής**: ακμή ανάμεσα σε **αυτό** το πρόσωπο και **αυτόν** τον χώρο;
 *
 * ⚠️ **Κάθε αποδεκτή πράξη, τρέχουσα ή παλιά, αρκεί** (ADR-834 (α) ①) — το «αποδεκτή» το
 * κρίνει ο **προβολέας** της πηγής, όχι ο κριτής. Εδώ **δεν** υπάρχει ρολόι.
 */
export function judgeEdge<M extends EdgeEvidenceMap>(
  evidence: readonly EdgeEvidence<M>[],
  ends: EdgeEnds,
  projectors: EdgeProjectors<M>,
): EdgeVerdict<keyof M & string> {
  const personUid = presentId(ends.personUid);
  const companyId = presentId(ends.companyId);
  if (personUid === null || companyId === null) return NONE;

  const edges = edgesOf(evidence, projectors).filter(
    (edge) => edge.counterpartUid === personUid && edge.hostCompanyId === companyId,
  );
  return edges.length === 0 ? NONE : { kind: 'connected', edges };
}
