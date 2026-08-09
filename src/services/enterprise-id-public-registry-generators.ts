/**
 * ENTERPRISE ID GENERATION — PUBLIC REGISTRY (ADR-777 ΕΠΙΠΕΔΟ Α) + ΔΙΑΘΕΣΕΙΣ
 *
 * Extracted from `enterprise-id-class.ts` when that file crossed the N.7.1 500-line
 * ceiling — a **split, not a trim**, following the same move that produced
 * `enterprise-id-bim-generators.ts`: the ADR-777 public registry (γη, δημόσιο κτίριο)
 * plus the διάθεση that hangs off it form one coherent domain group, so they move out
 * whole instead of being shaved off one line at a time.
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   BimEntityIdGenerators        (ADR-363 drawing entities)
 *     ↑ extends
 *   PublicRegistryIdGenerators   (this file — ADR-777 level Α + offers)
 *     ↑ extends
 *   EnterpriseIdService          (owns the engine: retry loop, cache, stats)
 *
 * The engine stays in exactly one place; this file adds **naming**, never generation
 * logic. Consumers see no change — every method below stays on the
 * `enterpriseIdService` singleton surface.
 *
 * 🔴 **Οι ταυτότητες του επιπέδου Α γεννιούνται ΜΟΝΟ στον διακομιστή** (SPEC-777A §14.4):
 * το επίπεδο Α το βλέπουν όλοι οι πελάτες, άρα μια ταυτότητα που γεννήθηκε στον πελάτη
 * είναι ταυτότητα χωρίς επαλήθευση πηγής — και όχι για έναν χρήστη, για όλους.
 *
 * @module services/enterprise-id-public-registry-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { BimEntityIdGenerators } from './enterprise-id-bim-generators';

// Alias for compact generator methods
const P = ENTERPRISE_ID_PREFIXES;

export abstract class PublicRegistryIdGenerators extends BimEntityIdGenerators {
  // `generateId` κληρονομείται ως protected abstract από τη βάση — η μηχανή μένει μία.

  /**
   * ADR-777 Α1 — id ενός κομματιού ΓΗΣ (`land_*`). Διακομιστής μόνο (§14.4 κανόνες 1-2).
   */
  generatePublicLandId(): string { return this.generateId(P.PUBLIC_LAND).id; }

  /**
   * ADR-777 Α11 — id δημόσιου ΚΤΙΡΙΟΥ (`pbld_*`). Διακομιστής μόνο, όπως και η γη.
   *
   * ⚠️ Δεν είναι το `generateBuildingId` — εκείνο δίνει `bldg_*` στο **εμπορικό** κτίριο
   * ενός έργου (επίπεδο Β).
   */
  generatePublicBuildingId(): string { return this.generateId(P.PUBLIC_BUILDING).id; }

  /**
   * ADR-777 Α20 — id μιας ΔΙΑΘΕΣΗΣ (`offr_*`).
   *
   * 🔴 Καλείται **μία φορά**, όταν γεννιέται η διάθεση, και ποτέ ξανά — ίδιο συμβόλαιο με
   * το `UniqueId` του Revit. Η ταυτότητα είναι το υποκείμενο του «το κλείσιμο μιας
   * διάθεσης αποσύρει τις άλλες»: χωρίς αυτήν, το «οι άλλες» δεν ονομάζεται.
   */
  generatePropertyOfferId(): string { return this.generateId(P.PROPERTY_OFFER).id; }
}
