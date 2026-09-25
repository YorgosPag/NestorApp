/**
 * =============================================================================
 * SHOWCASE CORE — Public share-token lookup, once
 * =============================================================================
 *
 * Resolving `?token=` to a live share was written **six times** across the
 * public showcase routes (4 payload + 2 PDF), and later a seventh and eighth
 * time in the property routes (`api/showcase/[token]/*`). ADR-698 collapsed the
 * unified surfaces onto this module; ADR-884 Φ0.12 collapses **everything**
 * onto the one share gate (`server/sharing/share-gate.ts`), property included.
 *
 * ## What changed with ADR-884 Φ0.12
 *
 * | before | after |
 * |---|---|
 * | `token == ` query on a world-readable collection | `tokenHash == ` (raw `token` only for not-yet-migrated docs), server-only |
 * | password **never checked** by the API — only the `/shared` page asked | the gate demands the access grant cookie issued after the right password (**401** otherwise) |
 * | expiry checked by each route, limit never | expiry **and** limit judged by the gate (**410**) |
 * | raw token written to logs | never — `shareId` only |
 *
 * The anomaly guard (two active shares for one token) and the required-field
 * guard (no `entityId` / `companyId` / `expiresAt` ⇒ not served) now live in
 * `server/sharing/share-token-lookup.ts` (`normalizeUnifiedShare` /
 * `normalizeLegacyFileShare`), where **every** caller gets them.
 *
 * @module services/showcase-core/api/public-share-lookup
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 * @see ADR-315 Unified Sharing · ADR-321 Showcase Core · ADR-884 §8.1 Φ0.12
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger, type Logger } from '@/lib/telemetry/Logger';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import { passShareGate } from '@/server/sharing/share-gate';
import type { StoredShare } from '@/server/sharing/share-token-lookup';
import type { ShareResolveRefusal } from '@/services/sharing/share-resolve-contract';
import type { ShareEntityType } from '@/types/sharing';

/** A live share resolved from a public token, and cleared by the gate. */
export interface PublicShowcaseShare {
  /** Share document id. */
  id: string;
  entityId: string;
  companyId: string;
  expiresAt: string;
  /** Present only when the showcase has a generated PDF. */
  pdfStoragePath?: string;
  /** Free-text note (property: legacy video URL). */
  note: string | null;
  /** The normalised record — the PDF route hands it to `recordShareAccess`. */
  stored: StoredShare;
}

/** Why a public showcase request is not served — each maps to one HTTP status. */
export type PublicShowcaseRefusal = 'not-found' | 'password-required' | 'expired' | 'unavailable';

export type PublicShowcaseLookup =
  | { readonly ok: true; readonly share: PublicShowcaseShare }
  | { readonly ok: false; readonly refusal: PublicShowcaseRefusal };

export interface LookupPublicShowcaseShareParams {
  token: string;
  /** Share discriminator, e.g. `'building_showcase'`. */
  entityType: ShareEntityType;
  adminDb: Firestore;
  /** The incoming request — carries the access grant cookie of password-protected shares. */
  request: NextRequest;
  /** When true, a share without `showcaseMeta.pdfStoragePath` is not served. */
  requirePdfPath?: boolean;
}

/** HTTP status + body per refusal — one table, shared by payload and PDF routes. */
const REFUSAL_RESPONSES: Readonly<Record<Exclude<PublicShowcaseRefusal, 'not-found'>, { status: number; error: string }>> = {
  'password-required': { status: 401, error: 'Password required' },
  expired: { status: 410, error: 'Showcase link has expired' },
  unavailable: { status: 503, error: 'Showcase link is temporarily unavailable' },
};

/**
 * Refusal → response. Bodies are **wire contract** (the showcase pages branch on
 * the status), in English like every other public-route error body. `not-found`
 * keeps each surface's own 404 message, which older clients match on.
 */
export function publicShowcaseRefusalResponse(
  refusal: PublicShowcaseRefusal,
  shareNotFoundMessage: string,
): NextResponse {
  if (refusal === 'not-found') {
    return NextResponse.json({ error: shareNotFoundMessage }, { status: 404 });
  }
  const { status, error } = REFUSAL_RESPONSES[refusal];
  return NextResponse.json({ error }, { status });
}

/**
 * Gate refusal → public refusal. An exhausted share answers like an expired one
 * (410 Gone — the link no longer serves); `wrong-password` / `locked` cannot
 * occur here (these routes never receive a password) and fold into 404.
 */
function toPublicRefusal(reason: ShareResolveRefusal | 'password-required'): PublicShowcaseRefusal {
  switch (reason) {
    case 'password-required':
    case 'unavailable':
    case 'expired':
      return reason;
    case 'exhausted':
      return 'expired';
    default:
      return 'not-found';
  }
}

type OpenPublicShowcaseResult =
  | { readonly ok: true; readonly share: PublicShowcaseShare; readonly adminDb: Firestore }
  | { readonly ok: false; readonly response: NextResponse };

interface OpenPublicShowcaseParams {
  request: NextRequest;
  token: string;
  entityType: ShareEntityType;
  /** Each surface's own 404 body — see `publicShowcaseRefusalResponse`. */
  shareNotFoundMessage: string;
}

/**
 * The one preamble of every public showcase route (payload **and** PDF):
 * empty token → 400 · no Admin SDK → 503 · gate refusal → its status.
 * Written once so the two route factories cannot drift apart (CHECK 3.28).
 */
async function openPublicShowcaseShare({
  request,
  token,
  entityType,
  shareNotFoundMessage,
}: OpenPublicShowcaseParams): Promise<OpenPublicShowcaseResult> {
  if (!token || token.trim().length === 0) {
    return { ok: false, response: NextResponse.json({ error: 'Token is required' }, { status: 400 }) };
  }
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    return { ok: false, response: NextResponse.json({ error: 'Database connection not available' }, { status: 503 }) };
  }
  const lookup = await lookupPublicShowcaseShare({ token, entityType, adminDb, request });
  if (!lookup.ok) {
    return { ok: false, response: publicShowcaseRefusalResponse(lookup.refusal, shareNotFoundMessage) };
  }
  return { ok: true, share: lookup.share, adminDb };
}

/** What a route serves with, once the preamble has cleared the request. */
export interface PublicShowcaseContext {
  readonly request: NextRequest;
  readonly token: string;
  readonly share: PublicShowcaseShare;
  readonly adminDb: Firestore;
  readonly logger: Logger;
}

export interface PublicShowcaseHandlerConfig {
  loggerName: string;
  shareEntityType: ShareEntityType;
  shareNotFoundMessage: string;
}

export interface PublicShowcaseHandler {
  handle(request: NextRequest, token: string): Promise<NextResponse>;
}

/**
 * The skeleton of every public showcase route factory: one logger, the one
 * preamble, then the surface's own `serve`. Payload and PDF differ **only** in `serve`.
 */
export function createPublicShowcaseHandler(
  config: PublicShowcaseHandlerConfig,
  serve: (ctx: PublicShowcaseContext) => Promise<NextResponse>,
): PublicShowcaseHandler {
  const logger = createModuleLogger(config.loggerName);
  return {
    async handle(request, token) {
      const opened = await openPublicShowcaseShare({
        request, token, entityType: config.shareEntityType, shareNotFoundMessage: config.shareNotFoundMessage,
      });
      if (!opened.ok) return opened.response;
      return serve({ request, token, share: opened.share, adminDb: opened.adminDb, logger });
    },
  };
}

/**
 * Resolve a public showcase token through the share gate.
 *
 * A wrong entity type answers `not-found` — the same 404 as a missing token, so
 * the endpoint does not confirm that a token exists under another surface.
 */
export async function lookupPublicShowcaseShare({
  token,
  entityType,
  adminDb,
  request,
  requirePdfPath = false,
}: LookupPublicShowcaseShareParams): Promise<PublicShowcaseLookup> {
  const verdict = await passShareGate({
    adminDb,
    token,
    hasGrant: (shareId) => requestHasShareAccessGrant(request, shareId),
  });
  if (!verdict.pass) return { ok: false, refusal: toPublicRefusal(verdict.reason) };

  const stored = verdict.share;
  const pdfStoragePath = stored.showcaseMeta?.pdfStoragePath || undefined;
  if (stored.entityType !== entityType || (requirePdfPath && !pdfStoragePath)) {
    return { ok: false, refusal: 'not-found' };
  }

  return {
    ok: true,
    share: {
      id: stored.id,
      entityId: stored.entityId,
      companyId: stored.companyId,
      expiresAt: stored.expiresAt,
      pdfStoragePath,
      note: stored.note,
      stored,
    },
  };
}
