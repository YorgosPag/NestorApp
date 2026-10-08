/**
 * Η ΜΗΧΑΝΗ ΤΩΝ ΠΟΡΤΩΝ ΑΡΧΕΙΟΥ-ΥΛΙΚΟΥ (CHECK 3.76 Κ5+Κ6 · ADR-845 §7.17 Α6)
 *
 * Το ερώτημα και το απορριφθέν κριτήριο είναι γραμμένα στο `material-doors-contract.js`.
 *
 * 🔶 **ΔΗΛΩΜΕΝΑ ΟΡΙΑ** — η πύλη τα λέει, δεν τα κρύβει:
 * - Το Κ6 βλέπει **κυριολεκτικό** κλειδί. Spread, υπολογισμένο κλειδί ή έτοιμο αντικείμενο
 *   **δεν** φαίνονται. Δίχτυ: το `drifted` της βραδινής συμφιλίωσης (Α5).
 * - Η πύλη λέει *«καλεί τον βοηθό»*, όχι *«τον καλεί σωστά»* (για το σωστό ακίνητο). Αυτό το
 *   φυλάνε οι άγκυρες εκτέλεσης.
 *
 * ⚠️ Τα κλειστά σύνολα περνούν ως **παράμετροι με προεπιλογή** — αλλιώς η άγκυρα δεν μπορεί να
 * **μεταλλάξει την είσοδο** και αποδεικνύει μόνο ότι «σήμερα είναι πράσινο».
 *
 * @module scripts/lib/listing-model-custody/material-doors
 */

const { MIN_REASON_LENGTH } = require('./contract.js');
const { callsSymbol, definesSymbol, executableLines } = require('./lines.js');
const {
  DOOR_COVER,
  DOOR_STATES,
  HAND_WRITE,
  MATERIAL_DOORS,
  PUBLICATION_WRITERS,
  REFRESH_HELPERS,
  REGISTRY_STATES,
} = require('./material-doors-contract.js');

/** Ό,τι μπλοκάρει το commit — **κλειστό σύνολο**. */
const DOOR_BLOCKING = Object.freeze([
  DOOR_STATES.UNREGISTERED_DOOR,
  DOOR_STATES.UNREGISTERED_WRITER,
  DOOR_STATES.DOOR_WITHOUT_REFRESH,
  REGISTRY_STATES.ORPHAN_DOOR,
  REGISTRY_STATES.REASONLESS_DOOR,
  REGISTRY_STATES.ORPHAN_DOOR_SYMBOL,
]);

const DEFAULT_TABLES = Object.freeze({
  writers: PUBLICATION_WRITERS,
  helpers: REFRESH_HELPERS,
  doors: MATERIAL_DOORS,
});

/** Κ6 — γράφει αυτό το αρχείο πεδίο του κατηγορήματος **με το χέρι**; Τρεις όροι, μαζί. */
function writesPredicateByHand(lines) {
  const text = lines.join('\n');
  return lines.some((line) => HAND_WRITE.field.test(line)) && HAND_WRITE.road.test(text) && HAND_WRITE.verb.test(text);
}

function unregisteredVerdict(calledWriters, calledHelpers) {
  const called = [...calledWriters, ...calledHelpers];
  if (called.length === 0) {
    return {
      state: DOOR_STATES.UNREGISTERED_WRITER,
      symbols: [],
      detail: 'γράφει `classification` / `lifecycleState` / `publicationIdentity` ΜΕ ΤΟ ΧΕΡΙ και δεν είναι στο μητρώο',
    };
  }
  return {
    state: DOOR_STATES.UNREGISTERED_DOOR,
    symbols: called,
    detail: `καλεί ${called.join(' · ')} και δεν είναι στο μητρώο — ξαναπροβάλλει; πες το, με λόγο`,
  };
}

/** Η ταξινόμηση **ενός** αρχείου — μία ερώτηση, μία απάντηση. */
function classifyDoor(rel, source, tables = DEFAULT_TABLES) {
  const { writers, helpers, doors } = { ...DEFAULT_TABLES, ...tables };
  const lines = executableLines(source);
  const symbols = [...Object.keys(writers), ...Object.keys(helpers)];
  const called = (table) =>
    Object.keys(table).filter((s) => !definesSymbol(lines, s) && callsSymbol(lines, s));
  const calledWriters = called(writers);
  const calledHelpers = called(helpers);
  const all = [...calledWriters, ...calledHelpers];

  if (symbols.some((s) => definesSymbol(lines, s))) return { state: DOOR_STATES.DOOR_DEFINER, symbols: all };
  if (all.length === 0 && !writesPredicateByHand(lines)) return { state: DOOR_STATES.NOT_A_DOOR, symbols: [] };

  const entry = Object.hasOwn(doors, rel) ? doors[rel] : null;
  if (entry === null) return unregisteredVerdict(calledWriters, calledHelpers);
  if (entry.cover !== DOOR_COVER.REFRESH) return { state: DOOR_STATES.EXEMPT_DOOR, symbols: all };
  if (calledHelpers.length > 0) return { state: DOOR_STATES.DOOR, symbols: all };

  return {
    state: DOOR_STATES.DOOR_WITHOUT_REFRESH,
    symbols: all,
    detail: `δηλώνει «ξαναπροβάλλει» και δεν καλεί κανέναν από: ${Object.keys(helpers).join(' · ')}`,
  };
}

/** Το **μητρώο** κρίνεται χωριστά από τα αρχεία: σάπια εγγραφή, λόγος-βιτρίνα, νεκρό σύμβολο. */
function auditDoorRegistry(liveDoors, callerCount, tables = DEFAULT_TABLES) {
  const { writers, helpers, doors } = { ...DEFAULT_TABLES, ...tables };
  const findings = [];
  const covers = Object.values(DOOR_COVER);

  for (const [rel, entry] of Object.entries(doors)) {
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    if (reason.length < MIN_REASON_LENGTH || !covers.includes(entry?.cover)) {
      findings.push({ state: REGISTRY_STATES.REASONLESS_DOOR, rel, detail: 'λόγος < 40 χαρακτήρες ή άγνωστη κάλυψη' });
    }
    if (!liveDoors.has(rel)) {
      findings.push({
        state: REGISTRY_STATES.ORPHAN_DOOR,
        rel,
        detail: 'δηλωμένη πόρτα που ΔΕΝ αγγίζει πια το κατηγόρημα — το μητρώο σάπισε σιωπηλά',
      });
    }
  }
  for (const [symbol, why] of Object.entries({ ...writers, ...helpers })) {
    if ((callerCount.get(symbol) ?? 0) > 0) continue;
    findings.push({
      state: REGISTRY_STATES.ORPHAN_DOOR_SYMBOL,
      rel: symbol,
      detail: `μηδέν μη-test καλούντες — ο μηχανισμός είναι ΝΕΚΡΟΣ ενώ η πύλη θα έλεγε «καθαρό». ${why}`,
    });
  }
  return findings;
}

/**
 * Το πέρασμα των πορτών πάνω σε **ήδη διαβασμένα** αρχεία (`[{ rel, source }]`) — το `gate.js`
 * διαβάζει το δέντρο **μία** φορά και το δίνει και στα δύο σκέλη.
 */
function sweepDoors(files, tables = DEFAULT_TABLES) {
  const doorTally = Object.create(null);
  const violations = [];
  const liveDoors = new Set();
  const callerCount = new Map();
  const live = [DOOR_STATES.DOOR, DOOR_STATES.EXEMPT_DOOR, DOOR_STATES.DOOR_WITHOUT_REFRESH];

  for (const { rel, source } of files) {
    const verdict = classifyDoor(rel, source, tables);
    doorTally[verdict.state] = (doorTally[verdict.state] ?? 0) + 1;
    for (const symbol of verdict.symbols) callerCount.set(symbol, (callerCount.get(symbol) ?? 0) + 1);
    if (live.includes(verdict.state)) liveDoors.add(rel);
    if (DOOR_BLOCKING.includes(verdict.state)) {
      violations.push({ state: verdict.state, rel, detail: verdict.detail ?? '' });
    }
  }

  const registryFindings = auditDoorRegistry(liveDoors, callerCount, tables);
  const registryTally = Object.create(null);
  for (const f of registryFindings) registryTally[f.state] = (registryTally[f.state] ?? 0) + 1;
  registryTally[REGISTRY_STATES.REGISTRY_HEALTHY] = registryFindings.length === 0 ? 1 : 0;

  return { doorTally, registryTally, violations: [...violations, ...registryFindings] };
}

module.exports = {
  DOOR_BLOCKING,
  auditDoorRegistry,
  classifyDoor,
  sweepDoors,
  writesPredicateByHand,
};
