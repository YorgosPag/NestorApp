/**
 * OAuth 2.1 authorization endpoint (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΜΕΘΟΔΟΙ, ΔΥΟ ΡΟΛΟΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * - **GET** — φτάνει ο client. Επικυρώνει, ταυτοποιεί τον άνθρωπο, και είτε
 *   ανανεώνει σιωπηλά υπάρχουσα συγκατάθεση είτε στέλνει στην οθόνη έγκρισης.
 * - **POST** — απαντά ο άνθρωπος. Καταναλώνει το εκκρεμές αίτημα και εκδίδει
 *   (ή αρνείται) τον code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΣΙΩΠΗΛΗ ΕΓΚΡΙΣΗ — ΠΟΤΕ ΚΑΙ ΓΙΑΤΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αν υπάρχει **ενεργή** συγκατάθεση του ίδιου χρήστη, για τον ίδιο client, στο
 * ίδιο resource, που **καλύπτει** τα ζητούμενα scopes, ο code εκδίδεται χωρίς
 * νέα ερώτηση. Αυτό δεν είναι ευκολία: μια οθόνη που εμφανίζεται σε κάθε
 * ανανέωση token εκπαιδεύει τον χρήστη να πατά «Έγκριση» χωρίς να διαβάζει —
 * και τότε η μία φορά που η αίτηση είναι κακόβουλη περνά κι αυτή.
 *
 * Η κάλυψη ελέγχεται ως **υπερσύνολο**, όχι ως ισότητα: αίτημα για λιγότερα
 * από τα εγκεκριμένα περνά· αίτημα για **έστω ένα** επιπλέον scope ξαναρωτά.
 *
 * @module app/api/oauth/authorize
 * @see ADR-738 §4
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { isAuthenticated } from '@/lib/auth/types';
import type { AuthContext } from '@/lib/auth/types';
import {
  buildCodeRedirect,
  buildErrorRedirect,
  validateAuthorizeRequest,
  type ValidatedAuthorizeRequest,
} from '@/lib/oauth/authorize-request';
import {
  consumePendingRequest,
  storePendingRequest,
  type PendingAuthorizeRequest,
} from '@/lib/oauth/authorize-request-store';
import { isLoopbackRedirectUri } from '@/lib/oauth/client-id-metadata';
import {
  getPublicBaseUrl,
  isFamiliarClientDomain,
  OAUTH_PATHS,
  type OAuthScope,
} from '@/lib/oauth/oauth-config';
import {
  issueAuthorizationCode,
  type AuthorizationCodeGrant,
} from '@/lib/oauth/oauth-authorization-code';
import { findActiveConsent, recordConsent } from '@/lib/oauth/oauth-consent-store';

// ============================================================================
// ΒΟΗΘΗΤΙΚΑ
// ============================================================================

/** Σελίδα δικού μας σφάλματος — όταν **δεν** έχουμε αξιόπιστο redirect. */
function fatalErrorPage(error: string, description: string): NextResponse {
  const url = new URL(`${getPublicBaseUrl()}${OAUTH_PATHS.CONSENT_PAGE}`);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  return NextResponse.redirect(url, 303);
}

/** Ο χρήστης δεν είναι συνδεδεμένος — στείλ' τον στο login και πίσω. */
function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL('/login', getPublicBaseUrl());
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url, 303);
}

function coversRequestedScopes(
  granted: readonly OAuthScope[],
  requested: readonly OAuthScope[],
): boolean {
  return requested.every((scope) => granted.includes(scope));
}

function toPending(
  validated: ValidatedAuthorizeRequest,
  ctx: AuthContext,
): PendingAuthorizeRequest {
  let clientHost = '';
  try {
    clientHost = new URL(validated.clientId).hostname;
  } catch {
    clientHost = '';
  }

  return {
    clientId: validated.clientId,
    clientName: validated.client.client_name,
    clientUri: validated.client.client_uri ?? null,
    redirectUri: validated.redirectUri,
    isLoopbackRedirect: isLoopbackRedirectUri(validated.redirectUri),
    codeChallenge: validated.codeChallenge,
    scopes: validated.scopes,
    state: validated.state,
    resource: validated.resource,
    uid: ctx.uid,
    companyId: ctx.companyId,
    globalRole: ctx.globalRole,
    isFamiliarClient: clientHost !== '' && isFamiliarClientDomain(clientHost),
  };
}

async function issueCodeRedirect(
  grant: AuthorizationCodeGrant,
  state: string | null,
): Promise<NextResponse> {
  const code = await issueAuthorizationCode(grant);
  return NextResponse.redirect(buildCodeRedirect(grant.redirectUri, code, state), 303);
}

// ============================================================================
// GET — φτάνει ο client
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const validation = await validateAuthorizeRequest(request.nextUrl.searchParams);

  if (!validation.ok) {
    return validation.disposition === 'fatal'
      ? fatalErrorPage(validation.error, validation.description)
      : NextResponse.redirect(
          buildErrorRedirect(
            validation.redirectUri,
            validation.error,
            validation.description,
            validation.state,
          ),
          303,
        );
  }

  const ctx = await buildRequestContext(request);
  if (!isAuthenticated(ctx)) return loginRedirect(request);

  const validated = validation.request;
  const existing = await findActiveConsent(ctx.uid, validated.clientId, validated.resource);

  if (existing !== null && coversRequestedScopes(existing.scopes, validated.scopes)) {
    return issueCodeRedirect(
      {
        clientId: validated.clientId,
        redirectUri: validated.redirectUri,
        codeChallenge: validated.codeChallenge,
        scopes: validated.scopes,
        uid: ctx.uid,
        companyId: ctx.companyId,
        globalRole: ctx.globalRole,
        audience: validated.resource,
        consentId: existing.consentId,
      },
      validated.state,
    );
  }

  const handle = await storePendingRequest(toPending(validated, ctx));
  const consentUrl = new URL(`${getPublicBaseUrl()}${OAUTH_PATHS.CONSENT_PAGE}`);
  consentUrl.searchParams.set('request', handle);
  return NextResponse.redirect(consentUrl, 303);
}

// ============================================================================
// POST — απαντά ο άνθρωπος
// ============================================================================

interface ConsentDecisionBody {
  readonly request?: unknown;
  readonly decision?: unknown;
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const ctx = await buildRequestContext(request);
  if (!isAuthenticated(ctx)) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  }

  let body: ConsentDecisionBody;
  try {
    body = (await request.json()) as ConsentDecisionBody;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (typeof body.request !== 'string' || body.request === '') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const pending = await consumePendingRequest(body.request, ctx.uid);
  if (!pending.ok) {
    return NextResponse.json(
      { error: 'invalid_request', reason: pending.rejection },
      { status: 400 },
    );
  }

  const approved = body.decision === 'approve';
  if (!approved) {
    return NextResponse.json({
      redirectTo: buildErrorRedirect(
        pending.request.redirectUri,
        'access_denied',
        'The user denied the request',
        pending.request.state,
      ),
    });
  }

  return await approveAndIssue(pending.request);
}

/**
 * Καταγράφει τη συγκατάθεση και εκδίδει code.
 *
 * ⚠️ Η ταυτότητα έρχεται από το **παγωμένο** αίτημα, όχι από το τρέχον
 * `AuthContext`. Είναι το ίδιο πρόσωπο (το `consumePendingRequest` το
 * επιβεβαίωσε), αλλά τα `companyId`/`globalRole` πρέπει να είναι αυτά που
 * ίσχυαν όταν παρουσιάστηκε η οθόνη — αλλιώς ο χρήστης θα ενέκρινε ένα κείμενο
 * και θα υπέγραφε ένα άλλο.
 */
async function approveAndIssue(pending: PendingAuthorizeRequest): Promise<NextResponse> {
  const consentId = await recordConsent({
    uid: pending.uid,
    companyId: pending.companyId,
    clientId: pending.clientId,
    clientName: pending.clientName,
    scopes: pending.scopes,
    audience: pending.resource,
  });

  const code = await issueAuthorizationCode({
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    scopes: pending.scopes,
    uid: pending.uid,
    companyId: pending.companyId,
    globalRole: pending.globalRole,
    audience: pending.resource,
    consentId,
  });

  return NextResponse.json({
    redirectTo: buildCodeRedirect(pending.redirectUri, code, pending.state),
  });
}

export const GET = withSensitiveRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
