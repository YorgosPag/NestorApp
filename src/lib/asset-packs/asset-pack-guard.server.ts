/**
 * ADR-655 — Server-only πύλη asset packs: **η ΜΟΝΗ διαδρομή** που αποφασίζει αν ένας χρήστης
 * παίρνει ένα πακέτο. Ο manifest route ΚΑΙ ο asset proxy καλούν αυτό — ποτέ δεν ξαναγράφουν
 * τη λογική. Αν οι δύο διαδρομές μπορούσαν να αποκλίνουν, θα είχαμε το κλασικό κενό «η λίστα
 * κρύβει το pack αλλά το URL το σερβίρει».
 *
 * ⚠️ SERVER-ONLY. Διαβάζει Firestore με Admin SDK (παρακάμπτει τους rules) και καλεί τον
 * server-only permission checker. ΜΗΝ το κάνεις import από client component.
 *
 * **Ο διακόπτης**: `asset_pack_config/{packId}.status`. Αλλάζεις ένα πεδίο ⇒ κόβεται παντού σε
 * ≤ {@link CONFIG_TTL_MS}. Καμία μεταγλώττιση, κανένα deploy. Γι' αυτό το TTL είναι μικρό: το
 * κόστος είναι ένα Firestore read/λεπτό/instance, το όφελος είναι ότι ο διακόπτης ΟΝΤΩΣ κόβει.
 *
 * @see ./asset-pack-access.ts — η καθαρή απόφαση (μηδέν I/O· εκεί ζουν τα tests)
 * @see ./asset-pack-registry.ts — η ταυτότητα του πακέτου
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { hasPermission, type PermissionCache } from '@/lib/auth/permissions';
import type { AuthContext } from '@/lib/auth/types';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decideAssetPackAccess,
  type AssetPackAccessDecision,
} from './asset-pack-access';
import {
  getAssetPack,
  type AssetPackDefinition,
  type AssetPackStatus,
} from './asset-pack-registry';

const logger = createModuleLogger('asset-packs');

/** Firestore collection του διακόπτη (doc id = packId — φυσικό κλειδί config, όχι entity). */
export const ASSET_PACK_CONFIG_COLLECTION = COLLECTIONS.ASSET_PACK_CONFIG;

/** Πεδίο στο `companies/{companyId}`: ποια packs έχει αποκτήσει η εταιρεία. */
export const COMPANY_ENTITLEMENTS_FIELD = 'assetPackEntitlements';

/** Πόσο «μπαγιάτικη» επιτρέπεται να είναι η κατάσταση. Ορίζει την ταχύτητα του kill switch. */
const CONFIG_TTL_MS = 60_000;

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const statusCache = new Map<string, CacheEntry<AssetPackStatus>>();
const entitlementCache = new Map<string, CacheEntry<readonly string[]>>();

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string, now: number): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= now) return null;
  return hit.value;
}

function isAssetPackStatus(value: unknown): value is AssetPackStatus {
  return value === 'public' || value === 'entitled' || value === 'disabled';
}

/**
 * Τρέχουσα κατάσταση του πακέτου. **Fail-closed**: κάθε σφάλμα ή κακοσχηματισμένο doc πέφτει στο
 * `defaultStatus` του registry — ποτέ σε `public`.
 */
async function loadStatus(pack: AssetPackDefinition, now: number): Promise<AssetPackStatus> {
  const cached = readCache(statusCache, pack.id, now);
  if (cached) return cached;

  let status: AssetPackStatus = pack.defaultStatus;
  try {
    const snap = await getAdminFirestore()
      .collection(ASSET_PACK_CONFIG_COLLECTION)
      .doc(pack.id)
      .get();
    const raw: unknown = snap.exists ? snap.get('status') : undefined;
    if (isAssetPackStatus(raw)) status = raw;
  } catch (error) {
    logger.error(`[asset-packs] status read failed for ${pack.id} — falling back to default`, error);
  }

  statusCache.set(pack.id, { value: status, expiresAt: now + CONFIG_TTL_MS });
  return status;
}

/** Ποια packs έχει αποκτήσει η εταιρεία. Fail-closed: σφάλμα ⇒ κενή λίστα (⇒ deny). */
async function loadCompanyEntitlements(companyId: string, now: number): Promise<readonly string[]> {
  const cached = readCache(entitlementCache, companyId, now);
  if (cached) return cached;

  let entitlements: readonly string[] = [];
  try {
    const snap = await getAdminFirestore().collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    const raw: unknown = snap.get(COMPANY_ENTITLEMENTS_FIELD);
    if (Array.isArray(raw)) entitlements = raw.filter((id): id is string => typeof id === 'string');
  } catch (error) {
    logger.error(`[asset-packs] entitlements read failed for company ${companyId}`, error);
  }

  entitlementCache.set(companyId, { value: entitlements, expiresAt: now + CONFIG_TTL_MS });
  return entitlements;
}

/**
 * Η απόφαση για ΕΝΑ pack. Το `pack === null` (άγνωστο id) γυρίζει `deny:unknown-pack` χωρίς να
 * αγγίξει καν το Firestore.
 */
export async function resolveAssetPackAccess(
  ctx: AuthContext,
  packId: string,
  cache?: PermissionCache,
): Promise<AssetPackAccessDecision> {
  const pack = getAssetPack(packId);
  if (!pack) return 'deny:unknown-pack';

  const now = Date.now();
  const isSuperAdmin = ctx.globalRole === 'super_admin';

  const [status, companyEntitlements, hasUsePermission] = await Promise.all([
    loadStatus(pack, now),
    isSuperAdmin ? Promise.resolve<readonly string[]>([]) : loadCompanyEntitlements(ctx.companyId, now),
    isSuperAdmin ? Promise.resolve(true) : hasPermission(ctx, 'asset_packs:packs:use', undefined, cache),
  ]);

  return decideAssetPackAccess({
    packId,
    status,
    companyEntitlements,
    hasUsePermission,
    isSuperAdmin,
  });
}

/** Τα packs στα οποία ο χρήστης ΟΝΤΩΣ έχει πρόσβαση — ο manifest δεν επιστρέφει τίποτε άλλο. */
export async function listAccessibleAssetPacks(
  ctx: AuthContext,
  packs: readonly AssetPackDefinition[],
  cache?: PermissionCache,
): Promise<readonly AssetPackDefinition[]> {
  const decisions = await Promise.all(
    packs.map((pack) => resolveAssetPackAccess(ctx, pack.id, cache)),
  );
  return packs.filter((_, index) => decisions[index] === 'allow');
}
