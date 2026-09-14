/**
 * @fileoverview **Το σχέδιο μεταφοράς assets** από την προηγούμενη εικόνα στη νέα — καθαρή λογική.
 * @related ADR-860 §Ε1
 *
 * Είσοδοι: τι έχει η προηγούμενη εικόνα (αρχεία + μανιφέστο), τι έχει το νέο build. Έξοδος: τι
 * αντιγράφεται, ποιο μανιφέστο γράφεται, ποια deployments έληξαν. **Κανένα I/O** — το εκτελεί το
 * `scripts/deploy/carry-forward-static-assets.js`.
 *
 * 🔑 **ΠΟΤΕ ΑΝΤΙΚΑΤΑΣΤΑΣΗ**: ό,τι υπάρχει στο νέο build μένει όπως είναι. Αν το ίδιο όνομα
 * υπάρχει και στα δύο με **διαφορετικά** bytes, κρατιέται το **νέο** και αναφέρεται ως
 * σύγκρουση. Γιατί όχι σφάλμα: το δίχτυ ασφαλείας δεν επιτρέπεται να σταματήσει deploy
 * παραγωγής — και χωρίς μεταφορά, η ίδια καρτέλα θα έπαιρνε ούτως ή άλλως το νέο αρχείο.
 *
 * 🔑 **Η ΠΡΩΤΗ ΦΟΡΑ**: η προηγούμενη εικόνα δεν έχει μανιφέστο (χτίστηκε πριν το ADR-860). Τα
 * αρχεία της παίρνουν συνθετική εγγραφή `pre-retention` με ημερομηνία **τώρα** — δηλαδή την
 * ίδια περίοδο χάριτος 7 ημερών, αντί να χαθούν αμέσως.
 */

'use strict';

const { selectRetainedDeployments, filesNoLongerReferenced } = require('./retention-policy');

const PRE_RETENTION_ID = 'pre-retention';

/** Τα αρχεία της προηγούμενης εικόνας που **κανένα** γνωστό deployment δεν αναφέρει. */
function unclaimedPreviousFiles(prevFiles, prevDeployments) {
  const claimed = new Set(prevDeployments.flatMap((d) => d.files));
  return [...prevFiles.keys()].filter((file) => !claimed.has(file)).sort();
}

function knownDeployments({ prevFiles, prevDeployments, nextFiles, deploymentId, nowIso }) {
  const current = { id: deploymentId, deployedAt: nowIso, files: [...nextFiles.keys()].sort() };
  const unclaimed = unclaimedPreviousFiles(prevFiles, prevDeployments);
  const legacy = unclaimed.length > 0 ? [{ id: PRE_RETENTION_ID, deployedAt: nowIso, files: unclaimed }] : [];
  const previous = prevDeployments.filter((d) => d.id !== deploymentId);
  return [current, ...previous, ...legacy];
}

/**
 * @param {{
 *   prevFiles: Map<string, string>,          // σχετικό μονοπάτι → sha256
 *   prevDeployments: Array<{id: string, deployedAt: string, files: string[]}>,
 *   nextFiles: Map<string, string>,
 *   deploymentId: string,
 *   nowIso: string,
 * }} input
 */
function buildCarryForwardPlan(input) {
  const deployments = knownDeployments(input);
  const retained = selectRetainedDeployments(deployments, input.deploymentId, Date.parse(input.nowIso));
  const expiredFiles = new Set(filesNoLongerReferenced(deployments, retained));

  const copy = [];
  const conflicts = [];
  for (const [file, hash] of input.prevFiles) {
    if (input.nextFiles.has(file)) {
      if (input.nextFiles.get(file) !== hash) conflicts.push(file);
    } else if (!expiredFiles.has(file)) {
      copy.push(file);
    }
  }

  return {
    copy: copy.sort(),
    conflicts: conflicts.sort(),
    retained,
    expiredDeploymentIds: deployments.filter((d) => !retained.includes(d)).map((d) => d.id),
  };
}

module.exports = { PRE_RETENTION_ID, buildCarryForwardPlan };
