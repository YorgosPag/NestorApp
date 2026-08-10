'use strict';

/**
 * =============================================================================
 * CHECK 3.53 — η κρίση  (ADR-739 §0.3 / ADR-777 §0.4)
 * =============================================================================
 *
 * «Επιλύεται αυτός ο δείκτης σε **ακριβώς μία** ενότητα **ακριβώς ενός** εγγράφου;»
 *
 * Ο `scan.js` **βρίσκει**· εδώ **αποφασίζεται**. Ο διαχωρισμός δεν είναι αισθητικός:
 * η απογραφή («ποιος κρίθηκε;») είναι άλλη ευθύνη από την κρίση («είναι σπασμένο;»),
 * και όταν συγχωνεύονται, η μία αρχίζει να επικυρώνει την άλλη.
 *
 * ## Η ΔΙΑΚΡΙΣΗ ΠΟΥ ΚΑΝΕΙ ΤΗ ΔΟΥΛΕΙΑ
 *
 *  · `dangling-section` — ο δείκτης **δεν υπάρχει καν ως κείμενο** στην οικογένεια.
 *    Αυτό είναι **λάθος**: κανείς δεν μπορεί να πλοηγηθεί εκεί, ποτέ.
 *  · `prose-only`       — υπάρχει ως **κείμενο** αλλά όχι ως **επικεφαλίδα**.
 *    Ο αναγνώστης βρίσκει *κάτι* με Ctrl+F· δεν έχει άγκυρα.
 *
 * Δύο **διαφορετικές** βλάβες με **διαφορετική θεραπεία** ⇒ δύο καταστάσεις, ποτέ μία
 * με «ή» (μάθημα CHECK 3.41). Και δύο **διαφορετικοί μηχανισμοί**: το πρώτο είναι
 * zero-tolerance (καθαρίζεται στο ίδιο commit· γεννιέται στο 0, **μετρημένα**), το
 * δεύτερο ratchet (3 ζωντανές· zero-tol με ζωντανές παραβιάσεις = μονίμως κόκκινο ⇒
 * `SKIP_` ⇒ διακοσμητικό — δοκιμάστηκε και απορρίφθηκε ρητά στο CHECK 3.39).
 *
 * ## ΤΟ ΣΥΜΒΟΛΑΙΟ ΔΕΣΜΩΝ ΕΛΕΓΧΕΤΑΙ ΜΟΝΟ ΟΠΟΥ ΔΗΛΩΘΗΚΕ
 * Πρότυπο **Kubernetes KEP**: ο validator τρέχει σε ό,τι έχει `kep.yaml`, όχι σε κάθε
 * αρχείο του δέντρου. Εδώ: αρχείο **χωρίς** frontmatter `sections:` δεν κρίνεται για
 * λογιστική ενοτήτων — αλλά **δηλώνεται** ως `unbonded`, ώστε η απουσία να είναι
 * **ορατή** και όχι σιωπηλή. Το «δεν κοίταξα» δεν επιτρέπεται να μοιάζει με «καθαρό».
 *
 * @module scripts/lib/adr-sections/resolve
 */

const S = require('./scan');

/** Οι καταστάσεις των **δεικτών**. */
const REF_STATES = Object.freeze({
  DANGLING: 'dangling-section',
  AMBIGUOUS: 'ambiguous-section',
  PROSE_ONLY: 'prose-only',
  PHASE_LABEL: 'phase-label',
  RESOLVED: 'resolved',
});
/**
 * 🔴 **ΤΟ ΣΧΕΔΙΟ ΕΛΕΓΕ ZERO-TOL ΕΔΩ. Η ΜΕΤΡΗΣΗ ΤΟ ΑΝΕΤΡΕΨΕ — ΚΑΙ ΚΑΛΩΣ.**
 *
 * Η πρόβλεψη ήταν «4 dangling, όλα προφανή ⇒ καθαρίζονται στο ίδιο commit ⇒ γεννιέται
 * στο 0». Το πραγματικό δέντρο απάντησε **9 dangling** και **61 ambiguous**, από τα
 * οποία **βέβαιη διόρθωση** υπήρχε μόνο για τρία (`§8390` → `§40`, αποδεδειγμένα από
 * το ίδιο το κείμενο). Τα υπόλοιπα —`§6.6` ×4, `§48.11`, `§48.13`, και οι 4
 * διφορούμενες— απαιτούν **απόφαση περιεχομένου**: ποια από τις δύο ομώνυμες
 * επικεφαλίδες κρατά το ID, και τι εννοούσε ο συγγραφέας.
 *
 * Zero-tolerance με ζωντανές παραβιάσεις = **μονίμως κόκκινο** ⇒ παρακάμπτεται με
 * `SKIP_` ⇒ διακοσμητικό. Δοκιμάστηκε και απορρίφθηκε ρητά στο CHECK 3.39, και το
 * CHECK 3.49 έκανε **ακριβώς** αυτή την επιλογή για τις 140 συγκρούσεις ADR.
 * ⇒ **Ratchet κατά ταυτότητα**: οι υπάρχουσες κλειδώνονται, κάθε **νέα** μπλοκάρει.
 */
const REF_BLOCKING = [];
const REF_RATCHETED = [REF_STATES.DANGLING, REF_STATES.AMBIGUOUS, REF_STATES.PROSE_ONLY];
// ⚠️ Η σειρά παράγεται από ΟΛΕΣ τις οικογένειες καταστάσεων, ποτέ από μία: όταν το
// `REF_BLOCKING` άδειασε (ratchet αντί zero-tol), μια σειρά χτισμένη μόνο πάνω του
// έχασε σιωπηλά το `ambiguous-section` — και η κλειστή λογιστική **το έπιασε**.
const REF_ORDER = [...REF_BLOCKING, ...REF_RATCHETED, REF_STATES.PHASE_LABEL, REF_STATES.RESOLVED];

/** Οι καταστάσεις των **εγγράφων** (το συμβόλαιο δεσμών του ADR-777 §0.4). */
const DOC_STATES = Object.freeze({
  ORPHAN_SECTION: 'orphan-section',
  BROKEN_BOND: 'broken-bond',
  DUPLICATE_HEADING: 'duplicate-heading',
  UNBONDED: 'unbonded',
  BONDED: 'bonded',
});
const DOC_BLOCKING = [DOC_STATES.ORPHAN_SECTION, DOC_STATES.BROKEN_BOND];
const DOC_RATCHETED = [DOC_STATES.DUPLICATE_HEADING];
const DOC_ORDER = [...DOC_BLOCKING, DOC_STATES.DUPLICATE_HEADING, DOC_STATES.UNBONDED, DOC_STATES.BONDED];

/** Το αντίστροφο ζεύγος κάθε δεσμού — κλειστό λεξιλόγιο (ADR-777 §0.4, πρότυπο PEP 1). */
const BOND_INVERSE = Object.freeze({
  'specified-by': 'specifies',
  'researched-in': 'researches',
  'discussed-in': 'discusses',
  'recorded-in': 'records',
});

const normId = raw => String(raw).replace(/^§\s*/, '').trim();

/** Φορτώνει τα αρχεία μιας οικογένειας και χτίζει τον ρητό πίνακα ID → θέσεις. */
function buildFamily(projectRoot, familyId, cfg) {
  const rels = [cfg.hub, ...(cfg.members || [])];
  const files = [];
  const byId = new Map();

  for (const rel of rels) {
    const text = S.readText(projectRoot, rel);
    if (text === null) { files.push({ rel, missing: true, headings: [], fm: null, text: '' }); continue; }
    const headings = S.indexHeadings(text, rel);
    files.push({ rel, missing: false, headings, fm: S.parseFrontmatter(text), text });
    for (const h of headings) {
      if (!byId.has(h.id)) byId.set(h.id, []);
      byId.get(h.id).push(h);
    }
  }
  return { id: familyId, cfg, files, byId };
}

/** Υπάρχει ο δείκτης έστω ως **κείμενο** κάπου στην οικογένεια; */
function appearsInProse(family, section) {
  const needle = new RegExp(`§\\s*${section.replace(/\./g, '\\.')}(?![\\d.])`, 'u');
  return family.files.some(f => !f.missing && needle.test(f.text));
}

/** Η ταξινόμηση ενός δείκτη. **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ.** */
function classifyRef(ref, family) {
  if (ref.form === 'phase') return { ...ref, state: REF_STATES.PHASE_LABEL };

  const hits = family.byId.get(ref.section) || [];
  if (hits.length === 0) {
    return appearsInProse(family, ref.section)
      ? { ...ref, state: REF_STATES.PROSE_ONLY }
      : { ...ref, state: REF_STATES.DANGLING };
  }
  // 🔴 ΔΥΟ ΕΠΙΚΕΦΑΛΙΔΕΣ ΜΕ ΤΟ ΙΔΙΟ ID ΕΙΝΑΙ ΔΙΦΟΡΟΥΜΕΝΟ ΚΑΙ ΜΕΣΑ ΣΤΟ ΙΔΙΟ ΑΡΧΕΙΟ.
  // Η πρώτη γραφή έκρινε μόνο «σε πόσα ΑΡΧΕΙΑ;» — και το πραγματικό δέντρο έχει δύο
  // `### 48.10` στο ίδιο έγγραφο, με **1.003 δείκτες** να μπορούν να δείχνουν εκεί.
  // Ένα κριτήριο επιπέδου αρχείου θα τα έβαφε `resolved`: η ασάφεια δεν γεννιέται από
  // το πόσα αρχεία εμπλέκονται, αλλά από το ότι **ο δείκτης δεν προσδιορίζει θέση**.
  if (hits.length > 1) {
    return { ...ref, state: REF_STATES.AMBIGUOUS, hosts: hits.map(h => `${h.file}:${h.line}`) };
  }
  return { ...ref, state: REF_STATES.RESOLVED, host: hits[0].file, hostLine: hits[0].line };
}

/**
 * Η λογιστική ενοτήτων ενός εγγράφου: κάθε `##` ενότητα δηλώνεται, κάθε δήλωση υπάρχει.
 * Οι υπο-ενότητες (`###`+) ανήκουν στον πρόγονό τους και **δεν** δηλώνονται ξεχωριστά.
 */
function auditSectionLedger(file) {
  if (!file.fm || !Array.isArray(file.fm.sections)) {
    return [{ state: DOC_STATES.UNBONDED, file: file.rel }];
  }
  const declared = new Set(file.fm.sections.map(normId));
  const present = new Set(file.headings.filter(h => h.level === 2).map(h => h.id));
  const out = [];

  for (const id of present) {
    if (!declared.has(id)) out.push({ state: DOC_STATES.ORPHAN_SECTION, file: file.rel, section: id, why: 'υπάρχει, δεν δηλώνεται' });
  }
  for (const id of declared) {
    if (!present.has(id)) out.push({ state: DOC_STATES.ORPHAN_SECTION, file: file.rel, section: id, why: 'δηλώνεται, δεν υπάρχει' });
  }
  return out.length > 0 ? out : [{ state: DOC_STATES.BONDED, file: file.rel }];
}

/**
 * Η **ΑΙΤΙΑ**, όχι το σύμπτωμα: δύο επικεφαλίδες με το ίδιο ID.
 *
 * ⚠️ Χρειάζεται **ξεχωριστά** από το `ambiguous-section`, και ο λόγος μετρήθηκε: το
 * `§48.10` υπάρχει **δύο φορές** στο ADR-739 και **κανείς δεν το αναφέρει** ⇒ η κρίση
 * επιπέδου δείκτη το βλέπει **μόνο όταν κάποιος πέσει πάνω του**. Ένας φρουρός που
 * περιμένει θύμα για να μιλήσει δεν είναι φρουρός.
 */
function auditDuplicateHeadings(family) {
  const out = [];
  for (const [id, hits] of family.byId) {
    if (hits.length < 2) continue;
    out.push({
      state: DOC_STATES.DUPLICATE_HEADING,
      file: hits[0].file,
      family: family.id,
      section: id,
      why: `${hits.length} επικεφαλίδες με το ίδιο ID (${hits.map(h => `γρ.${h.line}`).join(', ')})`,
    });
  }
  return out;
}

/** Ο δεσμός γονέα↔παιδιού: υπαρκτός `parent` **και** αντίστροφο ζεύγος στον γονέα. */
function auditBonds(family) {
  const out = [];
  const hub = family.files.find(f => f.rel === family.cfg.hub);
  const hubLinks = (hub && hub.fm && hub.fm.links) || [];

  for (const file of family.files) {
    if (file.rel === family.cfg.hub || file.missing || !file.fm) continue;
    const childId = file.fm.id;
    if (!file.fm.parent) {
      out.push({ state: DOC_STATES.BROKEN_BOND, file: file.rel, why: 'λείπει το parent:' });
      continue;
    }
    if (normId(file.fm.parent) !== family.id) {
      out.push({ state: DOC_STATES.BROKEN_BOND, file: file.rel, why: `parent: «${file.fm.parent}» ≠ ${family.id}` });
      continue;
    }
    const forward = hubLinks.find(l => l.target === childId);
    if (!forward) {
      out.push({ state: DOC_STATES.BROKEN_BOND, file: file.rel, why: `ο hub δεν δηλώνει δεσμό προς ${childId}` });
      continue;
    }
    const expected = BOND_INVERSE[forward.kind];
    if (!expected) {
      out.push({ state: DOC_STATES.BROKEN_BOND, file: file.rel, why: `άγνωστο είδος δεσμού «${forward.kind}»` });
      continue;
    }
    const back = (file.fm.links || []).find(l => l.kind === expected && normId(l.target) === family.id);
    if (!back) out.push({ state: DOC_STATES.BROKEN_BOND, file: file.rel, why: `λείπει ο αντίστροφος δεσμός «${expected}» προς ${family.id}` });
  }
  return out;
}

/** 🔴 Κλειστή λογιστική, fail-closed: άγνωστη κατάσταση ⇒ `throw` ΜΕ ΟΝΟΜΑ. */
function tally(findings, order, label) {
  const ledger = Object.fromEntries(order.map(s => [s, 0]));
  for (const f of findings) {
    if (!(f.state in ledger)) throw new Error(`CHECK 3.53: άγνωστη κατάσταση «${f.state}» στη λογιστική ${label}`);
    ledger[f.state] += 1;
  }
  const summed = order.reduce((a, s) => a + ledger[s], 0);
  if (summed !== findings.length) {
    throw new Error(`CHECK 3.53: η λογιστική ${label} δεν κλείνει (${summed} ≠ ${findings.length})`);
  }
  return ledger;
}

module.exports = {
  REF_STATES, REF_BLOCKING, REF_RATCHETED, REF_ORDER,
  DOC_STATES, DOC_BLOCKING, DOC_RATCHETED, DOC_ORDER, BOND_INVERSE,
  normId, buildFamily, appearsInProse, classifyRef, auditSectionLedger,
  auditDuplicateHeadings, auditBonds, tally,
};
