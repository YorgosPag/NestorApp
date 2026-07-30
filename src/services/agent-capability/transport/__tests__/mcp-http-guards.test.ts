/**
 * Tests — φύλακες HTTP του MCP transport (ADR-734 Φάση 3β)
 *
 * Καθαρές συναρτήσεις: κάθε κανονιστική απαίτηση του §transports ελέγχεται
 * χωρίς mocks και χωρίς δίκτυο.
 */

import {
  ASSUMED_PROTOCOL_VERSION,
  checkTransportHeaders,
  isAcceptableOrigin,
  resolveProtocolVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '../mcp-http-guards';
import { MCP_PROTOCOL_VERSION } from '../../adapters/mcp-protocol-types';

const ALLOWED = ['https://nestorconstruct.gr'];

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('isAcceptableOrigin', () => {
  it('δέχεται την ΑΠΟΥΣΙΑ Origin (μη-browser client)', () => {
    // Ο Claude Desktop, ο Cursor και το curl ΔΕΝ στέλνουν Origin. Ένας έλεγχος
    // «πρέπει να υπάρχει» θα απέκλειε ακριβώς τους clients για τους οποίους
    // γράφτηκε το endpoint — ενώ το DNS rebinding είναι επίθεση μόνο μέσω
    // browser.
    expect(isAcceptableOrigin(null, ALLOWED)).toBe(true);
    expect(isAcceptableOrigin('', ALLOWED)).toBe(true);
  });

  it('δέχεται το δικό μας origin', () => {
    expect(isAcceptableOrigin('https://nestorconstruct.gr', ALLOWED)).toBe(true);
  });

  it('απορρίπτει ξένο origin', () => {
    expect(isAcceptableOrigin('https://evil.example', ALLOWED)).toBe(false);
  });

  it('ΔΕΝ κάνει prefix matching (κλασική τρύπα)', () => {
    // `https://nestorconstruct.gr.evil.example` ξεκινά με το νόμιμο origin.
    expect(isAcceptableOrigin('https://nestorconstruct.gr.evil.example', ALLOWED)).toBe(false);
  });
});

describe('resolveProtocolVersion', () => {
  it('απουσία header ⇒ υπονοούμενη 2025-03-26, ΟΧΙ σφάλμα', () => {
    // SHOULD του προτύπου: «If the header is absent the server SHOULD assume
    // 2025-03-26».
    expect(resolveProtocolVersion(null)).toEqual({ ok: true, version: ASSUMED_PROTOCOL_VERSION });
  });

  it('δέχεται τη δηλωμένη μας έκδοση', () => {
    expect(resolveProtocolVersion(MCP_PROTOCOL_VERSION)).toEqual({
      ok: true,
      version: MCP_PROTOCOL_VERSION,
    });
  });

  it('δέχεται κάθε έκδοση της λίστας', () => {
    SUPPORTED_PROTOCOL_VERSIONS.forEach((version) => {
      expect(resolveProtocolVersion(version)).toEqual({ ok: true, version });
    });
  });

  it('απορρίπτει άγνωστη έκδοση', () => {
    expect(resolveProtocolVersion('1999-01-01')).toEqual({ ok: false, received: '1999-01-01' });
  });
});

describe('checkTransportHeaders', () => {
  it('περνά καθαρό αίτημα χωρίς Origin', () => {
    const result = checkTransportHeaders(
      headersWith({ 'mcp-protocol-version': MCP_PROTOCOL_VERSION }),
      ALLOWED,
    );
    expect(result).toEqual({ ok: true, protocolVersion: MCP_PROTOCOL_VERSION });
  });

  it('Origin εκτός λίστας ⇒ 403', () => {
    const result = checkTransportHeaders(headersWith({ origin: 'https://evil.example' }), ALLOWED);
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'origin_forbidden', status: 403 },
    });
  });

  it('άγνωστη έκδοση ⇒ 400', () => {
    const result = checkTransportHeaders(
      headersWith({ 'mcp-protocol-version': '1999-01-01' }),
      ALLOWED,
    );
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'unsupported_protocol_version', status: 400, received: '1999-01-01' },
    });
  });

  it('ο έλεγχος Origin ΠΡΟΗΓΕΙΤΑΙ του ελέγχου έκδοσης', () => {
    // Απαντώντας πρώτα 400 σε αίτημα από κακόβουλη σελίδα θα επιβεβαιώναμε την
    // ύπαρξη του endpoint και θα δίναμε πληροφορία για τις εκδόσεις μας.
    const result = checkTransportHeaders(
      headersWith({ origin: 'https://evil.example', 'mcp-protocol-version': '1999-01-01' }),
      ALLOWED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe('origin_forbidden');
  });
});
