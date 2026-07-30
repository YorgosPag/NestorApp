/**
 * RFC 9728 — Protected Resource Metadata (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΕΙΝΑΙ **MUST** ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΡΩΤΟ ΠΡΑΓΜΑ ΠΟΥ ΔΙΑΒΑΖΕΙ Ο CLIENT
 * ─────────────────────────────────────────────────────────────────────────────
 * «MCP servers **MUST** implement OAuth 2.0 Protected Resource Metadata
 * (RFC9728) to indicate the locations of authorization servers.»
 *
 * Χωρίς αυτό το έγγραφο, ένας MCP client που παίρνει `401` δεν έχει τρόπο να
 * μάθει **πού** να ζητήσει token. Δεν είναι διακοσμητικό metadata: είναι η
 * μοναδική γέφυρα από «απαγορεύεται» σε «να πώς παίρνεις άδεια».
 *
 * ⚠️ **Δημόσιο, χωρίς ταυτοποίηση — υποχρεωτικά.** Ο client το διαβάζει
 * *πριν* έχει οποιοδήποτε διαπιστευτήριο. Ένα `withAuth()` εδώ θα δημιουργούσε
 * αδιέξοδο: για να μάθεις πώς να ταυτοποιηθείς πρέπει να είσαι ταυτοποιημένος.
 * Το έγγραφο δεν περιέχει τίποτα μυστικό — μόνο δημόσιες διευθύνσεις.
 *
 * Σερβίρεται σε **δύο** διαδρομές μέσω rewrite (`next.config.js`): στη ρίζα και
 * με path insertion (`/.well-known/oauth-protected-resource/api/mcp`), επειδή
 * το πρότυπο ορίζει ότι ο client δοκιμάζει τη δεύτερη **πρώτη**.
 *
 * @module app/api/oauth/metadata/protected-resource
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getIssuerUrl,
  getMcpResourceUri,
  getPublicBaseUrl,
  OAUTH_PATHS,
  SUPPORTED_SCOPES,
} from '@/lib/oauth/oauth-config';

async function handleGet(): Promise<NextResponse> {
  const body = {
    resource: getMcpResourceUri(),
    authorization_servers: [getIssuerUrl()],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ['header'],
    resource_documentation: `${getPublicBaseUrl()}${OAUTH_PATHS.MCP_ENDPOINT}`,
  };

  return NextResponse.json(body, {
    headers: {
      'cache-control': 'public, max-age=3600',
      // Δημόσιο έγγραφο ανακάλυψης — clients το διαβάζουν και από browser context.
      'access-control-allow-origin': '*',
    },
  });
}

export const GET = withStandardRateLimit(handleGet);
