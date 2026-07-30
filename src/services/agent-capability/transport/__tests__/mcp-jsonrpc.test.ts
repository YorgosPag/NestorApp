/**
 * Tests — ανάλυση JSON-RPC 2.0 (ADR-734 Φάση 3β)
 */

import {
  JSON_RPC_ERROR,
  jsonRpcError,
  jsonRpcSuccess,
  parseJsonRpcMessage,
} from '../mcp-jsonrpc';

describe('parseJsonRpcMessage — αιτήματα', () => {
  it('αναγνωρίζει αίτημα με id', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(parsed.kind).toBe('request');
    if (parsed.kind === 'request') {
      expect(parsed.request.id).toBe(1);
      expect(parsed.request.method).toBe('tools/list');
    }
  });

  it('δέχεται id τύπου string', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', id: 'abc', method: 'ping' });
    expect(parsed.kind).toBe('request');
  });

  it('κρατά τα params όταν είναι αντικείμενο', () => {
    const parsed = parseJsonRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'boq_get_item' },
    });
    if (parsed.kind === 'request') {
      expect(parsed.request.params).toEqual({ name: 'boq_get_item' });
    }
  });

  it('αγνοεί params που δεν είναι αντικείμενο', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'ping', params: [1, 2] });
    if (parsed.kind === 'request') expect(parsed.request.params).toBeUndefined();
  });
});

describe('parseJsonRpcMessage — ειδοποιήσεις και αποκρίσεις', () => {
  it('μήνυμα χωρίς id είναι ειδοποίηση', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(parsed.kind).toBe('notification');
  });

  it('id: null είναι ειδοποίηση', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', id: null, method: 'x' });
    expect(parsed.kind).toBe('notification');
  });

  it('μήνυμα με result είναι ΑΠΟΚΡΙΣΗ του client, όχι κλήση μεθόδου', () => {
    // Χωρίς αυτή τη διάκριση θα απαντούσαμε METHOD_NOT_FOUND σε κάτι που δεν
    // ήταν ποτέ κλήση — ο client θα έβλεπε σφάλμα ενώ ακολούθησε το πρωτόκολλο.
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, result: {} }).kind).toBe('acknowledgeable');
  });

  it('μήνυμα με error είναι επίσης απόκριση', () => {
    expect(
      parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'x' } }).kind,
    ).toBe('acknowledgeable');
  });
});

describe('parseJsonRpcMessage — άκυρα', () => {
  it.each([
    [null, 'null'],
    ['string', 'σκέτο string'],
    [[{ jsonrpc: '2.0' }], 'πίνακας'],
    [42, 'αριθμός'],
  ])('απορρίπτει %s (%s)', (body) => {
    const parsed = parseJsonRpcMessage(body);
    expect(parsed.kind).toBe('invalid');
    if (parsed.kind === 'invalid') {
      expect(parsed.error.code).toBe(JSON_RPC_ERROR.INVALID_REQUEST);
    }
  });

  it('απορρίπτει λάθος έκδοση jsonrpc', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '1.0', id: 1, method: 'x' });
    expect(parsed.kind).toBe('invalid');
    if (parsed.kind === 'invalid') expect(parsed.id).toBe(1);
  });

  it('απορρίπτει method που δεν είναι μη-κενό string', () => {
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: '' }).kind).toBe('invalid');
    expect(parseJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 5 }).kind).toBe('invalid');
  });

  it('απορρίπτει id που είναι αντικείμενο', () => {
    const parsed = parseJsonRpcMessage({ jsonrpc: '2.0', id: {}, method: 'x' });
    expect(parsed.kind).toBe('invalid');
    if (parsed.kind === 'invalid') expect(parsed.id).toBeNull();
  });
});

describe('κατασκευή αποκρίσεων', () => {
  it('επιτυχία', () => {
    expect(jsonRpcSuccess(7, { ok: true })).toEqual({ jsonrpc: '2.0', id: 7, result: { ok: true } });
  });

  it('σφάλμα χωρίς data παραλείπει το πεδίο', () => {
    expect(jsonRpcError(7, -32601, 'nope')).toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: { code: -32601, message: 'nope' },
    });
  });

  it('σφάλμα με data το περιλαμβάνει', () => {
    expect(jsonRpcError(null, -32700, 'bad', { hint: 'x' })).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'bad', data: { hint: 'x' } },
    });
  });
});
