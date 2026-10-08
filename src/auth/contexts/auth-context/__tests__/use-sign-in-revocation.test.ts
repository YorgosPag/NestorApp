/**
 * @fileoverview ADR-894 §10.7 — «ανακλήθηκε ΑΥΤΗ η συσκευή;»: δύο σήματα, ένας χειριστής.
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Υ1 🔴 | το **δικό μου** `auth_time` στο claim του token ⇒ αποσύνδεση (η συσκευή που γύρισε από εκτός δικτύου) |
 * | Υ2 | ανακλήθηκε **άλλη** σύνδεση του λογαριασμού ⇒ τίποτα |
 * | Υ3 | η εγγραφή της συνεδρίας έγινε `revoked` ⇒ αποσύνδεση (το σήμα που μεταφέρθηκε από το `AuthContext`) |
 */

import { renderHook } from '@testing-library/react';

type TokenListener = (user: { uid: string; getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }> } | null) => void;

let tokenListener: TokenListener | null = null;
jest.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, listener: TokenListener) => {
    tokenListener = listener;
    return () => { tokenListener = null; };
  },
}));
jest.mock('@/lib/firebase', () => ({ auth: {} }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

let sessionRevoked: (() => void) | null = null;
jest.mock('@/services/session', () => ({
  EnterpriseSessionService: {
    watchSessionRevocation: (_uid: string, _sessionId: string, onRevoked: () => void) => {
      sessionRevoked = onRevoked;
      return () => { sessionRevoked = null; };
    },
  },
}));

import { useSignInRevocation } from '../use-sign-in-revocation';

const UID = 'u-device';
const SIGN_IN = 1_790_000_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function emitToken(claims: Record<string, unknown>): void {
  tokenListener?.({ uid: UID, getIdTokenResult: async () => ({ claims }) });
}

describe('useSignInRevocation', () => {
  const signOut = jest.fn(async (_request: unknown) => undefined);

  beforeEach(() => {
    signOut.mockClear();
    renderHook(() => useSignInRevocation({ uid: UID, activeSessionId: 'sess_1', signOut }));
  });

  it('Υ1 🔴 το ΔΙΚΟ μου auth_time στη λίστα του token ⇒ αποσύνδεση', async () => {
    emitToken({ auth_time: SIGN_IN, revokedSignIns: [SIGN_IN] });
    await flush();
    expect(signOut).toHaveBeenCalledTimes(1);
    // ADR-908 — `revoked` ⇒ ο κάτοχος στέλνει στη σύνδεση ΜΕ επιστροφή (γυρνά ο ίδιος άνθρωπος).
    expect(signOut).toHaveBeenCalledWith({ reason: 'revoked' });
  });

  it('Υ2 — ανακλήθηκε ΑΛΛΗ σύνδεση του λογαριασμού ⇒ αυτή μένει', async () => {
    emitToken({ auth_time: SIGN_IN, revokedSignIns: [SIGN_IN + 1] });
    await flush();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('Υ3 — η εγγραφή της συνεδρίας ανακλήθηκε ⇒ αποσύνδεση', () => {
    sessionRevoked?.();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
