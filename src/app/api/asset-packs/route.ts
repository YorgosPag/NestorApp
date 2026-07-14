/**
 * =============================================================================
 * GET /api/asset-packs — ποια πακέτα δικαιούται ο τρέχων χρήστης (ADR-655)
 * =============================================================================
 *
 * **ΜΙΑ** κλήση, στο άνοιγμα της παλέτας. Επιστρέφει ΜΟΝΟ τα πακέτα στα οποία ο χρήστης έχει
 * όντως πρόσβαση — η λογική εξουσιοδότησης δεν φεύγει ποτέ από τον server.
 *
 * ⚠️ ΓΙΑΤΙ ΤΟ PAYLOAD ΕΙΝΑΙ ΤΟΣΟ ΜΙΚΡΟ: το `asset-pack-registry` είναι pure data και ζει ΚΑΙ στο
 * client bundle ⇒ ο client παράγει μόνος του τα URLs (`assetPackAssetUrl`) και ξέρει ήδη τον
 * κατάλογο. Άρα το μόνο που ΔΕΝ μπορεί (και δεν επιτρέπεται) να αποφασίσει μόνος του είναι το
 * **ποια πακέτα δικαιούται**. Αυτό — και μόνο αυτό — απαντά αυτό το endpoint.
 *
 * Belt-and-suspenders: το endpoint **κρύβει** τα μη δικαιούμενα πακέτα από το UI· ο asset proxy
 * τα **μπλοκάρει** στα bytes. Ένας χρήστης που μαντεύει το URL δεν κερδίζει τίποτα.
 *
 * Auth: withAuth (authenticated)
 * Rate: standard
 *
 * @module api/asset-packs
 * @enterprise ADR-655 Asset Packs — entitlement + secure delivery
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { listAccessibleAssetPacks } from '@/lib/asset-packs/asset-pack-guard.server';
import { listAssetPacks, type AssetPackId } from '@/lib/asset-packs/asset-pack-registry';

/** Ό,τι χρειάζεται το UI για να ξεκλειδώσει μια βιβλιοθήκη — τίποτα παραπάνω. */
export interface AccessibleAssetPack {
  readonly id: AssetPackId;
  readonly version: string;
}

export const GET = defineRoute(
  { rateLimit: 'standard' },
  async ({ auth, cache }) => {
    const accessible = await listAccessibleAssetPacks(auth, listAssetPacks(), cache);
    const packs: readonly AccessibleAssetPack[] = accessible.map((pack) => ({
      id: pack.id,
      version: pack.version,
    }));
    return ok({ packs });
  },
);
