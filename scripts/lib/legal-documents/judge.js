/**
 * ADR-861 Φ3 / CHECK 3.85 — Η ΚΡΙΣΗ: «είναι κάθε νομικό κείμενο που δείχνουμε ΜΙΑ
 * αμετάβλητη, αποδείξιμη έκδοση — και ξέρει κάθε έκδοση ποιος ήταν ο φορέας τότε;»
 *
 * **Καθαρή**: δέχεται τον «κόσμο» (μητρώο, αρχεία, `legal.json`, φορέα, `HEAD`) και επιστρέφει
 * ευρήματα. Ο δίσκος και το git ζουν στο CLI — έτσι η σουίτα κρίνει **την ίδια** συνάρτηση
 * με την πύλη, με κόσμους φτιαγμένους στο χέρι.
 *
 * | Κανόνας | Ερώτημα |
 * |---|---|
 * | **Κ1** | ταιριάζουν τα bytes κάθε παγωμένου αρχείου με το αποτύπωμα του μητρώου; |
 * | **Κ2** | είναι το ζωντανό κείμενο (`legal.json` + περίγραμμα) ίδιο με την **τελευταία** έκδοση; |
 * | **Κ3** | έμεινε **αμετάβλητη** κάθε γραμμή μητρώου που υπήρχε στο `HEAD`; |
 * | **Κ4** | είναι οι αριθμοί συνεχείς από το 1 και οι ημερομηνίες αύξουσες; |
 * | **Κ5** | φέρει κάθε έκδοση τον φορέα που **ίσχυε** την `effectiveFrom` της; (μάρτυρας append-only) |
 * | **Κ6** | έχει κάθε μεταγενέστερη αλλαγή φορέα **έκδοση** σε κάθε έγγραφο; |
 * | **Κ7** | είναι φρέσκο το παραγόμενο ευρετήριο εισαγωγών; |
 *
 * @module scripts/lib/legal-documents/judge
 */

'use strict';

const M = require('./model');

const RULES = Object.freeze({
  K1: 'frozen-bytes-mismatch',
  K2: 'text-changed-without-version',
  K3: 'published-version-altered',
  K4: 'version-sequence-broken',
  K5: 'operator-witness-mismatch',
  K6: 'operator-change-without-version',
  K7: 'index-stale',
});

const finding = (rule, document, version, detail) => ({ rule, document, version, detail });

const rowKey = (row) => M.stableStringify(row);

function judgeBytes(id, rows, world, out) {
  for (const row of rows) {
    const bytes = world.readFrozenBytes(id, row.version);
    if (bytes === null) {
      out.push(finding(RULES.K1, id, row.version, 'το παγωμένο αρχείο λείπει'));
    } else if (M.digestOf(bytes) !== row.digest) {
      out.push(finding(RULES.K1, id, row.version, `αποτύπωμα ${M.digestOf(bytes)} ≠ μητρώο ${row.digest}`));
    }
  }
}

function judgeSequence(id, rows, out) {
  rows.forEach((row, i) => {
    if (row.version !== i + 1) {
      out.push(finding(RULES.K4, id, row.version, `αναμενόταν έκδοση ${i + 1} στη θέση ${i + 1}`));
    }
    if (i > 0 && row.effectiveFrom < rows[i - 1].effectiveFrom) {
      out.push(finding(RULES.K4, id, row.version, `effectiveFrom ${row.effectiveFrom} πριν από την προηγούμενη`));
    }
  });
}

function parseFrozen(world, id, row) {
  const bytes = world.readFrozenBytes(id, row.version);
  if (bytes === null) return null;
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
}

function judgeOperatorWitness(id, rows, world, out) {
  for (const row of rows) {
    const frozen = parseFrozen(world, id, row);
    if (frozen === null) continue;
    const expected = world.operators.recordOn(row.effectiveFrom);
    const actual = frozen.operator ? frozen.operator.fingerprint : undefined;
    if (actual !== M.operatorFingerprint(expected)) {
      out.push(finding(RULES.K5, id, row.version,
        `ο φορέας της ${row.effectiveFrom} ΔΕΝ είναι αυτός που πάγωσε — άλλαξε δημοσιευμένη γραμμή του PLATFORM_OPERATORS; (διόρθωση = ΝΕΑ γραμμή)`));
    }
  }
}

function judgeOperatorChanges(id, rows, world, out) {
  if (rows.length === 0) return;
  const days = new Set(rows.map((r) => r.effectiveFrom));
  for (const record of world.operators.history) {
    if (record.effectiveFrom <= rows[0].effectiveFrom) continue;
    if (!days.has(record.effectiveFrom)) {
      out.push(finding(RULES.K6, id, null,
        `ο φορέας αλλάζει στις ${record.effectiveFrom} χωρίς έκδοση του εγγράφου εκείνη τη μέρα — npm run legal:freeze -- --document ${id} --effective-from ${record.effectiveFrom}`));
    }
  }
}

function judgeLiveText(id, rows, world, out) {
  if (rows.length === 0) {
    out.push(finding(RULES.K2, id, null, `το έγγραφο δεν έχει καμία έκδοση — npm run legal:freeze -- --document ${id}`));
    return;
  }
  const latest = rows[rows.length - 1];
  const frozen = parseFrozen(world, id, latest);
  if (frozen === null) return; // Κ1 το έχει ήδη αναφέρει.
  let live;
  try {
    live = M.resolveDocument(id, world.outlines[id], world.locales, world.legalByLocale);
  } catch (error) {
    out.push(finding(RULES.K2, id, null, error.message));
    return;
  }
  if (M.stableStringify(live) !== M.stableStringify(frozen.locales)) {
    out.push(finding(RULES.K2, id, latest.version,
      `το κείμενο άλλαξε μετά την έκδοση ${latest.version} — npm run legal:freeze -- --document ${id} --material|--minor`));
  }
}

function judgeHead(id, rows, world, out) {
  const before = world.headManifest && world.headManifest.documents ? world.headManifest.documents[id] : undefined;
  if (!Array.isArray(before)) return;
  for (const old of before) {
    const now = rows.find((r) => r.version === old.version);
    if (!now || rowKey(now) !== rowKey(old)) {
      out.push(finding(RULES.K3, id, old.version,
        'δημοσιευμένη έκδοση άλλαξε ή σβήστηκε — οι εκδόσεις είναι αμετάβλητες· διόρθωση = νέα έκδοση'));
    }
  }
}

/** @returns {Array<{rule:string, document:string, version:number|null, detail:string}>} */
function judgeLegalDocuments(world) {
  const out = [];
  const documents = (world.manifest && world.manifest.documents) || {};
  for (const id of world.ids) {
    const rows = Array.isArray(documents[id]) ? documents[id] : [];
    judgeBytes(id, rows, world, out);
    judgeSequence(id, rows, out);
    judgeHead(id, rows, world, out);
    judgeOperatorWitness(id, rows, world, out);
    judgeOperatorChanges(id, rows, world, out);
    judgeLiveText(id, rows, world, out);
  }
  for (const id of Object.keys(documents)) {
    if (!world.ids.includes(id)) out.push(finding(RULES.K4, id, null, 'έγγραφο στο μητρώο εκδόσεων που δεν υπάρχει στο LEGAL_DOCUMENT_IDS'));
  }
  if (world.indexText !== world.expectedIndexText) {
    out.push(finding(RULES.K7, '*', null, 'το index.generated.ts δεν αντιστοιχεί στο μητρώο — npm run legal:index'));
  }
  return out;
}

module.exports = { RULES, judgeLegalDocuments };
