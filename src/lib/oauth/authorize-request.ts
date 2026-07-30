/**
 * Ανάλυση και επικύρωση του αιτήματος `/oauth/authorize` (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ Η ΔΙΑΚΡΙΣΗ ΠΟΥ ΚΡΑΤΑΕΙ ΤΟ ENDPOINT ΑΠΟ ΤΟ ΝΑ ΓΙΝΕΙ OPEN REDIRECT
 * ─────────────────────────────────────────────────────────────────────────────
 * Το OAuth επιστρέφει σφάλματα **στον client, μέσω redirect**. Αυτό είναι
 * σωστό — αλλά **μόνο αφού** επιβεβαιωθεί ότι το `redirect_uri` ανήκει όντως
 * στον client. Πριν από αυτό, ένα redirect θα σήμαινε: «δώσε μου οποιοδήποτε
 * URL και σε στέλνω εκεί» — δηλαδή ο authorization server θα γινόταν εργαλείο
 * phishing, με το κύρος του domain μας από πίσω.
 *
 * Γι' αυτό η επικύρωση επιστρέφει **δύο** είδη αποτυχίας:
 * - `fatal` — δεν έχουμε αξιόπιστο redirect. Το σφάλμα μένει στη σελίδα μας.
 * - `redirectable` — το redirect είναι επικυρωμένο· το σφάλμα φεύγει προς τα
 *   εκεί με `error` + `state`, όπως ορίζει το RFC 6749 §4.1.2.1.
 *
 * @module lib/oauth/authorize-request
 * @see ADR-738 §4
 */

import 'server-only';

import {
  fetchClientMetadata,
  matchRedirectUri,
  type ClientMetadataDocument,
} from './client-id-metadata';
import { isWellFormedS256Challenge } from './oauth-authorization-code';
import {
  isSupportedScope,
  MCP_REQUIRED_SCOPE,
  resolveRequestedAudience,
  SUPPORTED_SCOPES,
  type OAuthScope,
} from './oauth-config';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/** Κωδικοί σφάλματος του RFC 6749 §4.1.2.1 — όχι δικό μας λεξιλόγιο. */
export type AuthorizeErrorCode =
  | 'invalid_request'
  | 'unauthorized_client'
  | 'access_denied'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'server_error';

export interface ValidatedAuthorizeRequest {
  readonly clientId: string;
  readonly client: ClientMetadataDocument;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly scopes: readonly OAuthScope[];
  readonly state: string | null;
  readonly resource: string;
}

export type AuthorizeValidation =
  | { readonly ok: true; readonly request: ValidatedAuthorizeRequest }
  | {
      readonly ok: false;
      readonly disposition: 'fatal';
      readonly error: AuthorizeErrorCode;
      readonly description: string;
    }
  | {
      readonly ok: false;
      readonly disposition: 'redirectable';
      readonly error: AuthorizeErrorCode;
      readonly description: string;
      readonly redirectUri: string;
      readonly state: string | null;
    };

// ============================================================================
// ΒΟΗΘΗΤΙΚΑ
// ============================================================================

function fatal(error: AuthorizeErrorCode, description: string): AuthorizeValidation {
  return { ok: false, disposition: 'fatal', error, description };
}

function redirectable(
  error: AuthorizeErrorCode,
  description: string,
  redirectUri: string,
  state: string | null,
): AuthorizeValidation {
  return { ok: false, disposition: 'redirectable', error, description, redirectUri, state };
}

/**
 * `scope` → λίστα υποστηριζόμενων scopes.
 *
 * Απουσία `scope` ⇒ το ελάχιστο απαιτούμενο, όχι «όλα». Το πρότυπο θέλει τον
 * client να ζητά το ελάχιστο· ένας client που δεν δήλωσε τίποτα δεν πρέπει να
 * ανταμείβεται με τα πάντα.
 */
function parseScopes(raw: string | null): readonly OAuthScope[] | null {
  if (raw === null || raw.trim() === '') return [MCP_REQUIRED_SCOPE];

  const requested = raw.split(/\s+/).filter((entry) => entry !== '');
  if (requested.some((entry) => !isSupportedScope(entry))) return null;

  const unique = new Set(requested as OAuthScope[]);
  return SUPPORTED_SCOPES.filter((scope) => unique.has(scope));
}

// ============================================================================
// ΕΠΙΚΥΡΩΣΗ
// ============================================================================

/**
 * Επικυρώνει τις παραμέτρους ενός αιτήματος εξουσιοδότησης.
 *
 * ⚠️ Η **σειρά** των ελέγχων είναι μέρος της ασφάλειας, όχι στυλ. Πρώτα
 * `client_id`, μετά `redirect_uri` — και **μόνο τότε** τα υπόλοιπα γίνονται
 * `redirectable`. Κάθε αναδιάταξη που ανεβάζει έναν έλεγχο πάνω από την
 * επικύρωση του redirect μετατρέπει το σφάλμα του σε open redirect.
 */
export async function validateAuthorizeRequest(
  params: URLSearchParams,
): Promise<AuthorizeValidation> {
  const clientId = params.get('client_id');
  if (clientId === null || clientId === '') {
    return fatal('invalid_request', 'client_id is required');
  }

  const metadata = await fetchClientMetadata(clientId);
  if (!metadata.ok) {
    return fatal('unauthorized_client', `client metadata rejected: ${metadata.rejection}`);
  }

  const redirectUri = params.get('redirect_uri');
  if (redirectUri === null || redirectUri === '') {
    return fatal('invalid_request', 'redirect_uri is required');
  }
  if (!matchRedirectUri(metadata.document.redirect_uris, redirectUri)) {
    return fatal('invalid_request', 'redirect_uri does not match client metadata');
  }

  // ── Από εδώ και κάτω το redirect είναι αξιόπιστο ──────────────────────────
  const state = params.get('state');

  if (params.get('response_type') !== 'code') {
    return redirectable(
      'unsupported_response_type',
      'only response_type=code is supported',
      redirectUri,
      state,
    );
  }

  if (params.get('code_challenge_method') !== 'S256') {
    return redirectable(
      'invalid_request',
      'code_challenge_method must be S256',
      redirectUri,
      state,
    );
  }

  const codeChallenge = params.get('code_challenge');
  if (codeChallenge === null || !isWellFormedS256Challenge(codeChallenge)) {
    return redirectable('invalid_request', 'malformed code_challenge', redirectUri, state);
  }

  const scopes = parseScopes(params.get('scope'));
  if (scopes === null || scopes.length === 0) {
    return redirectable('invalid_scope', 'unsupported scope requested', redirectUri, state);
  }

  const resource = resolveRequestedAudience(params.get('resource'));
  if (resource === null) {
    return redirectable(
      'invalid_request',
      'resource must be the canonical MCP endpoint URI',
      redirectUri,
      state,
    );
  }

  return {
    ok: true,
    request: {
      clientId,
      client: metadata.document,
      redirectUri,
      codeChallenge,
      scopes,
      state,
      resource,
    },
  };
}

/** Χτίζει το URL σφάλματος προς τον client (RFC 6749 §4.1.2.1). */
export function buildErrorRedirect(
  redirectUri: string,
  error: AuthorizeErrorCode,
  description: string,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state !== null) url.searchParams.set('state', state);
  return url.toString();
}

/** Χτίζει το URL επιτυχίας προς τον client. */
export function buildCodeRedirect(
  redirectUri: string,
  code: string,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state !== null) url.searchParams.set('state', state);
  return url.toString();
}
