#!/usr/bin/env node
/**
 * ADR-744 — οι ΡΙΖΕΣ του κελύφους: `shellRoots` + `extraShellRoots` απέναντι στα αρχεία του γράφου.
 *
 * Βγήκε από το `plan.js` (N.7.1, ADR-744 §32.12) όταν απέκτησε δεύτερο καταναλωτή: το ίχνος των μελών
 * (`shell-members.js`) καταγράφει και ξαναρωτά ό,τι βλέπουν τα μοτίβα με ΤΗΝ ΙΔΙΑ συνάρτηση. Το `plan.js`
 * κάνει re-export για τους καταναλωτές του.
 */

'use strict';

const path = require('node:path');

const MG = require('../module-graph');

/** `src/app/**\/layout.tsx` → a RegExp. `**` crosses directories, `*` does not. */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/\*\*\//g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '(?:.*/)?');
  return new RegExp(`^${body}$`);
}

const rootEntries = config => [...config.shellRoots, ...config.extraShellRoots];

function patternMatches(projectRoot, pattern, files) {
  const matcher = patternToRegExp(pattern);
  return files.filter(file => matcher.test(MG.toPosix(path.relative(projectRoot, file))));
}

/**
 * Expands the configured roots against the files the graph actually holds.
 * A literal path that does not exist is fatal (a typo must not silently shrink
 * the shell); a pattern that matches nothing is fatal for the same reason.
 */
function resolveRoots(projectRoot, config, graph) {
  // ADR-744 §32 Β1 — ΤΟ ΣΥΝΟΛΟ ΑΡΧΕΙΩΝ ΤΟΥ ΓΡΑΦΟΥ, ΟΧΙ Ο ΔΙΣΚΟΣ ΟΥΤΕ Η ΕΠΑΝΑΛΗΨΗ ΤΟΥ `modules`. Ο on-demand
  // γράφος δεν έχει `modules.keys()` (θα σήμαινε «διάβασε τα όλα»), και στο στιγμιότυπο του ευρετηρίου ο
  // δίσκος του `projectRoot` ΔΕΝ περιέχει το `src`. Το `fileSet` υπάρχει και στους δύο γράφους· το
  // `modules.has` κρατά τη σημασιολογία του πρόθυμου, όπου ένα αρχείο που δεν αναλύεται δεν ήταν υποψήφιο.
  const known = [...graph.fileSet];
  const out = new Set();
  for (const rel of rootEntries(config)) {
    if (!rel.includes('*')) {
      const abs = MG.toPosix(path.join(projectRoot, rel));
      if (!graph.fileSet.has(abs)) throw new Error(`shell root not found: ${rel}`);
      out.add(abs);
      continue;
    }
    const hits = patternMatches(projectRoot, rel, known).filter(file => graph.modules.has(file));
    if (hits.length === 0) throw new Error(`shell root pattern matched nothing: ${rel}`);
    hits.forEach(file => out.add(file));
  }
  return [...out].sort();
}

/**
 * ADR-744 §32.12 — ό,τι ΒΛΕΠΟΥΝ τα μοτίβα ριζών από το σύνολο αρχείων, ΠΡΙΝ από το φίλτρο ανάλυσης.
 * Είναι η μόνη εξάρτηση του `resolveRoots` από το ΣΥΝΟΛΟ αρχείων (οι κυριολεκτικές ρίζες είναι έλεγχοι
 * ύπαρξης, και το φίλτρο `modules.has` είναι συνάρτηση του περιεχομένου): το ίχνος των μελών του
 * κελύφους (`shell-members.js`) την καταγράφει και την ξαναρωτά με ΑΥΤΗ τη συνάρτηση, όχι με αντίγραφο.
 */
function rootPatternCandidates(projectRoot, config, files) {
  const hits = new Set();
  for (const rel of rootEntries(config)) {
    if (rel.includes('*')) patternMatches(projectRoot, rel, files).forEach(file => hits.add(file));
  }
  return [...hits].sort();
}

module.exports = { patternToRegExp, resolveRoots, rootPatternCandidates };
