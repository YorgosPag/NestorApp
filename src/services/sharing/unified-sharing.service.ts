/**
 * =============================================================================
 * UNIFIED SHARING SERVICE — SSoT (ADR-315 · ADR-884 Φ0.12)
 * =============================================================================
 *
 * The **one** client entry point for shareable links — file / contact / the five
 * showcase surfaces. Since ADR-884 Φ0.12 it is a **thin facade**: every step of
 * the lifecycle runs on the server, and this module holds **no** Firestore access,
 * **no** token generation and **no** password hashing.
 *
 * | step | where it runs now | before Κ4 |
 * |---|---|---|
 * | create | `POST /api/shares` (`server/sharing/share-create.ts`) | browser `setDoc`, raw token, unsalted SHA-256 password |
 * | open | `POST /api/shares/resolve` (`share-resolve.ts`) | browser query on a world-readable collection |
 * | download | `POST /api/shares/download` (`share-download.ts`) | permanent `downloadUrl` read in the browser |
 * | revoke | `POST /api/shares/[id]/revoke` (`share-revoke.ts`) | browser `updateDoc` |
 * | list (ADR-315 §5) | `GET /api/shares?entityType&entityId` (`share-links-list.ts`) | — (did not exist) |
 * | revoke all | `POST /api/shares/revoke-all` (`share-revoke.ts`) | — |
 * | settings, same URL (Α13) | `PATCH /api/shares/[id]` (`share-update.ts`) | revoke + recreate (broke sent URLs) |
 *
 * This module is SSoT-locked (see `.ssot-registry.json` → `unified-sharing-service`):
 * no other module talks to `shares` / `file_shares` from the browser.
 *
 * @module services/sharing/unified-sharing.service
 * @ssot unified-sharing-service
 * @see docs/centralized-systems/reference/adrs/ADR-315-unified-sharing.md
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  CreateShareRequest,
  CreateShareResult,
  RevokeAllSharesRequest,
  RevokeAllSharesResult,
  ShareEntityType,
  ShareLinkSummary,
  ShareLinksListResult,
  UpdateShareRequest,
} from '@/types/sharing';
import type {
  ShareDownloadOutcome,
  ShareResolveOutcome,
  ShareResolveRequestBody,
} from './share-resolve-contract';

export class UnifiedSharingService {
  /**
   * Create a share link for an entity the caller's company owns. The tenant and
   * the author come from the session on the server — never from this call.
   * The raw token in the result is returned **once**; it is not stored anywhere.
   */
  static createShare(request: CreateShareRequest): Promise<CreateShareResult> {
    return apiClient.post<CreateShareResult>(API_ROUTES.SHARES.CREATE, request);
  }

  /** Revoke a share of the caller's company. One-way and idempotent. */
  static async revoke(shareId: string): Promise<void> {
    await apiClient.post(API_ROUTES.SHARES.REVOKE(shareId));
  }

  /**
   * The active links of one entity, for its owner (ADR-315 §5). A safe projection only —
   * no hash, no token: a link is shown **once**, at creation.
   */
  static listActive(entityType: ShareEntityType, entityId: string): Promise<ShareLinksListResult> {
    return apiClient.get<ShareLinksListResult>(API_ROUTES.SHARES.LIST(entityType, entityId));
  }

  /** Revoke every active link of an entity (optionally all but one). Idempotent. */
  static revokeAll(request: RevokeAllSharesRequest): Promise<RevokeAllSharesResult> {
    return apiClient.post<RevokeAllSharesResult>(API_ROUTES.SHARES.REVOKE_ALL, request);
  }

  /** Change a link's settings **without changing its URL** (Α13). Returns the new summary. */
  static async update(shareId: string, request: UpdateShareRequest): Promise<ShareLinkSummary> {
    const { link } = await apiClient.patch<{ link: ShareLinkSummary }>(API_ROUTES.SHARES.UPDATE(shareId), request);
    return link;
  }

  /**
   * What a visitor of `/shared/[token]` sees. Anonymous by design (the recipient
   * has no account); with the right password the server also sets a 15′
   * access-grant cookie that opens the showcase payload/PDF routes.
   */
  static resolve(token: string, password?: string): Promise<ShareResolveOutcome> {
    const body: ShareResolveRequestBody = password === undefined ? { token } : { token, password };
    return apiClient.post<ShareResolveOutcome>(API_ROUTES.SHARES.RESOLVE, body, { skipAuth: true });
  }

  /** A short-lived signed download URL for a shared file — counted, limit enforced. */
  static requestDownload(token: string): Promise<ShareDownloadOutcome> {
    const body: ShareResolveRequestBody = { token };
    return apiClient.post<ShareDownloadOutcome>(API_ROUTES.SHARES.DOWNLOAD, body, { skipAuth: true });
  }
}
