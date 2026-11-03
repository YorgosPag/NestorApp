#!/usr/bin/env node
/**
 * CHECK 3.113 — **Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΗΣ ΥΠΕΡΓΟΛΑΒΙΑΣ** (ADR-928).
 *
 * Η ΕΡΩΤΗΣΗ: «γράφει κάποιος ρήτρα, έκδοση ρήτρας ή πρότυπο ειδικότητας ΕΞΩ από τον έναν γραφέα — δηλαδή χωρίς διάκριση
 * καθηκόντων, χωρίς μία ανοιχτή πρόταση, χωρίς CAS, χωρίς ίχνος;»
 *
 * 🔴 Οι κανόνες (`allow write: if false`) κλείνουν τον πελάτη, ΟΧΙ το Admin SDK. Ένα δεύτερο
 * `db.collection(COLLECTIONS.SUBCONTRACT_CLAUSES)…set(…)` θα έγραφε «εγκεκριμένη» έκδοση που κανείς άλλος δεν ενέκρινε —
 * και το συμφωνητικό της Φ2 θα την καρφωνόταν με ψευδή νομιμοποίηση.
 *
 * Δύο σύνορα:
 *   - στο `src/` — η κοινή κρίση «σύμβολο → δηλωμένοι κάτοχοι» (`lib/write-authority/symbol-owner-gate`, μοιράζεται με 3.112)·
 *   - στο MCP — καμία συλλογή `subcontract_*` στη λίστα απευθείας εγγραφής (`mcp-server/src/security/access-control.ts`):
 *     εκείνη η πόρτα γράφει χωρίς κανέναν γραφέα.
 *
 * @see docs/gates/3.113.md
 */

'use strict';

const { defineSymbolOwnerGate } = require('./lib/write-authority/symbol-owner-gate');

const REGISTRY_FILE = '.subcontract-authority.json';
const MCP_ACCESS_CONTROL = 'mcp-server/src/security/access-control.ts';

/** Το σώμα του `WRITE_ALLOWED_COLLECTIONS = new Set([...])` — ό,τι επιτρέπεται να γράψει το MCP απευθείας. */
function mcpWriteAllowList(text) {
  const match = /WRITE_ALLOWED_COLLECTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(text);
  return match ? match[1].replace(/\/\/.*$/gm, '') : null;
}

function mcpFindings(root, input, STATES) {
  const text = input.exists(MCP_ACCESS_CONTROL) ? input.read(MCP_ACCESS_CONTROL) : null;
  const list = text === null ? null : mcpWriteAllowList(text);
  if (list === null) {
    return [{ state: STATES.SOURCE_DRIFT, file: MCP_ACCESS_CONTROL, detail: 'δεν βρέθηκε το `WRITE_ALLOWED_COLLECTIONS` — η πύλη δεν κρίνει στα τυφλά' }];
  }
  return /['"`]subcontract_/.test(list)
    ? [{ state: STATES.OUTSIDE, file: MCP_ACCESS_CONTROL, detail: 'συλλογή `subcontract_*` στη λίστα απευθείας εγγραφής του MCP — παρακάμπτει τον γραφέα' }]
    : [];
}

const { measure, report, main, loadRegistry, STATES, BLOCKING } = defineSymbolOwnerGate({
  check: '3.113',
  skipEnv: 'SKIP_SUBCONTRACT_AUTHORITY',
  ok: 'η υπεργολαβία έχει ΕΝΑΝ γραφέα — κάθε ρήτρα, έκδοση και πρότυπο περνά από τη διακυβέρνησή του',
  registryFile: REGISTRY_FILE,
  outsideState: 'subcontract-written-outside-owner',
  extraFindings: mcpFindings,
  report: {
    title: '📜 CHECK 3.113 — Πύλη του ενός γραφέα της υπεργολαβίας (ADR-928)',
    width: 36,
    remedy: [
      'ΘΕΡΑΠΕΙΑ: κάθε εγγραφή σε `subcontract_*` περνά από `runSubcontractTransaction` μέσα σε γραφέα του `src/server/subcontracts/`.',
      `Νέος γραφέας = γραμμή στο ${REGISTRY_FILE}, με λόγο. Το MCP δεν γράφει ποτέ απευθείας.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE, MCP_ACCESS_CONTROL };
