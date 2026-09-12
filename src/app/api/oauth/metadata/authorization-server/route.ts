/**
 * RFC 8414 — Authorization Server Metadata (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΠΕΔΙΑ ΠΟΥ ΚΑΘΟΡΙΖΟΥΝ ΑΝ Η ΡΟΗ ΞΕΚΙΝΑΕΙ ΚΑΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **`code_challenge_methods_supported`** — το πρότυπο λέει ρητά: «If
 *    `code_challenge_methods_supported` is absent, the authorization server does
 *    not support PKCE and MCP clients **MUST refuse to proceed**». Δηλαδή μια
 *    παράλειψη εδώ δεν αποδυναμώνει την ασφάλεια· **σταματά** κάθε client. Το
 *    πεδίο είναι υποχρεωτικό ακριβώς επειδή δεν υπάρχει άλλος τρόπος ανακάλυψης
 *    υποστήριξης PKCE.
 * 2. **`client_id_metadata_document_supported: true`** — δηλώνει CIMD, τη
 *    μέθοδο που η Autodesk πέρασε στο πρότυπο ως αντικαταστάτη του Dynamic
 *    Client Registration. Χωρίς αυτό, ο client θα έψαχνε `registration_endpoint`
 *    (που **δεν** εκθέτουμε) και θα κατέληγε να ζητά χειροκίνητα στοιχεία.
 *
 * ⚠️ **Δεν** δηλώνεται `registration_endpoint`: το DCR είναι `MAY` στο
 * 2025-11-25 και εκδίδει ταυτότητα σε οποιονδήποτε ζητήσει — ακριβώς το
 * πρόβλημα ελέγχου πρόσβασης που οδήγησε στο CIMD.
 *
 * @module app/api/oauth/metadata/authorization-server
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 */

import 'server-only';

import { NextResponse } from 'next/server';

// 🔑 ADR-855 Α1 — **ΡΗΤΗ** βαθμίδα, επειδή ο πίνακας προθεμάτων λέει άλλο.
//    Το `/api/oauth` δηλώνεται SENSITIVE (20/min) για την επιφάνεια ταυτότητας — σωστά
//    για `authorize`/`token`/`consents`, **λάθος** για αυτό: είναι **στατικό JSON
//    ανακάλυψης** (RFC 8414) που κάθε MCP client διαβάζει **πριν** από κάθε ροή. Η
//    δήλωση κερδίζει τον πίνακα, και γι' αυτό γράφεται εδώ αντί να μπει τέταρτη γραμμή
//    εξαίρεσης στον πίνακα (ADR-855 §7 Α1 · Α2).
import { withRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getIssuerUrl,
  getPublicBaseUrl,
  OAUTH_PATHS,
  PKCE_CODE_CHALLENGE_METHODS,
  SUPPORTED_SCOPES,
} from '@/lib/oauth/oauth-config';

async function handleGet(): Promise<NextResponse> {
  const base = getPublicBaseUrl();

  const body = {
    issuer: getIssuerUrl(),
    authorization_endpoint: `${base}${OAUTH_PATHS.AUTHORIZE}`,
    token_endpoint: `${base}${OAUTH_PATHS.TOKEN}`,
    scopes_supported: [...SUPPORTED_SCOPES],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: [...PKCE_CODE_CHALLENGE_METHODS],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
  };

  return NextResponse.json(body, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  });
}

export const GET = withRateLimit(handleGet, { category: 'STANDARD' });
