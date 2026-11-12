/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.3 · §5.8 #1 — ο ΕΝΑΣ ορισμός της διάγνωσης ενός επαληθευμένου συμβάντος (webhook route · return
 * route · ίχνος παραλαβής): είδος σήματος, λόγος, ονόματα υπογεγραμμένων πεδίων, **μορφή υπογραφής** — ποτέ τιμές.
 */

import { webhookSignalDiagnostics } from '../payment-provider';

describe('webhookSignalDiagnostics', () => {
  it('κάθε διάγνωση φέρει τη μορφή υπογραφής που ταίριαξε', () => {
    expect(webhookSignalDiagnostics({
      valid: true, signatureScheme: 'iris-hash-base64',
      signal: { kind: 'authorized-source', checkoutId: 'pchk_1', sourceToken: 'src_SECRET' },
    })).toEqual({ signal: 'authorized-source', reason: null, signedFields: null, signatureScheme: 'iris-hash-base64' });
  });

  it('ignored ⇒ ο λόγος', () => {
    expect(webhookSignalDiagnostics({
      valid: true, signatureScheme: 'webhook-header', signal: { kind: 'ignored', reason: 'unrecognised-event' },
    })).toMatchObject({ reason: 'unrecognised-event', signatureScheme: 'webhook-header' });
  });

  it('αποτυχία χωρίς υπογεγραμμένη συνεδρία ⇒ κωδικός + ΟΝΟΜΑΤΑ πεδίων· με συνεδρία ⇒ χωρίς ονόματα', () => {
    const failed = (checkoutId: string | null) => webhookSignalDiagnostics({
      valid: true, signatureScheme: 'iris-hash-hex',
      signal: { kind: 'authorization-failed', checkoutId, providerCode: '104000', signedFields: ['error_code', 'md'] },
    });
    expect(failed(null)).toMatchObject({ reason: 'provider-code:104000', signedFields: 'error_code,md' });
    expect(failed('pchk_1')).toMatchObject({ reason: 'provider-code:104000', signedFields: null });
  });

  it('καμία τιμή payload (token πηγής) δεν περνά στη διάγνωση', () => {
    const diagnostics = webhookSignalDiagnostics({
      valid: true, signatureScheme: 'iris-hash-hex',
      signal: { kind: 'authorized-source', checkoutId: 'pchk_1', sourceToken: 'src_SECRET' },
    });
    expect(JSON.stringify(diagnostics)).not.toContain('src_SECRET');
  });
});
