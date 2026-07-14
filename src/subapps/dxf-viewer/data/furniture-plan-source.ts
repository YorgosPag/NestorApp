/**
 * ADR-655 (ήταν ADR-654) — Πού ζουν τα sprites των επίπλων κάτοψης.
 *
 * Η βιβλιοθήκη μετακόμισε σε **asset pack** (`furniture-plan-2d`): αδειοδοτημένο περιεχόμενο που
 * σερβίρεται ΜΟΝΟ μέσω του authenticated proxy `/api/asset-packs/...`, αφού περάσει η πύλη
 * (kill switch → company entitlement → RBAC). Το `storage.rules` απαγορεύει κάθε άμεσο client read.
 *
 * ⚠️ ΤΡΕΙΣ ΣΥΝΕΠΕΙΕΣ ΠΟΥ ΑΞΙΖΕΙ ΝΑ ΞΕΡΕΙΣ:
 *
 * 1. **Το URL είναι πλέον ΣΥΓΧΡΟΝΟ.** Παράγεται από το registry (`assetPackAssetUrl`) — καμία
 *    δικτύωση, κανένα `getDownloadURL`, κανένα `await`. Όλος ο προηγούμενος μηχανισμός
 *    prefetch/race (async resolve ΠΡΙΝ γράψει το selection store) **εξαφανίστηκε**: δεν υπάρχει
 *    race όταν δεν υπάρχει αναμονή.
 *
 * 2. **ΜΙΑ διαδρομή σε dev ΚΑΙ σε production.** Το παλιό `public` mode έδινε `/furniture-2d/x.webp`
 *    σε dev και storage URL σε prod ⇒ ένα σχέδιο αποθηκευμένο σε dev **έσπαγε** σε prod (το
 *    `ImageEntity.url` γράφεται μέσα στην οντότητα). Τώρα και τα δύο περιβάλλοντα παράγουν το ΙΔΙΟ
 *    same-origin URL ⇒ τα σχέδια είναι φορητά. Τίμημα: το dev θέλει τα assets ανεβασμένα στο
 *    Storage (`node scripts/upload-asset-pack.js furniture-plan-2d`) — μία φορά.
 *
 * 3. **Το URL είναι σταθερό για πάντα** (same-origin, versioned), σε αντίθεση με signed URL που θα
 *    έληγε και θα έσπαγε κάθε αποθηκευμένο σχέδιο ένα ώρα αργότερα.
 *
 * @see @/lib/asset-packs/asset-pack-registry — ο SSoT της ταυτότητας + των URLs
 * @see src/app/api/asset-packs — ο proxy που επιβάλλει την πύλη
 * @see docs/centralized-systems/reference/adrs/ADR-655-asset-packs.md
 */

import {
  ASSET_PACKS,
  assetPackAssetUrl,
  type AssetPackVariant,
} from '@/lib/asset-packs/asset-pack-registry';

/** Το pack στο οποίο ανήκουν τα έπιπλα κάτοψης. */
export const FURNITURE_PLAN_PACK_ID = 'furniture-plan-2d' as const;

/** Ποια εκδοχή του asset: πλήρες sprite (καμβάς) ή thumbnail (παλέτα). */
export type FurniturePlanAssetVariant = AssetPackVariant;

/**
 * Το URL ενός sprite. **Σύγχρονο** — δεν αποτυγχάνει, δεν περιμένει. Η εξουσιοδότηση
 * επιβάλλεται στον proxy όταν ο browser ζητήσει τα bytes, όχι εδώ.
 */
export function resolveFurniturePlanUrl(
  id: string,
  variant: FurniturePlanAssetVariant = 'full',
): string {
  return assetPackAssetUrl(ASSET_PACKS[FURNITURE_PLAN_PACK_ID], id, variant);
}
