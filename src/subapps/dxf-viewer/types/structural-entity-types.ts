/**
 * structural-entity-types — SSoT: ποιοι entity types είναι **δομικά μέλη**.
 *
 * Ενιαία πηγή αλήθειας για το ερώτημα «αυτό το entity μετέχει στον στατικό
 * οργανισμό (φορτία / διαστασιολόγηση / οπλισμός / θεμελίωση);». Τα raw DXF
 * primitives (line/arc/polyline/text/dimension) και τα μη-δομικά BIM στοιχεία
 * (furniture / mep / railing / finishes / openings) επιστρέφουν `false`.
 *
 * **Γιατί SSoT:** το ίδιο σύνολο (`column/beam/wall/slab/stair/foundation`)
 * καθόριζε ήδη — ως private `isStructuralEntity` — το ADR-470 per-element
 * component-visibility scope· τώρα το χρειάζεται ΚΑΙ ο structural-relevance gate
 * των proactive hooks (ώστε η μετακίνηση μιας απλής γραμμής να ΜΗΝ πυροδοτεί
 * full load-takedown/οπλισμό — ADR-459). Ένα σύνολο, μηδέν drift.
 *
 * @see hooks/useStructuralRelevanceRouter.ts — SINGLE-PATH relevance router (χρησιμοποιεί isStructuralMemberEntity)
 * @see hooks/useStructuralComponentOverride.ts — ADR-470 consumer
 */

/**
 * Οι entity types που έχουν σώμα/φέρουσα λειτουργία και μετέχουν στον στατικό
 * οργανισμό. Set για O(1) membership στο event-loop gate.
 */
export const STRUCTURAL_MEMBER_TYPES: ReadonlySet<string> = new Set<string>([
  'column', 'beam', 'wall', 'slab', 'stair', 'foundation',
]);

/** `true` αν ο τύπος entity είναι δομικό μέλος. */
export function isStructuralMemberType(type: string): boolean {
  return STRUCTURAL_MEMBER_TYPES.has(type);
}

/** `true` αν το entity είναι δομικό μέλος (διαβάζει μόνο το `type`). */
export function isStructuralMemberEntity(entity: { readonly type: string }): boolean {
  return STRUCTURAL_MEMBER_TYPES.has(entity.type);
}
