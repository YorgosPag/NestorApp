#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §27 — ΤΑ ΚΑΤΑΣΤΙΧΑ ΤΩΝ ΤΕΜΠΕΛΙΚΩΝ ΔΙΑΔΡΟΜΩΝ
 * =============================================================================
 *
 * Ό,τι **δηλώνει άνθρωπος** για τον χάρτη `lazy-route-namespaces.json`, και η κρίση του:
 *
 *   `lazyRouteMountNamespaces` + `lazyRouteMountSeal`  η κλειστή απογραφή των ζευγών
 *       `(διαδρομή, namespace που φορτώνει ΜΟΝΟ στο mount)` και το σφραγισμένο πλήθος τους
 *   `lazyRouteOpaqueNamespaces`  η γραπτή απάντηση σε κάθε `useTranslation(<prop>)`
 *
 * ⛔ **ΚΑΜΙΑ ΜΕΤΡΗΣΗ BYTES ΕΔΩ, ΔΟΜΙΚΑ** (ίδια πειθαρχία με το `shell-census.js`, §23.3):
 * το φρένο είναι **ταυτότητα**. Η ακριβή αναμονή θεραπεύεται με διαχωρισμό κώδικα.
 *
 * Ο χάρτης **χτίζεται** στο `lazy-routes.js`· εδώ δεν υπάρχει γράφος ούτε ανάγνωση πηγής.
 *
 * @module scripts/lib/i18n-shell-slice/lazy-route-census
 */

'use strict';

const { isRegression, announceSlack } = require('../ratchet-baseline');

const LEDGER = 'lazyRouteMountNamespaces';
const SEAL = 'lazyRouteMountSeal';
const OPAQUE_LEDGER = 'lazyRouteOpaqueNamespaces';
// Το αρχείο του `SUPPORTED_NAMESPACES`. Ζει εδώ (χωρίς typescript) ώστε το μητρώο καθολικών
// εισόδων (`global-inputs.js`) να το δηλώνει χωρίς να φορτώσει τον parser (ADR-744 §30).
const LAZY_CONFIG = 'src/i18n/lazy-config.ts';

const CENSUS = Object.freeze({
  DECLARED: 'declared',
  UNDECLARED: 'awaited-but-undeclared',
  ABSENT: 'declared-but-not-awaited',
});

/** `κλειδί → namespaces που φορτώνουν ΜΟΝΟ στο mount` — μόνο όσα κλειδιά έχουν έστω ένα. */
function mountOnlyPairs(rows, boot) {
  const out = {};
  for (const key of Object.keys(rows).sort()) {
    const late = rows[key].filter(namespace => !boot.has(namespace)).sort();
    if (late.length > 0) out[key] = late;
  }
  return out;
}

const countPairs = pairs => Object.values(pairs).reduce((sum, list) => sum + list.length, 0);

/** Το σχήμα του κατάστιχου, κριμένο στη **φόρτωση** (ίδιος λόγος με τα αδέλφια του στο `config.js`). */
function parseMountLedger(ledger, name = LEDGER) {
  if (ledger === null || typeof ledger !== 'object' || Array.isArray(ledger)) {
    throw new Error(`${name}: απαιτείται { "<Κλειδί>": ["<namespace>", …] }.`);
  }
  for (const [key, list] of Object.entries(ledger)) {
    const valid = Array.isArray(list) && list.length > 0
      && list.every(item => typeof item === 'string' && item !== '')
      && new Set(list).size === list.length;
    if (!valid) {
      throw new Error(`${name}.${key}: απαιτείται μη κενός πίνακας ξεχωριστών namespaces — κενή εγγραφή σβήνεται, δεν αδειάζει.`);
    }
  }
  return ledger;
}

/**
 * Η **κλειστή απογραφή** των ζευγών εκτός εκκίνησης, και το σφραγισμένο πλήθος τους.
 *
 * ⚠️ **ΔΥΟ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (μάθημα CHECK 3.41, ίδιο με το `shell-census`):
 * Κ1 «κανένα ζεύγος δεν μπαίνει σιωπηλά» · Κ2 «το πλήθος μόνο συρρικνώνεται». Και οι
 * **δύο** κατευθύνσεις του Κ1 μπλοκάρουν: δήλωση που δεν αντιστοιχεί πια σε αναμονή
 * κρατά ψηλά το ταβάνι του Κ2 και χαρίζει μια δωρεάν θέση στο επόμενο ζεύγος.
 */
function auditMountCensus(declared, observed, seal) {
  const entries = [];
  for (const key of [...new Set([...Object.keys(declared), ...Object.keys(observed)])].sort()) {
    const want = new Set(declared[key] || []);
    const have = new Set(observed[key] || []);
    for (const namespace of [...new Set([...want, ...have])].sort()) {
      let verdict = CENSUS.DECLARED;
      if (!want.has(namespace)) verdict = CENSUS.UNDECLARED;
      else if (!have.has(namespace)) verdict = CENSUS.ABSENT;
      entries.push({ key, namespace, verdict });
    }
  }
  const count = countPairs(observed);
  return {
    entries,
    count,
    sealed: seal,
    failures: entries.filter(entry => entry.verdict !== CENSUS.DECLARED),
    grew: isRegression({ current: count, baseline: seal.count, direction: 'down' }),
  };
}

/**
 * Τα ονόματα ενός κατάστιχου που κρίνει αυτή η μηχανή. ADR-280 §11.8 Β4.2: η ΙΔΙΑ μηχανή κρίνει και το
 * χρέος εισδοχής (`surface-coverage.js`) — δεύτερη υλοποίηση της απογραφής θα ήταν δεύτερη λίστα που αποκλίνει.
 */
const MOUNT_LABELS = Object.freeze({ ledger: LEDGER, seal: SEAL, adr: 'ADR-744 §27', unit: 'ζεύγη (διαδρομή, namespace εκτός εκκίνησης)' });

/** @param {Map} [provenance] όταν υπάρχει (γεννήτορας), το μήνυμα **ονομάζει** ποιος σέρνει το namespace. */
function describeMountFailures(failures, provenance = new Map(), labels = MOUNT_LABELS) {
  return failures.map(failure => {
    const pair = `${failure.key} → ${failure.namespace}`;
    if (failure.verdict === CENSUS.ABSENT) {
      return `${pair}: δηλωμένο στο ${labels.ledger} αλλά ΔΕΝ περιμένεται πια — σβήσε το ζεύγος και ΚΑΤΕΒΑΣΕ τη σφράγιση`;
    }
    const from = (provenance.get(failure.key) && provenance.get(failure.key).get(failure.namespace)) || [];
    const who = from.length === 0 ? '' : ` — το ονομάζει: ${from.slice(0, 3).join(' · ')}${from.length > 3 ? ` (+${from.length - 3})` : ''}`;
    return `${pair}: ΝΕΑ ΑΝΑΜΟΝΗ εκτός εκκίνησης χωρίς δήλωση${who}. Κόψε την εισαγωγή (τεμπέλικη καρτέλα), ή δήλωσέ το ΚΑΙ σφράγισε ξανά με γραμμένο \`why\``;
  }).join(' · ');
}

function describeMountGrowth(audit, labels = MOUNT_LABELS) {
  return `${audit.count} ${labels.unit} έναντι σφραγισμένων `
    + `${audit.sealed.count} (${audit.sealed.at}) — ΜΟΝΟ ΣΥΡΡΙΚΝΩΝΕΤΑΙ. Κάθε ζεύγος είναι λήψη που η διαδρομή `
    + 'περιμένει πριν ζωγραφίσει· η θεραπεία είναι διαχωρισμός κώδικα, όχι μεγαλύτερος αριθμός.';
}

function announceMountSlack(audit, labels = MOUNT_LABELS) {
  const slack = audit.sealed.count - audit.count;
  if (slack <= 0) return [];
  return [announceSlack({
    adr: labels.adr,
    slack,
    detail: `${audit.count} ${labels.unit} έναντι σφράγισης ${audit.sealed.count} (${audit.sealed.at}) — ${slack} δωρεάν θέση/θέσεις`,
    command: `κατέβασε το \`${labels.seal}.count\` στο .i18n-shell-slice.json`,
  })].filter(line => line !== '');
}

/**
 * `{ '<αρχείο>': { namespaces: [...], reason } }` — η γραπτή απάντηση σε ένα
 * `useTranslation(<prop>)`. Το `namespaces` **επιτρέπεται κενό**: «η τιμή δηλώνεται ήδη
 * με κυριολεκτικό από όποιον τη δίνει» είναι έγκυρη απάντηση — αλλά μόνο **γραμμένη**.
 */
function parseOpaqueLedger(ledger) {
  if (ledger === null || typeof ledger !== 'object' || Array.isArray(ledger)) {
    throw new Error(`${OPAQUE_LEDGER}: απαιτείται { "<αρχείο>": { "namespaces": [...], "reason": "…" } }.`);
  }
  for (const [file, entry] of Object.entries(ledger)) {
    const at = `${OPAQUE_LEDGER}.${file}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${at}: άγνωστο σχήμα δήλωσης.`);
    if (!Array.isArray(entry.namespaces) || entry.namespaces.some(item => typeof item !== 'string' || item === '')) {
      throw new Error(`${at}.namespaces: απαιτείται πίνακας namespaces (κενός επιτρέπεται, με λόγο).`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
      throw new Error(`${at}.reason: λείπει ο λόγος — μια απάντηση χωρίς λόγο δεν ξαναελέγχεται ποτέ.`);
    }
  }
  return ledger;
}

module.exports = {
  LEDGER,
  SEAL,
  OPAQUE_LEDGER,
  LAZY_CONFIG,
  CENSUS,
  mountOnlyPairs,
  countPairs,
  parseMountLedger,
  parseOpaqueLedger,
  auditMountCensus,
  describeMountFailures,
  describeMountGrowth,
  announceMountSlack,
};
