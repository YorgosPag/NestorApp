/**
 * CHECK 3.65 — Η ΚΡΙΣΗ (ADR-800)
 *
 * Πέντε κατάστιχα, **διαφορετικός πληθυσμός το καθένα**, κλειστή λογιστική
 * fail-closed. Άγνωστη κατάσταση ⇒ `throw` **με όνομα**.
 */

'use strict';

const { GATE_STATES: S, MIN_REASON_LENGTH, isDistributable, loadDeclarations } = require('./contract.js');
const { readLockfile, bareVersion } = require('./lockfile.js');
const { readWorkspace, declaredDependencies } = require('./workspace.js');

const BLOCKING = Object.freeze([
  S.VERSION_SPLIT, S.REDECLARED,
  S.OVERRIDDEN_DECLARATION,
  S.UNLISTED_MANIFEST, S.ORPHAN_IMPORTER, S.LOCKFILE_DESYNC,
  S.UNREFERENCED_CATALOG,
  S.ORPHAN_DECLARATION, S.REASONLESS_DECLARATION,
]);

const tallyOf = (states) => Object.fromEntries(states.map((s) => [s, 0]));

/** Γ · ΜΕΛΗ — συμφωνεί η απογραφή του δίσκου με αυτήν του lockfile; */
function judgeMembers(members, importers, push) {
  const dirs = new Set(members.map((m) => m.dir));
  for (const dir of Object.keys(importers)) {
    if (!dirs.has(dir)) push(S.ORPHAN_IMPORTER, dir, 'importer του lockfile χωρίς package.json στον δίσκο');
  }
  for (const member of members) {
    const importer = importers[member.dir];
    if (!importer) {
      push(S.UNLISTED_MANIFEST, member.dir, 'package.json μέσα στα workspace globs που δεν είναι importer — τρέξε pnpm install');
      continue;
    }
    const declared = Object.keys(declaredDependencies(member.manifest)).sort();
    const locked = Object.keys(importer).sort();
    if (declared.join(' ') !== locked.join(' ')) {
      const only = (a, b) => a.filter((x) => !b.includes(x));
      push(S.LOCKFILE_DESYNC, member.dir,
        `manifest-lock: [${only(declared, locked).join(', ')}] · lock-manifest: [${only(locked, declared).join(', ')}]`);
      continue;
    }
    push(S.IN_CENSUS, member.dir, `${declared.length} εξαρτήσεις σε συμφωνία`);
  }
}

/** Β · ΔΗΛΩΣΕΙΣ — λέει το manifest ό,τι όντως έγινε; */
function judgeDeclarations(members, importers, push) {
  for (const member of members) {
    const importer = importers[member.dir];
    if (!importer) continue; // κρίθηκε ήδη στο κατάστιχο Γ
    for (const [name, range] of Object.entries(declaredDependencies(member.manifest))) {
      const entry = importer[name];
      if (!entry) continue; // κρίθηκε ήδη ως lockfile-desync
      if (entry.specifier !== range) {
        push(S.OVERRIDDEN_DECLARATION, `${member.dir} -> ${name}`,
          `το manifest δηλώνει ${range} αλλά εγκαταστάθηκε με ${entry.specifier} (pnpm.overrides)`);
      } else {
        push(S.HONOURED, `${member.dir} -> ${name}`, range);
      }
    }
  }
}

/** Τα μέλη που δηλώνουν ένα όνομα, χωρισμένα σε εσωτερικά και διανεμητέα. */
function declarersOf(members, name) {
  const internal = [];
  const distributable = [];
  for (const m of members) {
    if (!(name in declaredDependencies(m.manifest))) continue;
    (isDistributable(m.manifest) ? distributable : internal).push(m.dir);
  }
  return { internal, distributable };
}

/** Α · ΟΝΟΜΑΤΑ — μία έκδοση, ένα σημείο δήλωσης. */
function judgeNames(members, importers, declarations, push, usedDeclarations) {
  const names = new Set();
  for (const m of members) for (const n of Object.keys(declaredDependencies(m.manifest))) names.add(n);
  for (const name of [...names].sort()) {
    const versions = new Set();
    for (const imp of Object.values(importers)) {
      if (imp[name] && imp[name].version) versions.add(bareVersion(imp[name].version));
    }
    if (versions.size > 1) {
      push(S.VERSION_SPLIT, name, `εγκαταστάθηκαν ${[...versions].sort().join(' και ')}`);
      continue;
    }
    const { internal, distributable } = declarersOf(members, name);
    if (internal.length > 1) {
      if (declarations[name]) {
        usedDeclarations.add(name);
        push(S.DECLARED_SHARED, name, internal.join(' + '));
      } else {
        push(S.REDECLARED, name, `δηλώνεται από ${internal.join(' + ')} — μόνο ΕΝΑ εσωτερικό μέλος το κατέχει`);
      }
      continue;
    }
    if (distributable.length > 0 && internal.length + distributable.length > 1) {
      push(S.DISTRIBUTABLE_OWNED, name, `διανεμητέο: ${distributable.join(' + ')}`);
      continue;
    }
    push(S.SINGLE_SITE, name, internal[0] || distributable[0] || '-');
  }
}

/** Δ · ΚΑΤΑΛΟΓΟΣ — μια εγγραφή που δεν τη ζητά κανείς είναι διακοσμητική. */
function judgeCatalog(members, catalog, push) {
  const wanted = new Set();
  for (const m of members) {
    for (const [n, r] of Object.entries(declaredDependencies(m.manifest))) {
      if (typeof r === 'string' && r.startsWith('catalog:')) wanted.add(n);
    }
  }
  for (const name of Object.keys(catalog).sort()) {
    if (wanted.has(name)) push(S.CATALOG_REFERENCED, name, catalog[name]);
    else push(S.UNREFERENCED_CATALOG, name, `δηλώνει ${catalog[name]} και κανένα manifest δεν γράφει "catalog:"`);
  }
}

/** Ε · ΕΞΑΙΡΕΣΕΙΣ — κλειστό σύνολο με υποχρεωτικό λόγο. */
function judgeExceptions(declarations, used, push) {
  for (const [name, entry] of Object.entries(declarations).sort()) {
    const reason = entry && typeof entry === 'object' ? entry.reason : null;
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      push(S.REASONLESS_DECLARATION, name, `ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ και >=${MIN_REASON_LENGTH} χαρακτήρες`);
      continue;
    }
    if (!used.has(name)) {
      push(S.ORPHAN_DECLARATION, name, 'δεν εξαιρεί τίποτα πια - σβήσε τη δήλωση');
      continue;
    }
    push(S.DECLARATION_USED, name, reason);
  }
}

const LEDGER_STATES = Object.freeze({
  names: [S.VERSION_SPLIT, S.REDECLARED, S.DECLARED_SHARED, S.DISTRIBUTABLE_OWNED, S.SINGLE_SITE],
  declarations: [S.OVERRIDDEN_DECLARATION, S.HONOURED],
  members: [S.UNLISTED_MANIFEST, S.ORPHAN_IMPORTER, S.LOCKFILE_DESYNC, S.IN_CENSUS],
  catalog: [S.UNREFERENCED_CATALOG, S.CATALOG_REFERENCED],
  exceptions: [S.ORPHAN_DECLARATION, S.REASONLESS_DECLARATION, S.DECLARATION_USED],
});

function sweep(repoRoot) {
  const { members, catalog } = readWorkspace(repoRoot);
  const { importers } = readLockfile(repoRoot);
  const declarations = loadDeclarations(repoRoot);

  const ledgers = {};
  const rows = [];
  for (const [name, states] of Object.entries(LEDGER_STATES)) ledgers[name] = { tally: tallyOf(states), population: 0 };
  const pushTo = (ledger) => (state, id, detail) => {
    if (!LEDGER_STATES[ledger].includes(state)) throw new Error(`ΑΓΝΩΣΤΗ κατάσταση "${state}" στο καταστιχο ${ledger}`);
    ledgers[ledger].tally[state] += 1;
    rows.push({ ledger, state, id, detail });
  };

  const used = new Set();
  judgeMembers(members, importers, pushTo('members'));
  judgeDeclarations(members, importers, pushTo('declarations'));
  judgeNames(members, importers, declarations, pushTo('names'), used);
  judgeCatalog(members, catalog, pushTo('catalog'));
  judgeExceptions(declarations, used, pushTo('exceptions'));

  for (const [name, states] of Object.entries(LEDGER_STATES)) {
    ledgers[name].population = states.reduce((n, s) => n + ledgers[name].tally[s], 0);
  }
  const violations = rows.filter((r) => BLOCKING.includes(r.state));
  return { ledgers, rows, violations, members, importers, catalog, declarations };
}

module.exports = { BLOCKING, LEDGER_STATES, sweep };
