/**
 * **Η λίστα απευθείας εγγραφής του MCP** — κοινή για τις πύλες «ενός γραφέα» (CHECK 3.113 · 3.114).
 *
 * Το MCP (`mcp-server/src/security/access-control.ts`) γράφει στη βάση **χωρίς κανέναν γραφέα της εφαρμογής**: ό,τι
 * συλλογή έχει ΕΝΑΝ γραφέα δεν πρέπει να βρίσκεται στο `WRITE_ALLOWED_COLLECTIONS`. Χωρίς λίστα ⇒ η πύλη αρνείται
 * (`SOURCE_DRIFT`), ποτέ «καθαρό» στα τυφλά.
 */

'use strict';

const MCP_ACCESS_CONTROL = 'mcp-server/src/security/access-control.ts';

/** Το σώμα του `WRITE_ALLOWED_COLLECTIONS = new Set([...])`, χωρίς σχόλια — ή `null` αν δεν βρέθηκε. */
function mcpWriteAllowList(text) {
  const match = /WRITE_ALLOWED_COLLECTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(text);
  return match ? match[1].replace(/\/\/.*$/gm, '') : null;
}

/**
 * Ευρήματα για μία πύλη: `forbidden` = regex που δεν πρέπει να ταιριάζει στη λίστα, `detail` = το μήνυμα παράβασης.
 */
function mcpAllowListFindings(input, STATES, { forbidden, detail }) {
  const text = input.exists(MCP_ACCESS_CONTROL) ? input.read(MCP_ACCESS_CONTROL) : null;
  const list = text === null ? null : mcpWriteAllowList(text);
  if (list === null) {
    return [{ state: STATES.SOURCE_DRIFT, file: MCP_ACCESS_CONTROL, detail: 'δεν βρέθηκε το `WRITE_ALLOWED_COLLECTIONS` — η πύλη δεν κρίνει στα τυφλά' }];
  }
  return forbidden.test(list) ? [{ state: STATES.OUTSIDE, file: MCP_ACCESS_CONTROL, detail }] : [];
}

module.exports = { MCP_ACCESS_CONTROL, mcpWriteAllowList, mcpAllowListFindings };
