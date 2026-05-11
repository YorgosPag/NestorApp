/**
 * ADR-344 Phase 4 — Firebase ID-token verification for the Yjs sync server.
 *
 * Every incoming WebSocket connection includes a `?token=<firebase-id-token>`
 * URL parameter. This module verifies the token, decodes the custom claims
 * (companyId, role), and rejects connections whose claim does not match the
 * room id's company prefix (tenant isolation per ADR-326).
 *
 * Tokens expire every hour; the client re-fetches and reconnects (see
 * y-websocket-client.ts on the browser side).
 *
 * @module scripts/y-websocket-server/auth
 */

const admin = require('firebase-admin');

let initialized = false;

function ensureAdmin() {
  if (initialized) return;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  initialized = true;
}

/**
 * Verify the token attached to a WebSocket upgrade request.
 *
 * Returns the decoded token on success; throws with a 4xxx WS close code on
 * failure (4001 = unauthorised, 4003 = forbidden, 4004 = bad request).
 *
 * @param {string} token
 * @param {string} roomId  e.g. "acme:drawing_42:mtxt_001"
 * @returns {Promise<{uid:string, companyId:string, role:string}>}
 */
async function verifyConnection(token, roomId) {
  ensureAdmin();

  if (!token) {
    const err = new Error('missing token');
    err.code = 4001;
    throw err;
  }
  if (!roomId || !roomId.includes(':')) {
    const err = new Error('invalid room id');
    err.code = 4004;
    throw err;
  }

  const decoded = await admin.auth().verifyIdToken(token, /* checkRevoked */ true);
  const tokenCompanyId = decoded.companyId;
  const [roomCompanyId] = roomId.split(':');

  if (!tokenCompanyId || tokenCompanyId !== roomCompanyId) {
    const err = new Error(`tenant mismatch: token=${tokenCompanyId} room=${roomCompanyId}`);
    err.code = 4003;
    throw err;
  }

  return {
    uid: decoded.uid,
    companyId: tokenCompanyId,
    role: decoded.role || 'viewer',
  };
}

module.exports = { verifyConnection };
