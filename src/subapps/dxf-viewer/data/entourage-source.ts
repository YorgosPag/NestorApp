/**
 * ADR-654 M6 / ADR-655 — Πού ζουν τα sprites ΚΑΘΕ οικογένειας entourage (κοινός resolver).
 *
 * Γενίκευση του `furniture-plan-source.ts`: το URL ενός sprite παράγεται **σύγχρονα** από το
 * asset-pack registry (`assetPackAssetUrl`) — καμία δικτύωση, κανένα `await`, κανένα race. Η
 * εξουσιοδότηση επιβάλλεται στον proxy όταν ο browser ζητήσει τα bytes, όχι εδώ. Το same-origin
 * versioned URL είναι σταθερό για πάντα ⇒ ό,τι γράφεται στο `ImageEntity.url` είναι φορητό dev↔prod.
 *
 * Ένας resolver ⇒ όλα τα packs (N.18: μηδέν sibling clone ανά pack· ο packId είναι παράμετρος).
 *
 * @see @/lib/asset-packs/asset-pack-registry — ο SSoT της ταυτότητας + των URLs
 * @see ./entourage-plan-sources.ts — τα per-pack pack ids + thin resolvers
 * @see docs/centralized-systems/reference/adrs/ADR-655-asset-packs.md
 */

import {
  getAssetPack,
  assetPackAssetUrl,
  type AssetPackId,
  type AssetPackVariant,
} from '@/lib/asset-packs/asset-pack-registry';

/** Ποια εκδοχή του asset: πλήρες sprite (καμβάς) ή thumbnail (παλέτα). */
export type EntourageAssetVariant = AssetPackVariant;

/**
 * Το URL ενός entourage sprite. **Σύγχρονο** — δεν αποτυγχάνει, δεν περιμένει. `packId` άγνωστο
 * ⇒ hard error (ποτέ σιωπηλό κενό URL — αυτό θα γεννούσε σπασμένο `<img>` στη σκηνή).
 */
export function resolveEntourageUrl(
  packId: AssetPackId,
  id: string,
  variant: EntourageAssetVariant = 'full',
): string {
  const pack = getAssetPack(packId);
  if (!pack) throw new Error(`resolveEntourageUrl: unknown asset pack "${packId}"`);
  return assetPackAssetUrl(pack, id, variant);
}
