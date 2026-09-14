/**
 * @fileoverview **Ποια deployments κρατούν τα assets τους, και ποια αρχεία σβήνονται.**
 * @related ADR-860 §Ε1
 *
 * 🔑 **ΓΙΑΤΙ 7 ΗΜΕΡΕΣ**: μια καρτέλα ανοιχτή όλη την εβδομάδα εργασίας δεν χάνει ποτέ τον κώδικά
 * της. Πέρα από αυτό αναλαμβάνει ο πελάτης (ADR-860 §Ε3: μία ασφαλής ανανέωση). Πρότυπο:
 * Platformatic «draining» έκδοση και Vercel Skew Protection max-age.
 *
 * 🔑 **ΓΙΑΤΙ ΟΡΟΦΗ 20**: μια μέρα με πολλά deploys δεν επιτρέπεται να φουσκώσει την εικόνα
 * απεριόριστα. Με ~50 MB ανά build και κοινά αρχεία ανάμεσα σε builds, η χειρότερη περίπτωση
 * μένει φραγμένη.
 *
 * ⛔ **ΕΝΑ ΑΡΧΕΙΟ ΣΒΗΝΕΤΑΙ ΜΟΝΟ ΑΝ ΚΑΝΕΝΑ ΚΡΑΤΗΜΕΝΟ DEPLOYMENT ΤΟ ΑΝΑΦΕΡΕΙ.** Όχι «όταν λήξει
 * αυτός που το έφερε»: τα hashed αρχεία που δεν άλλαξαν **μοιράζονται** ανάμεσα σε builds, και
 * το `framework-*.js` του πρώτου deploy της εβδομάδας είναι συχνά και του σημερινού.
 */

'use strict';

/** Οι σταθερές — ΕΝΑ σημείο. */
const RETENTION_POLICY = Object.freeze({
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  maxDeployments: 20,
});

/**
 * Τα deployments που κρατιούνται. Το τρέχον **πάντα** (και πρώτο)· τα υπόλοιπα από το
 * νεότερο προς το παλαιότερο, όσο είναι εντός ηλικίας και χωρούν στην οροφή.
 *
 * @param {ReadonlyArray<{id: string, deployedAt: string, files: string[]}>} deployments
 * @param {string} currentId
 * @param {number} nowMs
 */
function selectRetainedDeployments(deployments, currentId, nowMs, policy = RETENTION_POLICY) {
  const current = deployments.find((d) => d.id === currentId);
  if (!current) throw new Error(`[static-retention] το τρέχον deployment ${currentId} λείπει από τη λίστα`);

  const others = deployments
    .filter((d) => d.id !== currentId)
    .filter((d) => nowMs - Date.parse(d.deployedAt) <= policy.maxAgeMs)
    .sort((a, b) => Date.parse(b.deployedAt) - Date.parse(a.deployedAt));

  return [current, ...others].slice(0, policy.maxDeployments);
}

/** Τα αρχεία που **κανένα** κρατημένο deployment δεν αναφέρει. Ταξινομημένα, για σταθερή έξοδο. */
function filesNoLongerReferenced(allDeployments, retained) {
  const kept = new Set(retained.flatMap((d) => d.files));
  const all = new Set(allDeployments.flatMap((d) => d.files));
  return [...all].filter((file) => !kept.has(file)).sort();
}

module.exports = { RETENTION_POLICY, selectRetainedDeployments, filesNoLongerReferenced };
