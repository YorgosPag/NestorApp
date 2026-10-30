#!/usr/bin/env node
'use strict';

/**
 * ADR-777 §8.12 — CHECK 3.52, το ΔΕΝΤΡΟ.
 *
 * Η μία ευθύνη αυτού του αρχείου: «τι λέει η ιεραρχία φακέλων του Next.js;».
 * Καμία κρίση, καμία λίστα διαδρομών — μόνο η δομή, διαβασμένη από τον δίσκο.
 *
 * 🔑 Γιατί η δομή ΕΙΝΑΙ η απάντηση: ένα route group `(x)` είναι ΦΑΚΕΛΟΣ και δεν
 * εμφανίζεται ΠΟΤΕ στο `pathname`. Κάθε φρουρός που κρίνει «γυμνή σελίδα;» από
 * το `pathname` είναι επομένως ΔΟΜΙΚΑ τυφλός στα groups — δεν αποκλίνει η λίστα
 * του, δεν ρωτιέται ποτέ. Αυτό ακριβώς έκανε ο `ConditionalAppShell` με τρεις
 * χειρόγραφες λίστες, και γι' αυτό διαγράφηκε.
 */

const path = require('node:path');

/** Η είσοδος της πύλης (ADR-924) — προεπιλογή ο δίσκος της ρίζας· ο εκτελεστής δίνει την όψη του commit. */
const inputOf = (root) => require('../gate-input').openGateInput({ root });

const GROUP_RE = /^\(.+\)$/;

/** Windows backslash → posix, ώστε κάθε σύγκριση/κλειδί να είναι μία διάλεκτος. */
const { toPosix } = require('../posix-path'); // SSoT (ADR-924 §8.9)

function relOf(projectRoot, abs) {
  return toPosix(path.relative(projectRoot, abs));
}

/**
 * Τα route groups που ζουν ΑΜΕΣΑ κάτω από το `src/app`.
 * Μόνο αυτά δηλώνονται: ένα εμφωλευμένο group δεν αλλάζει «φοράει κέλυφος;» —
 * αυτό το αποφασίζει ο πλησιέστερος πρόγονος-ιδιοκτήτης, όχι το βάθος.
 */
function enumerateRootGroups(projectRoot, appDir = 'src/app', input = inputOf(projectRoot)) {
  const children = input.children(appDir);
  if (children === null) return [];
  return children.dirs.filter(name => GROUP_RE.test(name)).sort();
}

/**
 * Κάθε αρχείο σύμβασης του App Router με το δοσμένο **βασικό όνομα**, κάτω από το
 * `src/app` και **εκτός** του `api/` (route handlers: δεν αποδίδουν layout, άρα η
 * ερώτηση δεν τους αφορά — και δεν φτιάχνουμε κάδο για πληθυσμό που δεν κρίνεται).
 *
 * ⚠️ **ΕΝΑΣ walker, όχι δύο.** Η πρώτη γραφή είχε `enumeratePages` και
 * `enumerateLayouts` πανομοιότυπα εκτός από τον έλεγχο ονόματος — δίδυμο που θα
 * έπιανε το CHECK 3.28 (jscpd) **μέσα στο ίδιο commit** που κηρύσσει «μία μηχανή».
 */
function enumerateAppFiles(projectRoot, basename, appDir = 'src/app', input = inputOf(projectRoot)) {
  // ADR-924 Φ3 — από την ΕΙΣΟΔΟ (ήταν δικός του `readdirSync`): ίδιο κριτήριο, ίδια εξαίρεση του `api/`.
  const names = new Set([`${basename}.tsx`, `${basename}.jsx`]);
  return input.files([appDir], {
    accept: rel => names.has(rel.slice(rel.lastIndexOf('/') + 1)),
    pruneDir: dir => dir === `${appDir}/api/`,
  }).map(input.rel).sort();
}

/** Κάθε `page.tsx` που αποδίδεται με layout. */
function enumeratePages(projectRoot, appDir = 'src/app', input = undefined) {
  return enumerateAppFiles(projectRoot, 'page', appDir, input);
}

/** Κάθε `layout.tsx` του δέντρου διαδρομών. */
function enumerateLayouts(projectRoot, appDir = 'src/app', input = undefined) {
  return enumerateAppFiles(projectRoot, 'layout', appDir, input);
}

/**
 * Το route group της ΡΙΖΑΣ στο οποίο ανήκει η σελίδα, ή `null`.
 * `src/app/(app)/projects/page.tsx` → `(app)` · `src/app/page.tsx` → `null`.
 */
function rootGroupOf(pageRel, appDir = 'src/app') {
  const rest = pageRel.slice(appDir.length + 1);
  const first = rest.split('/')[0];
  return GROUP_RE.test(first) ? first : null;
}

/**
 * Η αλυσίδα layouts που τυλίγουν τη σελίδα, από τη ρίζα προς τα μέσα.
 * Είναι **ακριβώς** η σημασιολογία του App Router: ένα layout τυλίγει ό,τι ζει
 * στον φάκελό του και βαθύτερα.
 *
 * @param {string[]} layoutRels όλα τα layouts του δέντρου (από `enumerateLayouts`)
 */
function ancestorLayoutsOf(pageRel, layoutRels) {
  const pageDir = pageRel.slice(0, pageRel.lastIndexOf('/'));
  return layoutRels.filter(layoutRel => {
    const layoutDir = layoutRel.slice(0, layoutRel.lastIndexOf('/'));
    return pageDir === layoutDir || pageDir.startsWith(`${layoutDir}/`);
  });
}

module.exports = {
  GROUP_RE,
  toPosix,
  enumerateRootGroups,
  enumerateAppFiles,
  enumeratePages,
  enumerateLayouts,
  rootGroupOf,
  ancestorLayoutsOf,
};
