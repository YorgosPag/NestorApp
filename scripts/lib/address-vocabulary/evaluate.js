#!/usr/bin/env node
/**
 * ADR-772 §9 — Το **κριτήριο**: ποιο πεδίο είναι διοικητικό, και ποιος τύπος είναι λεξιλόγιο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΕΡΩΤΗΜΑΤΑ, ΔΥΟ ΠΑΡΑΒΙΑΣΕΙΣ — και **όχι** έξι
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ADR-772 §9 οριοθετεί ρητά τι σταματά **ήδη ο μεταγλωττιστής**: ένατο επίπεδο
 * (`Record<AdminLevelKey,…>`), μετονομασία πεδίου (`keyof VocabularyContainers[V]`),
 * ξεχασμένο Zod (fixture `Required<ProjectAddress>`), νέο ιδιωτικό ζεύγος (CHECK 3.7),
 * δύο κανόνες στο ίδιο πεδίο (άγκυρα «κανένα πεδίο με δύο διεκδικητές»).
 * Μένουν **δύο** ερωτήματα που κανείς δεν απαντά:
 *
 *   1. `unmapped-administrative-field` — δοχείο **του πίνακα** απέκτησε διοικητικό
 *      πεδίο που **καμία γραμμή δεν διεκδικεί** ⇒ ο μετατροπέας δεν το μεταφέρει,
 *      τίποτα δεν σκάει, η απώλεια είναι σιωπηλή **και μοιάζει λυμένη**.
 *   2. `unregistered-vocabulary` — **έκτο λεξιλόγιο** που κανείς δεν σύνδεσε.
 *
 * ⛔ Δεν υπάρχει `orphan-mapping` («ο πίνακας δείχνει σε ανύπαρκτο πεδίο»): το `keyof`
 * το κάνει **αδύνατο**. Δεν υπάρχει ούτε `orphan-not-stored` («λέει NOT_STORED ενώ το
 * πεδίο υπάρχει»): εξετάστηκε και είναι **ακριβώς ισοδύναμο** με το (1) — το πεδίο θα
 * ήταν αδιεκδίκητο, άρα ήδη παράβαση. Και τα δύο θα ήταν φρουροί που **δεν μπορούν να
 * πυροδοτήσουν**, δηλαδή προσθήκη στους 606 αδρανείς του ADR-749 §5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΡΙΤΗΡΙΟ ΛΕΞΙΛΟΓΙΟΥ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΔΙΑΛΕΓΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το προφανές («≥3 διοικητικά πεδία») **μετρήθηκε σε όλο το `src/` και απορρίφθηκε**:
 * 12 ευρήματα, από τα οποία **4 παραγόμενοι τύποι i18n** (`I18n_Common_Audit_Fields`
 * κ.λπ. στο `src/types/i18n.ts`) και ένα `ContactAddressMapPreviewProps` που απλώς
 * **δέχεται** τρία ονόματα ως props για αποσαφήνιση γεωκωδικοποίησης. **33% ψευδώς
 * θετικά** — ο πήχης της Google για μπλοκάρουσα πύλη είναι **<10%**.
 *
 * Κρατήθηκε το κριτήριο **ταυτότητας**:
 *
 *   ≥3 διοικητικά πεδία, από τα οποία **≥2 είναι ταυτότητες** (`<επίπεδο>Id`).
 *
 * 🔑 ΓΙΑΤΙ Η ΤΑΥΤΟΤΗΤΑ ΚΑΙ ΟΧΙ ΤΟ ΠΛΗΘΟΣ: ένα **όνομα** («Θεσσαλονίκη») είναι κείμενο —
 * το πληκτρολογεί άνθρωπος, το επιστρέφει γεωκωδικοποιητής, το κρατά ένα prop για
 * αποσαφήνιση. Μια **ταυτότητα** μπορεί να προέλθει **μόνο** από το σύνολο δεδομένων της
 * ιεραρχίας. Μία ταυτότητα είναι *αναφορά*· **δύο** σημαίνει ότι ο τύπος κουβαλά τα
 * κλειδιά της ιεραρχίας, δηλαδή **είναι** λεξιλόγιο. Στα μετρημένα δεδομένα αυτό
 * αφαιρεί **τρεις από τους τέσσερις** παραγόμενους i18n, το `ContactAddressMapPreviewProps`
 * (0 ταυτότητες — δέχεται τρία **ονόματα** για αποσαφήνιση), το `CompanyAddressSnapshot`
 * (1) και το `RegionOverrideTarget` του BIM (1 — όπου «region» σημαίνει *περιοχή
 * περιβλήματος*, άλλος τομέας με ίδια λέξη).
 *
 * 🔴 Ο **τέταρτος** i18n επέζησε — και η διόρθωση δεν ήταν να χαλαρώσει το κριτήριο:
 * το `I18n_Common_Audit_Fields` **έχει** `settlementId` και `municipalityId` (κλειδιά
 * μετάφρασης με το ίδιο όνομα). Έμενε **1 στα 5 = 20%**. Λύθηκε με τη ρητή κατάσταση
 * `generated-artifact` (βλ. `isGeneratedSource`): παραγόμενο αρχείο είναι **προβολή**
 * άλλου SSoT, όχι απόφαση — η φρεσκάδα του φρουρείται ήδη από το CHECK 3.33.
 * Τελικό: **4 ευρήματα, 4 πραγματικά, 0% ψευδώς θετικά.**
 *
 * ⚠️ ΤΑ ΚΑΤΩΦΛΙΑ ΔΕΝ ΧΑΛΑΡΩΝΟΥΝ ΓΙΑ ΝΑ ΓΙΝΕΙ ΠΡΑΣΙΝΟ. Μπήκαν **πριν** μετρηθεί το
 * αποτέλεσμα των υποψηφίων και δικαιολογούνται από **τι είναι** μια ταυτότητα, όχι από
 * το πόσα ευρήματα βγάζουν.
 *
 * @module scripts/lib/address-vocabulary/evaluate
 */

'use strict';

const { resolveContainerDeclarations } = require('./type-index');

/** ≥3 διοικητικά πεδία … */
const VOCABULARY_MIN_FIELDS = 3;
/** … από τα οποία ≥2 ταυτότητες. Βλ. «ΤΟ ΚΡΙΤΗΡΙΟ» παραπάνω. */
const VOCABULARY_MIN_IDENTITIES = 2;

/** Οι καταστάσεις που μπλοκάρουν. Οι υπόλοιπες υπάρχουν για να **μη σιωπά** τίποτα. */
const ZERO_TOLERANCE_STATES = ['unmapped-administrative-field', 'unanalyzable-container'];
const RATCHETED_STATES = ['unregistered-vocabulary'];
const VIOLATION_STATES = [...ZERO_TOLERANCE_STATES, ...RATCHETED_STATES];

/**
 * Τα κανονικά ονόματα πεδίων ενός επιπέδου: `region` · `regionId` · `regionName`.
 *
 * ⚠️ Οι ρίζες έρχονται **από τον πίνακα** (`Object.keys(ADMIN_LEVEL_VOCABULARY)`), ποτέ
 * από λίστα εδώ: χειρόγραφο αντίγραφο θα ήταν δεύτερη αυθεντία και θα απέκλινε σιωπηλά
 * — το ακριβές σχήμα των δύο λιστών namespace του CHECK 3.34.
 *
 * @param {string[]} levelRoots
 * @returns {Map<string,{root:string, kind:'plain'|'id'|'name'}>}
 */
function adminFieldNames(levelRoots) {
  const out = new Map();
  for (const root of levelRoots) {
    out.set(root, { root, kind: 'plain' });
    out.set(`${root}Id`, { root, kind: 'id' });
    out.set(`${root}Name`, { root, kind: 'name' });
  }
  return out;
}

/**
 * Είναι αυτός ο τύπος λεξιλόγιο; Επιστρέφει **πάντα** το σκεπτικό, ώστε η αναφορά να
 * μπορεί να πει *γιατί όχι* — «δεν πέρασε το κατώφλι» χωρίς αριθμούς είναι σιωπηλή
 * απόρριψη με άλλο όνομα.
 */
function classifyVocabulary(fieldNames, adminNames) {
  const admin = [];
  const identities = [];
  for (const name of fieldNames) {
    const hit = adminNames.get(name);
    if (!hit) continue;
    admin.push(name);
    if (hit.kind === 'id') identities.push(name);
  }
  const isVocabulary = admin.length >= VOCABULARY_MIN_FIELDS
    && identities.length >= VOCABULARY_MIN_IDENTITIES;
  return { isVocabulary, admin, identities };
}

/**
 * ΕΡΩΤΗΜΑ 1 — τα δοχεία **του πίνακα**: κάθε διοικητικό πεδίο τους έχει γραμμή;
 *
 * @param {object} table αποτέλεσμα του `readVocabularyTable`
 * @param {object} resolver αποτέλεσμα του `createResolver`
 * @returns {{findings:object[], judged:number}}
 */
function evaluateContainers(table, resolver) {
  const adminNames = adminFieldNames(table.levelRoots);
  const findings = [];
  let judged = 0;

  for (const { container, decl, reason } of resolveContainerDeclarations(table, resolver)) {
    if (!decl) {
      findings.push({
        state: 'unanalyzable-container',
        id: `${container.key}::${container.typeName}`,
        file: table.file,
        line: 0,
        detail: `το δοχείο \`${container.key}\` (${container.typeName}) δεν άνοιξε: ${reason}`,
      });
      continue;
    }

    const { fields, unresolvedBases } = resolver.effectiveFields(decl);
    for (const u of unresolvedBases) {
      findings.push({
        state: 'unanalyzable-container',
        id: `${container.key}::extends ${u.base}`,
        file: decl.file,
        line: decl.line,
        detail: `το \`${container.typeName}\` κληρονομεί από \`${u.base}\`, που δεν άνοιξε: ${u.reason}`,
      });
    }

    const claimed = table.claims.get(container.key) || new Set();
    const seenField = new Set();
    for (const field of fields) {
      if (seenField.has(field.name)) continue;
      seenField.add(field.name);
      if (!adminNames.has(field.name)) continue;
      judged++;
      if (claimed.has(field.name)) continue;
      findings.push({
        state: 'unmapped-administrative-field',
        id: `${container.key}::${field.name}`,
        file: field.file,
        line: field.line,
        detail: `το \`${container.typeName}.${field.name}\` (επίπεδο «${adminNames.get(field.name).root}») `
          + `δεν το διεκδικεί καμία γραμμή του πίνακα ⇒ ο μετατροπέας ΔΕΝ το μεταφέρει, σιωπηλά.`,
      });
    }
  }
  return { findings, judged };
}

/**
 * ΕΡΩΤΗΜΑ 2 — όλο το `src/`: υπάρχει τύπος που μιλά την ιεραρχία **χωρίς** να είναι στον πίνακα;
 *
 * @param {object[]} declarations κάθε δήλωση τύπου του δέντρου
 * @param {object} table
 * @param {object} resolver
 * @param {Set<string>} registeredKeys `file::Name` των δοχείων του πίνακα
 * @param {Set<string>} baseKeys `file::Name` όσων κληρονομούν τα δοχεία
 */
function evaluateTree(declarations, table, resolver, registeredKeys, baseKeys) {
  const adminNames = adminFieldNames(table.levelRoots);
  const findings = [];
  const byState = {};
  const bump = (s) => { byState[s] = (byState[s] || 0) + 1; };

  for (const decl of declarations) {
    const key = `${decl.file}::${decl.name}`;
    const { fields, unresolvedBases, opaqueBases } = resolver.effectiveFields(decl);
    const verdict = classifyVocabulary(fields.map((f) => f.name), adminNames);

    if (!verdict.isVocabulary) {
      // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ. Ένας τύπος με **ανεπίλυτη** βάση δεν είναι «κάτω από το
      // κατώφλι» — είναι «δεν ξέρω»: τα πεδία της βάσης λείπουν από τη μέτρηση, οπότε
      // ένα λεξιλόγιο μπορεί να κρύβεται εκεί. Μετράται χωριστά ώστε το τυφλό σημείο
      // να έχει **αριθμό** (μετρημένο: 186 από 20.319· κανένα με διοικητικό πεδίο
      // σήμερα). Δεν μπλοκάρει και δεν απαριθμείται — 186 γραμμές θορύβου θα έκρυβαν
      // τα 4 πραγματικά — αλλά ΔΕΝ σιωπά, που είναι η διαφορά από το «0 = κανείς δεν
      // κοίταξε». Ίδιο πρότυπο με το `unanalyzable: 194` του CHECK 3.35.
      if (unresolvedBases.length || opaqueBases.length) bump('unanalyzable-heritage');
      else bump('below-vocabulary-threshold');
      continue;
    }
    // Παραγόμενο αρχείο = **προβολή** άλλου SSoT, όχι απόφαση. Βλ. `isGeneratedSource`.
    if (decl.generated) { bump('generated-artifact'); continue; }
    if (registeredKeys.has(key)) { bump('registered-vocabulary'); continue; }
    if (baseKeys.has(key)) { bump('base-of-registered'); continue; }

    bump('unregistered-vocabulary');
    findings.push({
      state: 'unregistered-vocabulary',
      id: key,
      file: decl.file,
      line: decl.line,
      detail: `ο \`${decl.name}\` δηλώνει ${verdict.admin.length} διοικητικά πεδία `
        + `(${verdict.identities.length} ταυτότητες: ${verdict.identities.join(', ')}) `
        + `αλλά δεν είναι στήλη του \`VocabularyContainers\` ⇒ ο μετατροπέας δεν τον ξέρει.`,
    });
  }
  return { findings, byState };
}

module.exports = {
  VOCABULARY_MIN_FIELDS,
  VOCABULARY_MIN_IDENTITIES,
  ZERO_TOLERANCE_STATES,
  RATCHETED_STATES,
  VIOLATION_STATES,
  adminFieldNames,
  classifyVocabulary,
  evaluateContainers,
  evaluateTree,
};
