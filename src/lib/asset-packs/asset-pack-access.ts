/**
 * ADR-655 — Η **ΚΑΘΑΡΗ** απόφαση πρόσβασης σε asset pack. Μηδέν I/O, μηδέν Firebase, μηδέν React.
 *
 * Όλη η εξουσιοδότηση περιεχομένου περνά από ΕΔΩ — ο manifest route, ο asset proxy και (μελλοντικά)
 * κάθε νέος καταναλωτής καλούν την ΙΔΙΑ συνάρτηση. Ένα σημείο αλήθειας ⇒ αδύνατο να αποκλίνουν οι
 * δύο διαδρομές (το κλασικό «η λίστα κρύβει το pack αλλά το URL το σερβίρει»).
 *
 * ⚠️ ΔΥΟ ΑΝΕΞΑΡΤΗΤΑ ΣΤΡΩΜΑΤΑ — μην τα μπερδέψεις σε ένα:
 *   1. **Ποια ΕΤΑΙΡΕΙΑ απέκτησε το πακέτο** → `companies/{companyId}.assetPackEntitlements`.
 *   2. **Ποιος ΧΡΗΣΤΗΣ μέσα της μπορεί να το χρησιμοποιήσει** → RBAC `asset_packs:packs:use`.
 *
 * Το RBAC ΜΟΝΟ του δεν αρκεί: ξεχωρίζει ρόλους, ΟΧΙ πελάτες. Ένα permission δοσμένο στον ρόλο
 * `internal_user` το παίρνει κάθε internal user ΚΑΘΕ εταιρείας ⇒ αδύνατο να πουλήσεις πακέτο σε
 * έναν πελάτη και όχι σε άλλον. Γι' αυτό το entitlement είναι **δεδομένο της εταιρείας**.
 *
 * **Fail-closed**: κάθε άγνωστη/ελλιπής κατάσταση καταλήγει σε deny, ποτέ σε allow.
 *
 * @see ./asset-pack-registry.ts — η ταυτότητα του πακέτου (id/version/άδεια/assets)
 * @see docs/centralized-systems/reference/adrs/ADR-655-asset-packs.md
 */

import type { AssetPackStatus } from './asset-pack-registry';

/**
 * Το αποτέλεσμα. Τα deny είναι **διακριτά** (όχι σκέτο `false`) ώστε ο caller να επιστρέφει σωστό
 * HTTP status, να καταγράφει audit με λόγο, και το UI να δείχνει το σωστό μήνυμα.
 */
export type AssetPackAccessDecision =
  | 'allow'
  | 'deny:unknown-pack'
  | 'deny:disabled'
  | 'deny:not-entitled'
  | 'deny:no-permission';

export interface AssetPackAccessInput {
  readonly packId: string;
  /** `null` όταν το pack δεν υπάρχει στο registry. */
  readonly status: AssetPackStatus | null;
  /** Τα pack ids που έχει αποκτήσει η εταιρεία του χρήστη. */
  readonly companyEntitlements: readonly string[];
  /** Αποτέλεσμα του RBAC `hasPermission(ctx, 'asset_packs:packs:use')`. */
  readonly hasUsePermission: boolean;
  /** `super_admin` — παρακάμπτει τα πάντα (curation/verification). */
  readonly isSuperAdmin: boolean;
}

/**
 * Σειρά ελέγχων (η σειρά έχει σημασία):
 *   1. Άγνωστο pack → deny (ποτέ σιωπηλό allow σε τυπογραφικό λάθος).
 *   2. `disabled` → deny για ΟΛΟΥΣ πλην super-admin. Ο διακόπτης πανικού υπερισχύει κάθε
 *      entitlement: αν χαθεί η άδεια, κόβεται ακαριαία ακόμη και σε πελάτη που «το αγόρασε».
 *   3. super-admin → allow.
 *   4. `public` → allow σε κάθε αυθεντικοποιημένο (δωρεάν περιεχόμενο· κανένα entitlement).
 *   5. `entitled` → ΚΑΙ η εταιρεία το έχει, ΚΑΙ ο χρήστης έχει το δικαίωμα χρήσης.
 */
export function decideAssetPackAccess(input: AssetPackAccessInput): AssetPackAccessDecision {
  if (input.status === null) return 'deny:unknown-pack';
  if (input.status === 'disabled') return input.isSuperAdmin ? 'allow' : 'deny:disabled';
  if (input.isSuperAdmin) return 'allow';
  if (input.status === 'public') return 'allow';

  if (!input.companyEntitlements.includes(input.packId)) return 'deny:not-entitled';
  if (!input.hasUsePermission) return 'deny:no-permission';
  return 'allow';
}

/** HTTP status ανά απόφαση: άγνωστο pack → 404, κάθε άλλο deny → 403. */
export function assetPackDenyStatus(decision: AssetPackAccessDecision): 404 | 403 {
  return decision === 'deny:unknown-pack' ? 404 : 403;
}
