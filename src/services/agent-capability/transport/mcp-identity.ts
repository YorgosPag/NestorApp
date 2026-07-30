/**
 * Ταυτότητα στο σύνορο MCP — από Bearer token σε `CapabilityContext`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΜΠΗΚΕ ΜΕΣΑ ΣΤΟ `buildRequestContext()`
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο προφανής δρόμος θα ήταν να μάθει το κεντρικό `buildRequestContext()` να
 * δέχεται και OAuth tokens — ένα σημείο, όλα τα routes. **Θα ήταν σοβαρό
 * σφάλμα.** Κάθε route του `src/app/api/` περνά από εκεί· ένα token που ο
 * χρήστης ενέκρινε για `boq:read` θα γινόταν αυτομάτως δεκτό και στο
 * `/api/admin/*`. Αυτό είναι ακριβώς η παραβίαση που το πρότυπο ονομάζει
 * θεμελιώδη:
 *
 * > «When an MCP server doesn't verify that tokens were specifically intended
 * >  for it… it may accept tokens originally issued for other services. This
 * >  breaks a fundamental OAuth security boundary.»
 *
 * Άρα η ανάλυση OAuth ζει **εδώ**, στο ένα path που έχει ακροατήριο. Το
 * `buildRequestContext()` μένει ανέγγιχτο: μηδενική επιφάνεια επίδρασης στα
 * υπόλοιπα ~200 routes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΕΙΔΗ ΔΙΑΠΙΣΤΕΥΤΗΡΙΩΝ, ΜΙΑ ΕΞΟΔΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * - **OAuth access token** — εξωτερικοί πράκτορες (Claude Desktop, Cursor).
 *   Ελέγχεται ακροατήριο **και** scope.
 * - **Firebase ID token** — δικοί μας καταναλωτές (curl, δικό μας UI). Δεν
 *   περνά από consent γιατί δεν υπάρχει τρίτος: ο χρήστης μιλά στον εαυτό του.
 *
 * ⚠️ Το fallback καλείται **μόνο όταν υπάρχει Bearer token**. Το
 * `buildRequestContext()` έχει σκόπιμο bypass σε `NODE_ENV=development` όταν
 * **δεν** βρει διαπιστευτήρια· καλώντας το χωρίς token, το MCP endpoint θα ήταν
 * τοπικά ορθάνοιχτο και τα tests θα περνούσαν πράσινα χωρίς να ελέγξουν τίποτα.
 *
 * @module services/agent-capability/transport/mcp-identity
 * @see ADR-734 §7.1, ADR-738 §7
 */

import 'server-only';

import type { NextRequest } from 'next/server';

import { buildRequestContext } from '@/lib/auth/auth-context';
import { isAuthenticated } from '@/lib/auth/types';
import { generateRequestId } from '@/services/enterprise-id.service';
import {
  getMcpResourceUri,
  getPublicBaseUrl,
  MCP_REQUIRED_SCOPE,
  OAUTH_PATHS,
  type OAuthScope,
} from '@/lib/oauth/oauth-config';
import { lookupToken } from '@/lib/oauth/oauth-token-store';
import type { CapabilityContext } from '../registry';

// ============================================================================
// ΡΟΛΟΙ
// ============================================================================

/**
 * Οι καθολικοί ρόλοι που το capability layer θεωρεί διαχειριστικούς.
 *
 * ⚠️ **Μην** χρησιμοποιηθεί εδώ το `isAdminRole()` του `security-policy.ts`.
 * Είναι όνομα που παραπλανά: η λίστα του είναι `['admin','broker','builder']`
 * — **άλλο λεξιλόγιο**, από παλαιότερο σύστημα ρόλων. Τα `GLOBAL_ROLES` των
 * Firebase claims είναι `super_admin` / `company_admin` / … Ένα
 * `isAdminRole('company_admin')` επιστρέφει `false`, δηλαδή θα έκλεινε σιωπηλά
 * την πρόσβαση σε **κάθε** διαχειριστή εταιρείας, και το σφάλμα θα έμοιαζε με
 * «λάθος δικαιώματα» αντί για «λάθος λίστα».
 */
const ADMIN_GLOBAL_ROLES: readonly string[] = ['super_admin', 'company_admin'];

function isAdminGlobalRole(globalRole: string): boolean {
  return ADMIN_GLOBAL_ROLES.includes(globalRole);
}

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑΤΑ
// ============================================================================

export type IdentityFailureKind = 'unauthenticated' | 'insufficient_scope';

export interface IdentityFailure {
  readonly kind: IdentityFailureKind;
  readonly status: 401 | 403;
  /** Έτοιμη τιμή για τον header `WWW-Authenticate`. */
  readonly challenge: string;
}

export type McpIdentity =
  | { readonly ok: true; readonly context: CapabilityContext; readonly scopes: readonly OAuthScope[] }
  | { readonly ok: false; readonly failure: IdentityFailure };

// ============================================================================
// CHALLENGES
// ============================================================================

function resourceMetadataUrl(): string {
  return `${getPublicBaseUrl()}${OAUTH_PATHS.WELL_KNOWN_PRM}`;
}

/**
 * `401` challenge — RFC 9728 §5.1.
 *
 * Το `resource_metadata` είναι ο **μοναδικός** τρόπος που ένας client μαθαίνει
 * πού να ζητήσει token. Το `scope` προστίθεται κατά SHOULD του προτύπου, ώστε
 * ο client να ζητήσει το ελάχιστο αντί για ό,τι υπάρχει.
 */
export function buildUnauthenticatedChallenge(): string {
  return `Bearer resource_metadata="${resourceMetadataUrl()}", scope="${MCP_REQUIRED_SCOPE}"`;
}

/** `403` challenge για ανεπαρκές scope — RFC 6750 §3.1 + βήμα step-up. */
export function buildInsufficientScopeChallenge(): string {
  return (
    `Bearer error="insufficient_scope", scope="${MCP_REQUIRED_SCOPE}", ` +
    `resource_metadata="${resourceMetadataUrl()}"`
  );
}

function unauthenticated(): McpIdentity {
  return {
    ok: false,
    failure: { kind: 'unauthenticated', status: 401, challenge: buildUnauthenticatedChallenge() },
  };
}

function insufficientScope(): McpIdentity {
  return {
    ok: false,
    failure: { kind: 'insufficient_scope', status: 403, challenge: buildInsufficientScopeChallenge() },
  };
}

// ============================================================================
// ΕΞΑΓΩΓΗ TOKEN
// ============================================================================

export function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1] === '' ? null : parts[1];
}

// ============================================================================
// ΑΝΑΛΥΣΗ
// ============================================================================

/**
 * Bearer token → `CapabilityContext`.
 *
 * Σειρά: OAuth πρώτα (είναι η κανονική διαδρομή για εξωτερικούς πράκτορες),
 * Firebase δεύτερο. Ένα OAuth token που απορρίφθηκε για **ακροατήριο** ή
 * **ανάκληση** δεν πέφτει σε fallback — θα ήταν σαν να λέμε «δεν είσαι δεκτός
 * ως πράκτορας, ας δούμε μήπως περνάς ως χρήστης», δηλαδή παράκαμψη του ίδιου
 * ελέγχου που μόλις απέτυχε. Μόνο το `not_found` (δηλαδή «δεν είναι καν δικό
 * μας OAuth token») συνεχίζει προς Firebase.
 */
export async function resolveMcpIdentity(request: NextRequest): Promise<McpIdentity> {
  const token = extractBearerToken(request);
  if (token === null) return unauthenticated();

  const audience = getMcpResourceUri();
  const lookup = await lookupToken(token, 'access', audience);

  if (lookup.ok) {
    const { record } = lookup;
    if (!record.scopes.includes(MCP_REQUIRED_SCOPE)) return insufficientScope();

    return {
      ok: true,
      scopes: record.scopes,
      context: {
        companyId: record.companyId,
        isAdmin: isAdminGlobalRole(record.globalRole),
        requestId: generateRequestId(),
      },
    };
  }

  if (lookup.rejection !== 'not_found') return unauthenticated();

  return resolveFirebaseIdentity(request);
}

/**
 * Διαδρομή για **δικούς μας** καταναλωτές (Firebase ID token / session cookie).
 *
 * Δεν εμπλέκεται scope: ο χρήστης δεν εξουσιοδοτεί τρίτον, μιλά ο ίδιος. Το
 * scope είναι έννοια *ανάθεσης*· χωρίς ανάθεση δεν έχει τι να περιορίσει.
 */
async function resolveFirebaseIdentity(request: NextRequest): Promise<McpIdentity> {
  const ctx = await buildRequestContext(request);
  if (!isAuthenticated(ctx)) return unauthenticated();

  return {
    ok: true,
    scopes: [MCP_REQUIRED_SCOPE],
    context: {
      companyId: ctx.companyId,
      isAdmin: isAdminGlobalRole(ctx.globalRole),
      requestId: generateRequestId(),
    },
  };
}
