/**
 * OAuth 2.1 token endpoint (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΠΑΡΑΧΩΡΗΣΕΙΣ, ΜΙΑ ΑΡΧΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * `authorization_code` και `refresh_token`. Και οι δύο εκδίδουν token με
 * **ρητό ακροατήριο** (RFC 8707) και επιστρέφουν **νέο** refresh — ο παλιός
 * πεθαίνει την ίδια στιγμή.
 *
 * ⚠️ **Κανένα client authentication.** Οι MCP clients είναι *public clients*:
 * τρέχουν στο μηχάνημα του χρήστη και δεν μπορούν να κρατήσουν μυστικό. Ένα
 * `client_secret` εδώ θα ήταν αυταπάτη ασφάλειας — θα βρισκόταν στον δίσκο κάθε
 * εγκατάστασης. Η ασφάλεια στηρίζεται σε **PKCE** (ο code είναι άχρηστος χωρίς
 * τον verifier) και σε **rotation με ανίχνευση επαναχρησιμοποίησης**. Το
 * `token_endpoint_auth_methods_supported: ['none']` το δηλώνει ρητά αντί να το
 * αφήσει να συναχθεί.
 *
 * ⚠️ **`application/x-www-form-urlencoded`**, όχι JSON: το OAuth 2.1 το ορίζει,
 * και κάθε βιβλιοθήκη client στέλνει έτσι. Ένα endpoint που δεχόταν μόνο JSON
 * θα απαιτούσε από κάθε client να παρεκκλίνει από το πρότυπο για χάρη μας.
 *
 * @module app/api/oauth/token
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { resolveRequestedAudience } from '@/lib/oauth/oauth-config';
import {
  linkCodeToTokenFamily,
  redeemAuthorizationCode,
} from '@/lib/oauth/oauth-authorization-code';
import {
  issueTokenPair,
  rotateRefreshToken,
  type IssuedTokenPair,
} from '@/lib/oauth/oauth-token-store';

// ============================================================================
// ΑΠΟΚΡΙΣΕΙΣ
// ============================================================================

/**
 * Σφάλμα κατά RFC 6749 §5.2.
 *
 * `no-store` επειδή το σώμα περιέχει (ή σχετίζεται με) διαπιστευτήρια — το ίδιο
 * το RFC το απαιτεί για κάθε απόκριση αυτού του endpoint.
 */
function tokenError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
  );
}

function tokenSuccess(issued: IssuedTokenPair): NextResponse {
  return NextResponse.json(
    {
      access_token: issued.accessToken,
      token_type: 'Bearer',
      expires_in: issued.expiresInSeconds,
      refresh_token: issued.refreshToken,
      scope: issued.scopes.join(' '),
    },
    { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
  );
}

// ============================================================================
// ΠΑΡΑΧΩΡΗΣΕΙΣ
// ============================================================================

async function grantAuthorizationCode(form: FormData): Promise<NextResponse> {
  const code = form.get('code');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');
  const codeVerifier = form.get('code_verifier');

  if (
    typeof code !== 'string' ||
    typeof clientId !== 'string' ||
    typeof redirectUri !== 'string' ||
    typeof codeVerifier !== 'string'
  ) {
    return tokenError(
      'invalid_request',
      'code, client_id, redirect_uri and code_verifier are required',
    );
  }

  const audience = resolveRequestedAudience(form.get('resource') as string | null);
  if (audience === null) {
    return tokenError('invalid_target', 'resource does not identify this server');
  }

  const redemption = await redeemAuthorizationCode({ code, clientId, redirectUri, codeVerifier });
  if (!redemption.ok) {
    // ⚠️ Ένας ενιαίος κωδικός για **κάθε** αστοχία του code. Ξεχωριστά μηνύματα
    // ανά αιτία (λάθος PKCE / λήξη / ήδη χρησιμοποιημένος) θα έλεγαν σε έναν
    // επιτιθέμενο πόσο κοντά είναι — η αιτία ζει στα logs, όχι στην απόκριση.
    return tokenError('invalid_grant', 'The authorization code is not valid');
  }

  const { grant } = redemption;
  if (grant.audience !== audience) {
    return tokenError('invalid_target', 'resource does not match the authorized audience');
  }

  const issued = await issueTokenPair({
    clientId: grant.clientId,
    uid: grant.uid,
    companyId: grant.companyId,
    globalRole: grant.globalRole,
    scopes: grant.scopes,
    audience: grant.audience,
    consentId: grant.consentId,
  });

  // Ο δεσμός code → οικογένεια γράφεται **μετά** την έκδοση: αν η έκδοση
  // αποτύχει, δεν έχει μείνει δείκτης σε tokens που δεν υπάρχουν.
  await linkCodeToTokenFamily(code, issued.familyId);

  return tokenSuccess(issued);
}

async function grantRefreshToken(form: FormData): Promise<NextResponse> {
  const refreshToken = form.get('refresh_token');
  if (typeof refreshToken !== 'string' || refreshToken === '') {
    return tokenError('invalid_request', 'refresh_token is required');
  }

  const audience = resolveRequestedAudience(form.get('resource') as string | null);
  if (audience === null) {
    return tokenError('invalid_target', 'resource does not identify this server');
  }

  const rotated = await rotateRefreshToken(refreshToken, audience);
  if (!rotated.ok) {
    return tokenError('invalid_grant', 'The refresh token is not valid');
  }

  return tokenSuccess(rotated.issued);
}

// ============================================================================
// ROUTE
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return tokenError('invalid_request', 'Body must be application/x-www-form-urlencoded');
  }

  switch (form.get('grant_type')) {
    case 'authorization_code':
      return grantAuthorizationCode(form);
    case 'refresh_token':
      return grantRefreshToken(form);
    default:
      return tokenError('unsupported_grant_type', 'Supported: authorization_code, refresh_token');
  }
}

export const POST = withSensitiveRateLimit(handlePost);
