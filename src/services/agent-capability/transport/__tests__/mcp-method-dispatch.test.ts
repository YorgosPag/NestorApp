/**
 * Tests — δρομολόγηση μεθόδων MCP (ADR-734 Φάση 3β)
 *
 * Ο dispatcher δοκιμάζεται με **ψεύτικο registry**: το ζητούμενο εδώ δεν είναι
 * αν τα εργαλεία BOQ δουλεύουν (αυτό το καλύπτουν τα suites της Φάσης 2) αλλά
 * αν το σύνορο μεταφράζει σωστά — ειδικά στη διάκριση «αστοχία εργαλείου» vs
 * «αστοχία πρωτοκόλλου».
 */

import type { AnyCapability, CapabilityContext, CapabilityRegistry } from '../../registry';
import { JSON_RPC_ERROR } from '../mcp-jsonrpc';
import { dispatchMcpRequest, MCP_SERVER_INFO } from '../mcp-method-dispatch';
import { MCP_PROTOCOL_VERSION } from '../../adapters/mcp-protocol-types';

const CONTEXT: CapabilityContext = {
  companyId: 'comp_test',
  isAdmin: true,
  requestId: 'req_test',
};

const FAKE_CAPABILITY = {
  name: 'boq_fake_tool',
  title: 'Fake',
  description: 'A fake capability',
  domain: 'boq',
  params: {},
  valueSchema: { type: 'object' },
  policy: { access: 'read', requiresAdmin: true },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: jest.fn(),
} as unknown as AnyCapability;

function makeRegistry(invoke: CapabilityRegistry['invoke']): CapabilityRegistry {
  return {
    list: () => [FAKE_CAPABILITY],
    get: (name) => (name === FAKE_CAPABILITY.name ? FAKE_CAPABILITY : undefined),
    invoke,
  };
}

function deps(invoke: CapabilityRegistry['invoke']) {
  return {
    registry: makeRegistry(invoke),
    context: CONTEXT,
    negotiatedProtocolVersion: MCP_PROTOCOL_VERSION,
  };
}

const NEVER_CALLED: CapabilityRegistry['invoke'] = () => {
  throw new Error('registry.invoke should not have been called');
};

describe('initialize', () => {
  it('ανακοινώνει έκδοση, δυνατότητες, ταυτότητα και οδηγίες', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      deps(NEVER_CALLED),
    );

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
      },
    });
    expect('result' in response && (response.result as { instructions: string }).instructions)
      .toContain('Verifiable Quantity Envelope');
  });
});

describe('tools/list', () => {
  it('επιστρέφει τα εργαλεία του registry', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      deps(NEVER_CALLED),
    );

    expect('result' in response).toBe(true);
    const result = (response as { result: { tools: unknown[]; nextCursor?: string } }).result;
    expect(result.tools).toHaveLength(1);
    // Απουσία `nextCursor` σημαίνει «τέλος»· ένα `nextCursor: ""` είναι έγκυρος
    // δείκτης και θα έβαζε τον client σε βρόχο.
    expect(result.nextCursor).toBeUndefined();
  });
});

describe('tools/call', () => {
  it('επιτυχία ⇒ structuredContent με τον φάκελο', async () => {
    const envelope = { value: 42, provenance: { sourceItemIds: [], warnings: [] } };
    const invoke = jest.fn().mockResolvedValue({ ok: true, envelope: {
      ...envelope,
      governance: { effectiveStatus: 'draft', isSignable: false },
      integrity: { engineVersion: '1.0.0' },
    } });

    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'boq_fake_tool', arguments: { a: 1 } } },
      deps(invoke),
    );

    expect(invoke).toHaveBeenCalledWith('boq_fake_tool', { a: 1 }, CONTEXT);
    const result = (response as { result: { structuredContent?: unknown; isError?: boolean } }).result;
    expect(result.structuredContent).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('ΑΣΤΟΧΙΑ ΕΡΓΑΛΕΙΟΥ ⇒ επιτυχής JSON-RPC με isError, ΟΧΙ σφάλμα πρωτοκόλλου', async () => {
    // Με `isError` το μοντέλο ΒΛΕΠΕΙ το μήνυμα και διορθώνει την κλήση· με
    // JSON-RPC error το χειρίζεται ο client και το μοντέλο δεν μαθαίνει ποτέ.
    const invoke = jest.fn().mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'no such building' },
    });

    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'boq_fake_tool' } },
      deps(invoke),
    );

    expect('error' in response).toBe(false);
    const result = (response as { result: { isError?: boolean; structuredContent?: unknown } }).result;
    expect(result.isError).toBe(true);
    // Φάκελος που δεν χτίστηκε δεν επιτρέπεται να μοιάζει υπαρκτός.
    expect(result.structuredContent).toBeUndefined();
  });

  it('χωρίς arguments καλεί με κενό αντικείμενο', async () => {
    const invoke = jest.fn().mockResolvedValue({ ok: false, error: { code: 'X', message: 'y' } });
    await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'boq_fake_tool' } },
      deps(invoke),
    );
    expect(invoke).toHaveBeenCalledWith('boq_fake_tool', {}, CONTEXT);
  });

  it('params χωρίς name ⇒ INVALID_PARAMS, χωρίς κλήση registry', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: {} },
      deps(NEVER_CALLED),
    );
    expect(response).toMatchObject({ error: { code: JSON_RPC_ERROR.INVALID_PARAMS } });
  });

  it('arguments που είναι πίνακας ⇒ INVALID_PARAMS', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'x', arguments: [1] } },
      deps(NEVER_CALLED),
    );
    expect(response).toMatchObject({ error: { code: JSON_RPC_ERROR.INVALID_PARAMS } });
  });

  it('το context ΔΕΝ διαβάζεται ποτέ από τα params', async () => {
    // Αν ο πράκτορας μπορούσε να περάσει companyId, θα διάλεγε ΠΕΛΑΤΗ.
    const invoke = jest.fn().mockResolvedValue({ ok: false, error: { code: 'X', message: 'y' } });
    await dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'boq_fake_tool', arguments: { companyId: 'comp_ALLOY' } },
      },
      deps(invoke),
    );

    const [, , passedContext] = invoke.mock.calls[0];
    expect(passedContext).toEqual(CONTEXT);
    expect(passedContext.companyId).toBe('comp_test');
  });
});

describe('λοιπές μέθοδοι', () => {
  it('ping επιστρέφει κενό αποτέλεσμα', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 9, method: 'ping' },
      deps(NEVER_CALLED),
    );
    expect(response).toEqual({ jsonrpc: '2.0', id: 9, result: {} });
  });

  it('άγνωστη μέθοδος ⇒ METHOD_NOT_FOUND', async () => {
    const response = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 10, method: 'resources/list' },
      deps(NEVER_CALLED),
    );
    expect(response).toMatchObject({ error: { code: JSON_RPC_ERROR.METHOD_NOT_FOUND } });
  });
});
