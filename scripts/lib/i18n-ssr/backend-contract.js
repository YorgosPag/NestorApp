#!/usr/bin/env node
/**
 * =============================================================================
 * «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ» — ΤΟ 5xx ΠΟΥ Ο ΚΩΔΙΚΑΣ **ΔΗΛΩΣΕ** (CHECK 3.51 Χ · ADR-781)
 * =============================================================================
 *
 * 🔴 ΤΟ ΕΥΡΗΜΑ: ο χρησμός σηκώνει την εικόνα της παραγωγής **ερμητικά** — χωρίς
 * διαπιστευτήρια βάσης, επίτηδες (κανένα μυστικό παραγωγής σε job ποιότητας). Μια
 * **δημόσια** σελίδα που οφείλει να ρωτήσει τη βάση πριν αποδοθεί (`/pro/<γραφείο>`)
 * απαντά τότε **σωστά** 5xx — ποτέ 404 (ψέμα), ποτέ 200 με οθόνη σφάλματος (soft 404
 * για την Google). Ο χρησμός το έγραφε ⛔ `route-unreachable` και **αρνιόταν να γράψει
 * baseline** — 44 στις 44 εκτελέσεις από τη γέννησή του (2026-08-22 → 2026-09-22).
 *
 * 🔑 Η ΛΥΣΗ ΔΕΝ ΕΙΝΑΙ ΛΙΣΤΑ ΔΙΑΔΡΟΜΩΝ — ΕΙΝΑΙ **ΑΠΟΔΕΙΞΗ ΑΠΟ ΤΗΝ ΙΔΙΑ ΤΗΝ ΑΠΑΝΤΗΣΗ**.
 * Ο κώδικας ρίχνει `BackendUnavailableError` (SSoT: `src/lib/errors/backend-unavailable.ts`)
 * με δικό του `digest`. Το Next.js **σέβεται** το `digest` και το στέλνει ως γραμμή
 * σφάλματος του flight μέσα στο HTML του 5xx — μετρημένο 2026-09-22 σε Next 15.5.22:
 *
 *     \n5:E{\"digest\":\"NESTOR_BACKEND_UNAVAILABLE:agency-alias-lookup\"}
 *
 * Άρα: 5xx **με** αυτή τη γραμμή = «ο κώδικας είπε ότι δεν μπόρεσε να ρωτήσει»·
 * 5xx **χωρίς** αυτήν = crash ⇒ ⛔ όπως πάντα. **fail-closed.**
 *
 * ⚠️ ΓΙΑΤΙ ΤΟ ΣΧΗΜΑ ΤΗΣ ΓΡΑΜΜΗΣ `E{…}` ΚΑΙ ΟΧΙ ΣΚΕΤΟ ΚΕΙΜΕΝΟ: τα `params` της
 * διαδρομής σειριοποιούνται **κι αυτά** στο flight. Ένα `/pro/NESTOR_BACKEND_…` θα
 * έβαζε το κείμενο στο HTML **χωρίς** να ρίξει τίποτα ο κώδικας. Μέσα σε JSON string
 * τα εισαγωγικά του θα ήταν **διπλο-διαφυγμένα** — δεν ταιριάζουν σε γραμμή `E`.
 * Και η εξάρτηση πρέπει να ανήκει στο **κλειστό σύνολο** του SSoT.
 *
 * ⚠️ fail-closed στην ανάγνωση του SSoT: μετονομασία συμβόλου ⇒ `throw` με όνομα,
 * ποτέ σιωπηλά κενό σύνολο (που θα έκανε κάθε 5xx ξανά ⛔ — φρουρός που κατηγορεί
 * για δικό του σφάλμα).
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readStringArrayConst } = require('./served-surface');

const SSOT_FILE = 'src/lib/errors/backend-unavailable.ts';

/** Διαβάζει πρόθεμα + κλειστό σύνολο εξαρτήσεων **από τον κώδικα που τα ρίχνει**. */
function loadBackendContract(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, SSOT_FILE), 'utf8');
  const prefix = source.match(/BACKEND_UNAVAILABLE_DIGEST_PREFIX\s*=\s*'([A-Z_]+)'/);
  if (!prefix) throw new Error(`CHECK 3.51 Χ: δεν βρέθηκε το BACKEND_UNAVAILABLE_DIGEST_PREFIX στο ${SSOT_FILE}`);
  const dependencies = readStringArrayConst(source, 'BACKEND_DEPENDENCIES', SSOT_FILE);
  return Object.freeze({ prefix: prefix[1], dependencies: Object.freeze(new Set(dependencies)) });
}

/**
 * Η εξάρτηση που **δήλωσε** ο κώδικας μέσα σε αυτή την απάντηση, ή `null`.
 * Το πρόθεμα είναι `[A-Z_]+` (επικυρωμένο στη φόρτωση) ⇒ ασφαλές μέσα σε RegExp.
 */
function declaredBackendUnavailable(html, contract) {
  const row = new RegExp(String.raw`(?:\\n|")[0-9a-f]+:E\{\\"digest\\":\\"` + contract.prefix + String.raw`:([a-z-]+)(?:@[^\\"]*)?\\"`);
  const match = html.match(row);
  if (!match) return null;
  return contract.dependencies.has(match[1]) ? match[1] : null;
}

module.exports = { SSOT_FILE, loadBackendContract, declaredBackendUnavailable };
