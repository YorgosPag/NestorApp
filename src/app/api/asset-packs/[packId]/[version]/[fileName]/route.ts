/**
 * =============================================================================
 * GET /api/asset-packs/{packId}/{version}/{fileName} — Asset Pack proxy (ADR-655)
 * =============================================================================
 *
 * Ο **ΜΟΝΟΣ** δρόμος προς τα bytes ενός gated asset. Το `storage.rules` απαγορεύει ρητά κάθε
 * client read στο `asset-packs/**` ⇒ κανείς δεν κατεβάζει απευθείας, ούτε με το σωστό URL. Ο
 * proxy διαβάζει με Admin SDK (παρακάμπτει τους rules) ΑΦΟΥ περάσει η πύλη.
 *
 * ⚠️ ΓΙΑΤΙ PROXY ΚΑΙ ΟΧΙ SIGNED URL:
 *   1. Το signed URL **λήγει** ⇒ το `ImageEntity.url` θα έπρεπε να γίνει λογική αναφορά ⇒ η
 *      εξαγωγή DXF (`export/core/image-entity-export.ts`) που κάνει `decode(entity.url)` θα
 *      **παρέλειπε σιωπηλά** κάθε έπιπλο. Same-origin URL = σταθερό για πάντα.
 *   2. Ο browser στέλνει μόνος του το `__session` cookie σε κάθε `<img src>` και `fetch`.
 *   3. Η ανάκληση είναι **ανά αίτημα** — όχι παράθυρο μιας ώρας όπου ένα διαρρεύσαν URL δουλεύει.
 *   4. Same-origin ⇒ ποτέ canvas taint (το `toDataURL` του print/export path παραμένει καθαρό).
 *
 * **ΕΙΛΙΚΡΙΝΕΣ ΟΡΙΟ**: ένας *δικαιούχος* χρήστης μπορεί πάντα να εξάγει τα sprites (devtools,
 * DXF zip). Δεν υπάρχει DRM σε client rendering. Ο έλεγχος είναι entitlement + audit, όχι delivery.
 *
 * Auth: withAuth (authenticated) → `resolveAssetPackAccess` (status + entitlement + RBAC)
 * Rate: asset (600/min — οι εικόνες είναι δική τους κλάση κίνησης· βλ. rate-limit-config)
 *
 * @module api/asset-packs/[packId]/[version]/[fileName]
 * @enterprise ADR-655 Asset Packs — entitlement + secure delivery
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { defineRoute, httpError } from '@/lib/api/define-route';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { logAuditEvent } from '@/lib/auth/audit-core';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { assetPackDenyStatus } from '@/lib/asset-packs/asset-pack-access';
import { resolveAssetPackAccess } from '@/lib/asset-packs/asset-pack-guard.server';
import {
  assetPackStoragePath,
  getAssetPack,
  parseAssetPackFileName,
} from '@/lib/asset-packs/asset-pack-registry';

const logger = createModuleLogger('api:asset-packs');

/** Το περιεχόμενο είναι immutable ανά version ⇒ ο browser το ζητά ΜΙΑ φορά, ποτέ ξανά. */
const IMMUTABLE_CACHE = 'private, max-age=31536000, immutable';

interface AssetParams {
  readonly packId: string;
  readonly version: string;
  readonly fileName: string;
}

export const GET = defineRoute<never, AssetParams>(
  { rateLimit: 'asset' },
  async ({ auth, cache, req, params }) => {
    const pack = getAssetPack(params.packId);
    // Άγνωστο pack ή λάθος έκδοση → 404. Η έκδοση είναι μέρος της ταυτότητας: ένα παλιό URL
    // ΔΕΝ πρέπει να σερβίρει νέο περιεχόμενο (αλλιώς χαλάει το immutable caching).
    if (!pack || pack.version !== params.version) httpError(404, 'assetPacks.errors.notFound');

    // Strict allowlist — ΟΧΙ regex anti-traversal. Ό,τι δεν είναι στον κατάλογο δεν υπάρχει.
    const parsed = parseAssetPackFileName(params.fileName);
    if (!parsed || !new Set(pack.listAssetIds()).has(parsed.assetId)) {
      httpError(404, 'assetPacks.errors.notFound');
    }

    const decision = await resolveAssetPackAccess(auth, pack.id, cache);
    if (decision !== 'allow') {
      void logAuditEvent(auth, 'asset_pack.access_denied', pack.id, 'asset_pack', {
        metadata: { reason: decision, fileName: params.fileName },
      });
      httpError(assetPackDenyStatus(decision), `assetPacks.errors.${decision}`);
    }

    // Immutable + versioned ⇒ ένα σταθερό ETag αρκεί· μηδέν Storage I/O στο revalidation.
    const etag = `"${pack.id}-${pack.version}-${params.fileName}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, 'Cache-Control': IMMUTABLE_CACHE } });
    }

    const storagePath = assetPackStoragePath(pack, params.fileName);
    let bytes: Buffer;
    try {
      // Buffer αντί για stream: τα sprites είναι δεκάδες KB και ο browser τα κρατά για πάντα.
      // Αν κάποιο μελλοντικό pack έχει βαριά assets (>5MB), γύρνα σε `createReadStream()`.
      [bytes] = await getAdminBucket().file(storagePath).download();
    } catch (error) {
      logger.error(`[asset-packs] download failed: ${storagePath}`, { error });
      httpError(404, 'assetPacks.errors.notFound');
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': IMMUTABLE_CACHE,
        ETag: etag,
      },
    });
  },
);
