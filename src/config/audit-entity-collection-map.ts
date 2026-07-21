/**
 * Audit entity routing — SSoT (ADR-195).
 *
 * Ο χάρτης `entityType → Firestore collection` που χρησιμοποιεί το `/api/audit-trail/record` route
 * για ownership verification, μαζί με τα παράγωγά του (`VALID_ENTITY_TYPES`) και το σύνολο των
 * subcollection-scoped τύπων. **Εξήχθη από το route** ώστε να είναι **testable** χωρίς Next server
 * deps: ένα regression test (`__tests__/audit-entity-collection-map.test.ts`) κλειδώνει ότι κάθε
 * BIM audit-client entityType υπάρχει εδώ — αλλιώς κάθε POST του θα έκανε σιωπηλά 400 «Invalid
 * entityType» (fire-and-forget) και το ιστορικό δεν θα καταγραφόταν ΠΟΤΕ. Αυτή ήταν η ακριβής
 * «desync» κλάση που χτύπησε mep-fitting/foundation και (ADR-684) imported-mesh/furniture.
 *
 * SSoT: αυτός ο χάρτης είναι η ΜΟΝΑΔΙΚΗ πηγή έγκυρων audit entity types — το `VALID_ENTITY_TYPES`
 * ΠΑΡΑΓΕΤΑΙ από τα κλειδιά του, οπότε ένας τύπος δεν μπορεί ποτέ να είναι «έγκυρος» χωρίς mapping.
 * Πρόσθεσε νέο auditable entity ΕΔΩ (ένα σημείο) και γίνεται αυτόματα αποδεκτό.
 *
 * @see src/app/api/audit-trail/record/route.ts — ο μόνος καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuditEntityType } from '@/types/audit-trail';

/**
 * Entity types whose documents live in a per-company subcollection
 * (`companies/{companyId}/<collection>/{id}`) rather than a top-level collection.
 */
export const SUBCOLLECTION_ENTITY_TYPES: ReadonlySet<string> = new Set<AuditEntityType>([
  'bim_family_type',
]);

/**
 * Map entity type → Firestore collection for ownership verification.
 *
 * Typing: `Record<string, string | undefined>` keeps it indexable by the raw
 * `body.entityType` string (returning `undefined` for unknown types, preserving the
 * runtime guard), while `satisfies Partial<Record<AuditEntityType, string>>` compile-time
 * rejects any key that is not a real `AuditEntityType`.
 */
export const ENTITY_COLLECTION_MAP: Record<string, string | undefined> = {
  contact: COLLECTIONS.CONTACTS,
  building: COLLECTIONS.BUILDINGS,
  property: COLLECTIONS.PROPERTIES,
  project: COLLECTIONS.PROJECTS,
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
  wall: COLLECTIONS.FLOORPLAN_WALLS,
  opening: COLLECTIONS.FLOORPLAN_OPENINGS,
  slab: COLLECTIONS.FLOORPLAN_SLABS,
  'slab-opening': COLLECTIONS.FLOORPLAN_SLAB_OPENINGS,
  column: COLLECTIONS.FLOORPLAN_COLUMNS,
  beam: COLLECTIONS.FLOORPLAN_BEAMS,
  stair: COLLECTIONS.FLOORPLAN_STAIRS,
  // ADR-417 — parametric pitched roof (top-level floorplan_roofs collection).
  roof: COLLECTIONS.FLOORPLAN_ROOFS,
  // ADR-406 — was missing (fixture audit 400'd silently via fire-and-forget). Fixed alongside ADR-408.
  'mep-fixture': COLLECTIONS.FLOORPLAN_MEP_FIXTURES,
  // ADR-408 — logical MEP systems.
  'mep-system': COLLECTIONS.FLOORPLAN_MEP_SYSTEMS,
  // ADR-408 Φ3 — point-based electrical panels.
  'electrical-panel': COLLECTIONS.FLOORPLAN_ELECTRICAL_PANELS,
  // ADR-408 Φ8 — linear duct/pipe MEP segments.
  'mep-segment': COLLECTIONS.FLOORPLAN_MEP_SEGMENTS,
  // ADR-408 Φ12 — point-based plumbing manifolds.
  'mep-manifold': COLLECTIONS.FLOORPLAN_MEP_MANIFOLDS,
  // ADR-408 Φ11 — auto-derived pipe fittings. Was in VALID_ENTITY_TYPES but missing
  // here → every fitting audit POST 400'd ("No collection mapping"), spamming the
  // console in bursts whenever pipes were drawn (auto-reconciler creates fittings).
  'mep-fitting': COLLECTIONS.FLOORPLAN_MEP_FITTINGS,
  // ADR-436 — foundation discipline (pads / strip footings / tie-beams). Was missing
  // → every foundation audit POST 400'd ("Invalid entityType"), spamming the console
  // in bursts whenever the grid reconciler ran. Same desync class as mep-fitting above.
  foundation: COLLECTIONS.FLOORPLAN_FOUNDATIONS,
  // ADR-412 Φ5 — BIM family types (subcollection — see SUBCOLLECTION_ENTITY_TYPES).
  bim_family_type: COLLECTIONS.BIM_FAMILY_TYPES,
  // ADR-410 / ADR-683 / ADR-684 — mesh/parametric point entities (top-level collections). Ήταν ΟΛΑ
  // απόντα από αυτόν τον χάρτη → κάθε audit POST τους έκανε 400 (ο client υπήρχε αλλά ο διακομιστής
  // απέρριπτε το entityType) → σιωπηλή απώλεια ιστορικού μέσω του `.catch(()=>{})`. Ίδια desync
  // κλάση με mep-fitting/foundation παραπάνω.
  furniture: COLLECTIONS.FLOORPLAN_FURNITURE,
  'imported-mesh': COLLECTIONS.FLOORPLAN_IMPORTED_MESHES,
  'generic-solid': COLLECTIONS.FLOORPLAN_GENERIC_SOLIDS,
} satisfies Partial<Record<AuditEntityType, string>>;

/**
 * Valid audit entity types — DERIVED from `ENTITY_COLLECTION_MAP` keys (SSoT).
 * Never hand-maintain a parallel list again.
 */
export const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set(Object.keys(ENTITY_COLLECTION_MAP));
