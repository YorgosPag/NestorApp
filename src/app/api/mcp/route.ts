/**
 * MCP Streamable HTTP endpoint (ADR-734 Φάση 3β)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΥΝΟΡΟ — ΚΑΙ ΤΙ ΔΕΝ ΓΙΝΕΤΑΙ ΕΔΩ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αυτό το αρχείο είναι **μεταφορέας**. Δεν μεταφράζει μορφές (το κάνει ο
 * `mcp-adapter`), δεν επιβάλλει πολιτική (το κάνει το `registry.invoke()`), δεν
 * αποφασίζει ταυτότητα (το κάνει ο `mcp-identity`). Κάθε γραμμή λογικής που θα
 * προστεθεί εδώ γίνεται **δεύτερο** σημείο επιβολής — και το δεύτερο σαπίζει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️⚠️ `companyId`: ΜΟΝΟ ΑΠΟ ΤΟ TOKEN
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `CapabilityContext` χτίζεται **αποκλειστικά** από το επικυρωμένο
 * διαπιστευτήριο. Ούτε ένα πεδίο του δεν διαβάζεται από το σώμα JSON-RPC. Αν
 * ποτέ το endpoint δεχόταν `companyId` από τα ορίσματα εργαλείου, ο πράκτορας
 * θα διάλεγε **πελάτη** — το χειρότερο κενό που περιγράφει το ADR-734 §7.1. Το
 * registry ρίχνει κατά τη φόρτωση αν κάποια δυνατότητα δηλώσει τέτοια
 * παράμετρο· εδώ κλείνει ο κύκλος από την άλλη πλευρά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ `application/json` ΚΑΙ ΟΧΙ `text/event-stream`
 * ─────────────────────────────────────────────────────────────────────────────
 * Το πρότυπο επιτρέπει και τα δύο για `POST` με αίτημα JSON-RPC. Τα επτά
 * εργαλεία είναι σύντομα request/response χωρίς ενδιάμεση πρόοδο· ένα SSE
 * κανάλι θα πρόσθετε διαχείριση ροής και επανασύνδεσης για μηδέν πληροφορία.
 * Ο `GET` απαντά **405**, που το πρότυπο επιτρέπει ρητά όταν ο server δεν
 * προσφέρει stream — αλλά η μέθοδος **υποστηρίζεται** στο ίδιο path, όπως
 * απαιτείται.
 *
 * **Stateless**: κανένα `MCP-Session-Id`. Το Next.js δεν εγγυάται συνέχεια
 * διεργασίας μεταξύ αιτημάτων, οπότε μια συνεδρία θα ήταν υπόσχεση που δεν
 * μπορούμε να κρατήσουμε (ADR-734 §10.2).
 *
 * @module app/api/mcp
 * @see ADR-734 §8.4, ADR-738
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getPublicBaseUrl } from '@/lib/oauth/oauth-config';
import { boqAdminCapabilityRegistry } from '@/services/agent-capability/capabilities/boq/boq-admin-registry';
import { checkTransportHeaders } from '@/services/agent-capability/transport/mcp-http-guards';
import { resolveMcpIdentity } from '@/services/agent-capability/transport/mcp-identity';
import { dispatchMcpRequest } from '@/services/agent-capability/transport/mcp-method-dispatch';
import {
  JSON_RPC_ERROR,
  jsonRpcError,
  parseJsonRpcMessage,
  type JsonRpcRequest,
} from '@/services/agent-capability/transport/mcp-jsonrpc';
import type { CapabilityContext } from '@/services/agent-capability/registry';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('mcp-transport');

/** Τα origins που δεχόμαστε όταν το αίτημα *έχει* `Origin` (δηλαδή: browser). */
function allowedOrigins(): readonly string[] {
  return [getPublicBaseUrl()];
}

// ============================================================================
// POST — η μοναδική παραγωγική διαδρομή
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const guard = checkTransportHeaders(request.headers, allowedOrigins());
  if (!guard.ok) {
    return guard.failure.kind === 'origin_forbidden'
      ? NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
      : NextResponse.json(
          { error: 'Unsupported MCP-Protocol-Version', received: guard.failure.received },
          { status: 400 },
        );
  }

  const identity = await resolveMcpIdentity(request);
  if (!identity.ok) {
    return new NextResponse(null, {
      status: identity.failure.status,
      headers: { 'www-authenticate': identity.failure.challenge },
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      jsonRpcError(null, JSON_RPC_ERROR.PARSE_ERROR, 'Invalid JSON'),
      { status: 400 },
    );
  }

  const message = parseJsonRpcMessage(rawBody);

  // Ειδοποίηση ή απόκριση του client ⇒ 202 **χωρίς σώμα**, κατά το πρότυπο.
  if (message.kind === 'notification' || message.kind === 'acknowledgeable') {
    return new NextResponse(null, { status: 202 });
  }

  if (message.kind === 'invalid') {
    return NextResponse.json(
      jsonRpcError(message.id, message.error.code, message.error.message),
      { status: 400 },
    );
  }

  return await respondToRequest(message.request, identity.context, guard.protocolVersion);
}

/**
 * Εκτελεί το αίτημα και επιστρέφει **πάντα** HTTP 200 όταν το JSON-RPC ήταν
 * καλοσχηματισμένο.
 *
 * ⚠️ Ακόμη και σε JSON-RPC `error`: το επίπεδο μεταφοράς πέτυχε — το μήνυμα
 * παραδόθηκε και απαντήθηκε. Ένα HTTP 500 εδώ θα έκανε τους clients να κάνουν
 * retry μια κλήση που **δεν** πρόκειται να πετύχει με επανάληψη.
 */
async function respondToRequest(
  request: JsonRpcRequest,
  context: CapabilityContext,
  protocolVersion: string,
): Promise<NextResponse> {
  try {
    const response = await dispatchMcpRequest(request, {
      registry: boqAdminCapabilityRegistry,
      context,
      negotiatedProtocolVersion: protocolVersion,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Το `registry.invoke()` πιάνει ήδη κάθε εξαίρεση handler και τη μετατρέπει
    // σε `INTERNAL`. Αν φτάσει κάτι εδώ, είναι αστοχία του ίδιου του transport.
    logger.error('[MCP] Unhandled transport failure', {
      method: request.method,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      jsonRpcError(request.id, JSON_RPC_ERROR.INTERNAL_ERROR, 'Internal transport error'),
      { status: 200 },
    );
  }
}

// ============================================================================
// GET — υποστηρίζεται, δεν προσφέρει stream
// ============================================================================

/**
 * `405 Method Not Allowed` με `Allow: POST`.
 *
 * Το πρότυπο απαιτεί ο **ίδιος** endpoint να δέχεται `GET`· επιτρέπει όμως
 * ρητά την απάντηση 405 όταν ο server δεν προσφέρει `text/event-stream`. Το να
 * μην οριζόταν καθόλου `GET` θα έδινε 405 από το framework — με **διαφορετικό**
 * μήνυμα και χωρίς τον έλεγχο `Origin`, δηλαδή τυχαία σωστό αντί για σχεδιασμένα
 * σωστό.
 */
async function handleGet(request: NextRequest): Promise<NextResponse> {
  const guard = checkTransportHeaders(request.headers, allowedOrigins());
  if (!guard.ok && guard.failure.kind === 'origin_forbidden') {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return NextResponse.json(
    { error: 'SSE stream not offered; use POST with JSON-RPC' },
    { status: 405, headers: { allow: 'POST' } },
  );
}

export const POST = withStandardRateLimit(handlePost);
export const GET = withStandardRateLimit(handleGet);
