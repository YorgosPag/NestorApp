'use strict';

/**
 * ADR-757 / CHECK 3.37 — Ο έλεγχος κάλυψης της ιεράρχησης πυλών.
 *
 * ΤΟ ΣΥΜΒΑΝ ΠΟΥ ΤΟΝ ΓΕΝΝΗΣΕ (05/08/2026): ο συγκεντρωτής `ci-health-report.yml` κρατούσε
 * ΧΕΙΡΟΓΡΑΦΗ λίστα 18 workflows με το σχόλιο «adding a new gate = add its name below».
 * Επτά πύλες είχαν προστεθεί έκτοτε χωρίς να μπουν στη λίστα — ανάμεσά τους το
 * `Build & Deploy Docker Image`, η ΜΟΝΑΔΙΚΗ πύλη που φράζει την παραγωγή. Όταν το Netcup
 * σταμάτησε να δέχεται, το αρχείο που αυτοπεριγράφεται ως «durable SSoT of CI failures»
 * ΔΕΝ το κατέγραψε καν. Ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34: δύο
 * χειρόγραφοι κατάλογοι για το ίδιο πράγμα, χωρίς πύλη που να τους συγκρίνει.
 *
 * ΔΕΝ ΕΙΝΑΙ RATCHET — καμία baseline, ποτέ. Μια πύλη είτε παρακολουθείται είτε όχι· ένα
 * «ανεκτό πλήθος απαρατήρητων πυλών» είναι ανεκτό πλήθος αόρατων αποτυχιών παραγωγής.
 */

const fs = require('fs');
const path = require('path');

const {
  listWorkflowFiles,
  readWorkflowName,
  readWorkflowRunWatchList,
} = require('./workflow-meta');

const VALID_TIERS = [1, 2, 3];

/**
 * Οι ΡΗΤΕΣ καταστάσεις. Καμία σιωπηλή απόρριψη: ό,τι δεν ταιριάζει παίρνει όνομα εδώ.
 * Το κείμενο είναι το μήνυμα που διαβάζει ο άνθρωπος όταν μπλοκάρει το commit.
 */
const STATES = {
  'unregistered': 'workflow χωρίς tier στο μητρώο ⇒ καμία πολιτική ειδοποίησης',
  'orphan-registry': 'εγγραφή μητρώου χωρίς αρχείο workflow ⇒ νεκρός φρουρός',
  'name-drift': 'το μητρώο και το αρχείο διαφωνούν στο όνομα ⇒ ο συγκεντρωτής δεν θα ταιριάξει ποτέ',
  'tier-prefix-drift': 'το όνομα δεν φέρει το πρόθεμα του tier ⇒ το email δεν ξεχωρίζεται',
  'unwatched-tier1': 'Tier 1 εκτός της λίστας του συγκεντρωτή ⇒ ΑΟΡΑΤΗ αποτυχία παραγωγής',
  'ghost-watch': 'ο συγκεντρωτής παρακολουθεί όνομα που δεν υπάρχει ⇒ σιωπηλά ανενεργό',
  'watch-not-tier1': 'ο συγκεντρωτής παρακολουθεί μη-Tier-1 πύλη ⇒ περιττά runner-λεπτά σε κάθε push',
  'invalid-entry': 'ελλιπής ή διπλή εγγραφή μητρώου',
  'no-tier1': 'κανένα Tier 1 ⇒ ιεράρχηση χωρίς κορυφή',
};

function finding(state, subject, detail) {
  return { state, subject, detail, meaning: STATES[state] };
}

/**
 * Δομικός έλεγχος του ΙΔΙΟΥ του μητρώου (πριν κοιταχτεί ο δίσκος).
 * @param {{gates: unknown}} registry
 * @returns {ReturnType<typeof finding>[]}
 */
function auditRegistryShape(registry) {
  const findings = [];
  const gates = Array.isArray(registry.gates) ? registry.gates : [];
  const seenFiles = new Set();
  const seenNames = new Set();

  for (const gate of gates) {
    const label = gate.file || gate.name || JSON.stringify(gate);
    if (!gate.file || !gate.name) {
      findings.push(finding('invalid-entry', label, 'λείπει `file` ή `name`'));
      continue;
    }
    if (!VALID_TIERS.includes(gate.tier)) {
      findings.push(finding('invalid-entry', label, `tier=${JSON.stringify(gate.tier)} — έγκυρα: 1, 2, 3`));
    }
    if (typeof gate.why !== 'string' || gate.why.trim().length === 0) {
      findings.push(finding('invalid-entry', label, 'λείπει `why` — το tier είναι απόφαση και θέλει αιτιολόγηση'));
    }
    if (seenFiles.has(gate.file)) findings.push(finding('invalid-entry', label, 'διπλό `file`'));
    if (seenNames.has(gate.name)) findings.push(finding('invalid-entry', label, 'διπλό `name`'));
    seenFiles.add(gate.file);
    seenNames.add(gate.name);
  }

  if (!gates.some((gate) => gate.tier === 1)) {
    findings.push(finding('no-tier1', '.ci-gate-tiers.json', 'καμία πύλη Tier 1'));
  }
  return findings;
}

/**
 * Μητρώο ↔ δίσκος: κάθε αρχείο έχει εγγραφή, κάθε εγγραφή έχει αρχείο, τα ονόματα
 * συμφωνούν, και το όνομα φέρει το πρόθεμα του tier του.
 */
function auditFilesystem(registry, workflowsDir) {
  const findings = [];
  const gatesByFile = new Map(registry.gates.map((gate) => [gate.file, gate]));
  const aggregatorFile = registry.aggregator.file;
  const prefixOf = (tier) => registry.namePrefix.replace('{tier}', String(tier));

  for (const file of listWorkflowFiles(workflowsDir)) {
    if (file === aggregatorFile) continue;
    const gate = gatesByFile.get(file);
    if (!gate) {
      findings.push(finding('unregistered', file, 'πρόσθεσέ το στο `.ci-gate-tiers.json` με tier + why'));
      continue;
    }
    const actual = readWorkflowName(path.join(workflowsDir, file));
    if (actual !== gate.name) {
      findings.push(finding('name-drift', file, `αρχείο: «${actual}» · μητρώο: «${gate.name}»`));
    }
    if (!actual.startsWith(prefixOf(gate.tier))) {
      findings.push(
        finding('tier-prefix-drift', file, `«${actual}» — αναμενόμενο πρόθεμα «${prefixOf(gate.tier)}»`)
      );
    }
  }

  for (const gate of registry.gates) {
    if (!fs.existsSync(path.join(workflowsDir, gate.file))) {
      findings.push(finding('orphan-registry', gate.file, 'το αρχείο δεν υπάρχει — μετονομάστηκε ή διαγράφηκε;'));
    }
  }
  return findings;
}

/**
 * Μητρώο ↔ λίστα παρακολούθησης του συγκεντρωτή.
 *
 * Η λίστα `on.workflow_run.workflows` περιέχει ΜΟΝΟ τα Tier 1 — και προς τις δύο
 * κατευθύνσεις. Το «λείπει» είναι αόρατη αποτυχία παραγωγής· το «περισσεύει» είναι ένα
 * επιπλέον τρέξιμο runner για κάθε ολοκλήρωση κάθε πύλης, σε κάθε push (26 πύλες × κάθε
 * push), τη στιγμή που η κατάσταση των Tier 2/3 προβάλλεται ούτως ή άλλως από το API.
 */
function auditWatchList(registry, workflowsDir) {
  const aggregatorPath = path.join(workflowsDir, registry.aggregator.file);
  if (!fs.existsSync(aggregatorPath)) {
    return [finding('orphan-registry', registry.aggregator.file, 'λείπει ο ίδιος ο συγκεντρωτής')];
  }

  const watched = new Set(readWorkflowRunWatchList(aggregatorPath));
  const tier1 = registry.gates.filter((gate) => gate.tier === 1);
  const tier1Names = new Set(tier1.map((gate) => gate.name));
  const knownNames = new Set(registry.gates.map((gate) => gate.name));
  const findings = [];

  for (const gate of tier1) {
    if (!watched.has(gate.name)) {
      findings.push(finding('unwatched-tier1', gate.name, `πρόσθεσέ το στο ${registry.aggregator.file}`));
    }
  }
  for (const name of watched) {
    if (!knownNames.has(name)) {
      findings.push(finding('ghost-watch', name, 'δεν αντιστοιχεί σε καμία εγγραφή μητρώου'));
    } else if (!tier1Names.has(name)) {
      findings.push(finding('watch-not-tier1', name, 'μόνο τα Tier 1 δικαιολογούν σκανδάλη ανά τρέξιμο'));
    }
  }
  return findings;
}

/**
 * @param {{ workflowsDir?: string, registryPath?: string }} [options]
 * @returns {{ registry: object, findings: ReturnType<typeof finding>[] }}
 */
function auditGateTiers(options = {}) {
  const repoRoot = options.repoRoot || path.join(__dirname, '..', '..', '..');
  const workflowsDir = options.workflowsDir || path.join(repoRoot, '.github', 'workflows');
  const registryPath = options.registryPath || path.join(repoRoot, '.ci-gate-tiers.json');

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const shapeFindings = auditRegistryShape(registry);

  // Οι έλεγχοι δίσκου προϋποθέτουν εγγραφές με σχήμα· αν το σχήμα είναι σπασμένο,
  // ό,τι ακολουθεί θα παρήγαγε παράγωγο θόρυβο αντί για την αιτία.
  if (shapeFindings.length > 0) return { registry, findings: shapeFindings };

  return {
    registry,
    findings: [...auditFilesystem(registry, workflowsDir), ...auditWatchList(registry, workflowsDir)],
  };
}

module.exports = { auditGateTiers, auditRegistryShape, auditFilesystem, auditWatchList, STATES, VALID_TIERS };
