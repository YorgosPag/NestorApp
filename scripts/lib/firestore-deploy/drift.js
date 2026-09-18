/**
 * ADR-865 §10 — Η ΚΡΙΣΗ ΤΟΥ ΖΩΝΤΑΝΟΥ: «ό,τι τρέχει ΤΩΡΑ στο Firebase είναι ό,τι λέει το δέντρο —
 * και είναι ΔΙΑΘΕΣΙΜΟ;»
 *
 * **Καθαρή**: δέχεται το επιθυμητό (δέντρο + μητρώο, από το `world.js`) και το ζωντανό (από το
 * `live.js`) και επιστρέφει ετυμηγορίες. Κανένα δίκτυο, κανένας δίσκος — η σουίτα κρίνει **την
 * ίδια** συνάρτηση με το CLI, με κόσμους φτιαγμένους στο χέρι (σχήμα `judge.js`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΑΞΟΝΕΣ, ΟΧΙ ΕΝΑΣ — Argo CD: `sync status` ≠ `health status`
 * ────────────────────────────────────────────────────────────────────────────
 * | Άξονας | Ερώτηση | Τιμές |
 * |---|---|---|
 * | **Sync**   | είναι οι **ορισμοί** ίδιοι με το δέντρο; | `Synced` · `OutOfSync` · `Unknown` |
 * | **Health** | είναι ό,τι ορίστηκε **διαθέσιμο**;         | `Healthy` · `Progressing` · `Degraded` · `Unknown` |
 *
 * 🔴 Ο δεύτερος άξονας **έλειπε, και ψευδόταν**: το παλιό `--verify` τύπωνε *«ένας ΝΕΟΣ δείκτης
 * χτίζεται (CREATING)»* ως **σταθερό κείμενο** — το `firebase firestore:indexes` που ρωτούσε
 * **δεν επιστρέφει καν** κατάσταση (μετρημένο 2026-09-18). Δείκτης σε `CREATING` είναι
 * `Synced` **και** `Progressing`: υπάρχει ο ορισμός, το ερώτημα **αποτυγχάνει** (ADR-845 §Ο-18).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΤΑΥΤΙΣΗ ΔΕΙΚΤΩΝ ΕΙΝΑΙ ΤΟΥ DEPLOYER, ΟΧΙ ΔΙΚΗ ΜΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο επαληθευτής πρέπει να ρωτά **ό,τι ρωτά αυτός που γράφει** — αλλιώς κρίνει άλλο πράγμα από
 * εκείνο που ανεβαίνει. Οι κανόνες εδώ είναι **αυτούσιοι** του firebase-tools 15.13.0,
 * `lib/firestore/api.js`: `processIndex` (το σιωπηρό `__name__` παίρνει την κατεύθυνση του
 * **τελευταίου πεδίου με `order`**, προεπιλογή ASC· πριν από διανυσματικό πεδίο μπαίνει πριν
 * από αυτό), `indexMatchesSpec` (προεπιλογές `apiScope=ANY_API`, `density=SPARSE_ALL` στη
 * STANDARD έκδοση, `multikey=false`) και `fieldMatchesSpec`.
 *
 * @module scripts/lib/firestore-deploy/drift
 */

'use strict';

const { stableStringify, normalizeEol } = require('./model');

const SYNC = Object.freeze({ SYNCED: 'Synced', OUT_OF_SYNC: 'OutOfSync', UNKNOWN: 'Unknown' });
const HEALTH = Object.freeze({
  HEALTHY: 'Healthy', PROGRESSING: 'Progressing', DEGRADED: 'Degraded', UNKNOWN: 'Unknown',
});

/**
 * **Κωδικοί εξόδου** — επέκταση του `terraform plan -detailed-exitcode` (0 · 1 · 2) με τον άξονα
 * υγείας, που το Terraform δεν έχει. Προτεραιότητα: σφάλμα > απόκλιση > βλάβη > σε εξέλιξη.
 */
const EXIT = Object.freeze({ OK: 0, ERROR: 1, DRIFT: 2, PROGRESSING: 3, DEGRADED: 4 });

/** Από πού προέρχεται το ζωντανό — η τρίτη διάσταση, που δεν δίνει κανένα από τα δύο εργαλεία. */
const ORIGIN = Object.freeze({
  TREE: 'tree',                 // ζωντανό = δέντρο
  RECORDED: 'recorded',         // ζωντανό = η τελευταία ΚΑΤΑΓΕΓΡΑΜΜΕΝΗ ανάπτυξη· το δέντρο προχώρησε
  FOREIGN: 'foreign',           // ζωντανό = τίποτα από τα δύο ⇒ άλλαξε ΕΞΩ από το εργαλείο
  UNATTRIBUTABLE: 'unattributable', // η καταγεγραμμένη ανάπτυξη δεν ανασυντίθεται από το git
  HISTORY: 'history',           // ζωντανό = ΠΑΛΑΙΟΤΕΡΗ έκδοση του δέντρου (@commit) — §11: η γραμμή παραγωγής
});

// ============================================================================
// ΚΑΝΟΝΕΣ — ΣΥΓΚΡΙΣΗ ΠΕΡΙΕΧΟΜΕΝΟΥ, ΜΕ ΑΠΟΔΟΣΗ ΠΡΟΕΛΕΥΣΗΣ
// ============================================================================

/** Το περιεχόμενο που τρέχει: ένα αρχείο ruleset, αλλιώς `null` (δεν το στέλνει ποτέ έτσι το CLI). */
function liveContent(live) {
  const files = live.files || [];
  return files.length === 1 ? files[0].content : null;
}

/** Ίδια **σημασία** — modulo αλλαγές γραμμής (`normalizeEol`, ADR-865 §11). */
const sameRules = (a, b) => a !== null && b !== null && normalizeEol(a) === normalizeEol(b);

function originOf(content, desired) {
  if (sameRules(content, desired.wire)) return ORIGIN.TREE;
  const recorded = desired.recorded;
  if (recorded && recorded.wire === null) return ORIGIN.UNATTRIBUTABLE;
  if (recorded && sameRules(recorded.wire, content)) return ORIGIN.RECORDED;
  return ORIGIN.FOREIGN;
}

/**
 * **Ένας στόχος κανόνων.** Η σύγκριση είναι **περιεχομένου** — τα bytes που τρέχουν έναντι
 * της **φρέσκιας μεταγλώττισης** της πηγής, όχι του untracked `.compiled` στον δίσκο — γιατί
 * αυτό αποδεικνύει «δέντρο = παραγωγή», ενώ το artifact θα απέδειχνε μόνο «artifact = παραγωγή».
 *
 * Οι κανόνες δεν έχουν ενδιάμεση κατάσταση: το release αλλάζει **ατομικά** ⇒ `Healthy` όταν
 * απαντά ο πάροχος.
 */
function judgeRules(target, desired, live) {
  if (live.error) {
    return { target, sync: SYNC.UNKNOWN, health: HEALTH.UNKNOWN, origin: null, detail: live.error };
  }
  if (live.rulesetName === null) {
    return { target, sync: SYNC.OUT_OF_SYNC, health: HEALTH.HEALTHY, origin: null,
      detail: `το release «${live.release}» δεν υπάρχει — ο στόχος δεν αναπτύχθηκε ΠΟΤΕ` };
  }
  const content = liveContent(live);
  if (content === null) {
    return { target, sync: SYNC.OUT_OF_SYNC, health: HEALTH.HEALTHY, origin: ORIGIN.FOREIGN,
      detail: `το ruleset έχει ${(live.files || []).length} αρχεία — το CLI στέλνει πάντα ΕΝΑ` };
  }
  const origin = originOf(content, desired);
  return {
    target,
    sync: origin === ORIGIN.TREE ? SYNC.SYNCED : SYNC.OUT_OF_SYNC,
    health: HEALTH.HEALTHY,
    origin,
    detail: rulesDetail(origin, desired, live),
  };
}

/** Σημείωση όταν ταιριάζει η σημασία αλλά όχι τα bytes — ορατή, ποτέ σιωπηλή. */
const eolNote = (content, wire) => (content === wire ? '' : ' · διαφορά ΜΟΝΟ σε αλλαγές γραμμής (CRLF/LF)');

function rulesDetail(origin, desired, live) {
  const since = `release ${live.updateTime ?? ';'} · ${live.rulesetName.split('/').pop()}`;
  const rec = desired.recorded;
  switch (origin) {
    case ORIGIN.TREE:
      return rec && rec.digest !== desired.digest
        ? `${since}${eolNote(liveContent(live), desired.wire)} · ζωντανό = δέντρο· το τοπικό μητρώο δεν `
          + 'το κατέγραψε (γραμμή παραγωγής ⇒ GitHub Deployments, ή ανάπτυξη εκτός εργαλείου)'
        : `${since}${eolNote(liveContent(live), desired.wire)}`;
    case ORIGIN.RECORDED:
      return `${since} · τρέχει η ανάπτυξη της ${rec.at} (@${rec.commit}) — το δέντρο προχώρησε, `
        + 'εκκρεμεί ανάπτυξη';
    case ORIGIN.UNATTRIBUTABLE:
      return `${since} · ≠ δέντρο· η ανάπτυξη της ${rec.at} δεν ανασυντίθεται (${rec.why})`;
    default:
      return `${since} · ≠ δέντρο ΚΑΙ ≠ κάθε καταγεγραμμένη ανάπτυξη — άλλαξε ΕΞΩ από το `
        + 'εργαλείο (Console · rollback · άλλο δέντρο)';
  }
}

/**
 * **Δεύτερη φάση της απόδοσης προέλευσης** (ADR-865 §11). Η γραμμή παραγωγής αναπτύσσει
 * **μόνο δεσμευμένα** bytes ⇒ ό,τι έστειλε **υπάρχει στο ιστορικό του git**, χωρίς γραμμή στο
 * τοπικό μητρώο. Ένα `foreign`/`unattributable` που βρίσκεται στο ιστορικό **δεν** είναι ξένο.
 *
 * Καθαρή: την αναζήτηση στο git την κάνει ο καλών (`world.attributeFromHistory`) — εδώ μόνο η
 * κρίση, ώστε η σουίτα να την ελέγχει με ιστορικό φτιαγμένο στο χέρι.
 * @param {object} verdict ετυμηγορία κανόνων από `judgeRules`
 * @param {{commit:string, at:string}|null} found το commit του οποίου τα bytes = ζωντανό
 */
function withHistory(verdict, found) {
  const attributable = verdict.origin === ORIGIN.FOREIGN || verdict.origin === ORIGIN.UNATTRIBUTABLE;
  if (!attributable || found === null) return verdict;
  const since = verdict.detail.split(' · ').slice(0, 2).join(' · ');
  return {
    ...verdict,
    origin: ORIGIN.HISTORY,
    detail: `${since} · τρέχει η έκδοση του δέντρου @${found.commit} (${found.at}) — το δέντρο `
      + 'προχώρησε, εκκρεμεί ανάπτυξη',
  };
}

// ============================================================================
// ΔΕΙΚΤΕΣ — ΤΑΥΤΙΣΗ ΤΟΥ firebase-tools
// ============================================================================

/** `FirestoreApi.lastIndexFieldOrder`: το `order` του **τελευταίου** πεδίου που έχει, αλλιώς ASC. */
function lastIndexFieldOrder(fields) {
  let order = 'ASCENDING';
  for (const field of fields) if (field.order) order = field.order;
  return order;
}

/** `FirestoreApi.processIndex`: προσθέτει το σιωπηρό `__name__` όπως το προσθέτει ο διακομιστής. */
function withImplicitName(fields) {
  const out = [...fields];
  const suffix = { fieldPath: '__name__', order: lastIndexFieldOrder(fields) };
  const last = out[out.length - 1];
  if (last && last.vectorConfig) {
    const vector = out.pop();
    if (out.length === 0 || out[out.length - 1].fieldPath !== '__name__') out.push(suffix);
    out.push(vector);
    return out;
  }
  if (!last || last.fieldPath !== '__name__') out.push(suffix);
  return out;
}

const DEFAULT_DENSITY = Object.freeze({ STANDARD: 'SPARSE_ALL', ENTERPRISE: 'DENSE' });

const fieldIdentity = (f) =>
  [f.fieldPath, f.order ?? '', f.arrayConfig ?? '', f.vectorConfig ? stableStringify(f.vectorConfig) : ''].join('~');

/**
 * **Η ταυτότητα ενός δείκτη** — ίδια για τη γραμμή του αρχείου και για τον ζωντανό, ώστε η
 * ταύτιση να είναι σύγκριση συνόλων. Ισοδύναμη με το `indexMatchesSpec` (οι προεπιλογές
 * εφαρμόζονται **και στις δύο** πλευρές, όπως το `optionalValueMatches`).
 */
function indexIdentity(index, edition) {
  const standard = edition !== 'ENTERPRISE';
  const fields = standard ? withImplicitName(index.fields || []) : index.fields || [];
  return [
    index.collectionGroup,
    index.queryScope,
    index.apiScope ?? 'ANY_API',
    index.density ?? DEFAULT_DENSITY[standard ? 'STANDARD' : 'ENTERPRISE'],
    String(index.multikey ?? false),
    fields.map(fieldIdentity).join(','),
  ].join('|');
}

/** Αναγνώσιμο όνομα δείκτη για τον άνθρωπο — χωρίς το σιωπηρό `__name__`. */
function indexLabel(index) {
  const arrow = { ASCENDING: '↑', DESCENDING: '↓' };
  const fields = (index.fields || []).filter((f) => f.fieldPath !== '__name__')
    .map((f) => `${f.fieldPath}${arrow[f.order] ?? (f.arrayConfig ? '[]' : '⋯')}`);
  const scope = index.queryScope === 'COLLECTION_GROUP' ? ' (group)' : '';
  return `${index.collectionGroup}${scope}: ${fields.join(', ')}`;
}

/** Υγεία από κατάσταση δείκτη (Admin API `Index.State` / `TtlConfig.State`). */
function healthOfState(state) {
  if (state === 'READY' || state === 'ACTIVE') return HEALTH.HEALTHY;
  if (state === 'CREATING') return HEALTH.PROGRESSING;
  if (state === 'NEEDS_REPAIR') return HEALTH.DEGRADED;
  return HEALTH.UNKNOWN;
}

/** Η χειρότερη υγεία ενός συνόλου — `Degraded` > `Unknown` > `Progressing` > `Healthy`. */
function worstHealth(healths) {
  for (const h of [HEALTH.DEGRADED, HEALTH.UNKNOWN, HEALTH.PROGRESSING]) {
    if (healths.includes(h)) return h;
  }
  return HEALTH.HEALTHY;
}

function diffIndexes(spec, live, edition) {
  const liveById = new Map(live.map((i) => [indexIdentity(i, edition), i]));
  const specIds = new Set(spec.map((i) => indexIdentity(i, edition)));
  return {
    missing: spec.filter((i) => !liveById.has(indexIdentity(i, edition))).map(indexLabel),
    extra: live.filter((i) => !specIds.has(indexIdentity(i, edition))).map(indexLabel),
    notReady: live.filter((i) => healthOfState(i.state) !== HEALTH.HEALTHY)
      .map((i) => ({ label: indexLabel(i), state: i.state ?? 'STATE_UNSPECIFIED' })),
  };
}

// ============================================================================
// FIELD OVERRIDES — `fieldMatchesSpec`
// ============================================================================

const overrideKey = (o) => `${o.collectionGroup}.${o.fieldPath}`;
const modeOf = (i) => i.order || i.arrayConfig;

/** `FirestoreApi.fieldMatchesSpec`: TTL (όταν δηλώνεται) + **σύνολο** τρόπων δεικτοδότησης. */
function overrideMatches(live, spec) {
  if (spec.ttl !== undefined && Boolean(live.ttlState) !== spec.ttl) return false;
  const liveModes = live.indexes.map((i) => modeOf(i.fields[0]));
  const specModes = (spec.indexes || []).map(modeOf);
  if (liveModes.length !== specModes.length) return false;
  return liveModes.every((m) => specModes.includes(m));
}

function overrideStates(live) {
  const states = live.indexes.map((i) => i.state);
  if (live.ttlState) states.push(live.ttlState);
  return states;
}

function diffOverrides(spec, live) {
  const liveByKey = new Map(live.map((o) => [overrideKey(o), o]));
  const specKeys = new Set(spec.map(overrideKey));
  const missing = [];
  for (const s of spec) {
    const l = liveByKey.get(overrideKey(s));
    if (!l || !overrideMatches(l, s)) missing.push(`${overrideKey(s)}${s.ttl ? ' (TTL)' : ''}`);
  }
  const notReady = [];
  for (const l of live) {
    for (const state of overrideStates(l)) {
      if (healthOfState(state) !== HEALTH.HEALTHY) notReady.push({ label: overrideKey(l), state });
    }
  }
  return { missing, extra: live.filter((l) => !specKeys.has(overrideKey(l))).map(overrideKey), notReady };
}

/**
 * **Ο στόχος των δεικτών.** `extra` = ζωντανοί που **δεν** είναι στο αρχείο: ο επόμενος
 * `firebase deploy` θα ζητήσει να τους **σβήσει** — απόκλιση, όχι θόρυβος.
 */
function judgeIndexes(target, spec, live) {
  if (live.error) {
    return { target, sync: SYNC.UNKNOWN, health: HEALTH.UNKNOWN, origin: null, detail: live.error };
  }
  const idx = diffIndexes(spec.indexes, live.indexes, live.edition);
  const ovr = diffOverrides(spec.fieldOverrides, live.fieldOverrides);
  const missing = [...idx.missing, ...ovr.missing];
  const extra = [...idx.extra, ...ovr.extra];
  const notReady = [...idx.notReady, ...ovr.notReady];
  return {
    target,
    sync: missing.length === 0 && extra.length === 0 ? SYNC.SYNCED : SYNC.OUT_OF_SYNC,
    health: worstHealth(notReady.map((n) => healthOfState(n.state))),
    origin: null,
    detail: `ζωντανά ${live.indexes.length} · αρχείο ${spec.indexes.length} · overrides `
      + `${live.fieldOverrides.length}/${spec.fieldOverrides.length} · έκδοση ${live.edition}`,
    missing,
    extra,
    notReady,
  };
}

// ============================================================================
// Η ΚΡΙΣΗ
// ============================================================================

function exitCodeOf(verdicts) {
  if (verdicts.some((v) => v.sync === SYNC.UNKNOWN)) return EXIT.ERROR;
  if (verdicts.some((v) => v.sync === SYNC.OUT_OF_SYNC)) return EXIT.DRIFT;
  if (verdicts.some((v) => v.health === HEALTH.DEGRADED || v.health === HEALTH.UNKNOWN)) return EXIT.DEGRADED;
  if (verdicts.some((v) => v.health === HEALTH.PROGRESSING)) return EXIT.PROGRESSING;
  return EXIT.OK;
}

/**
 * @param {object} desired `world.loadDesired()` — ανά στόχο `{kind:'ruleset', wire, digest,
 *   recorded}` ή `{kind:'indexes', indexes, fieldOverrides}`.
 * @param {object} live `live.loadLiveWorld()` — ανά στόχο το ζωντανό, ή `{error}`.
 * @returns {{verdicts: object[], exitCode: number}}
 */
function judgeLive(desired, live) {
  const verdicts = Object.keys(desired).map((target) => {
    const d = desired[target];
    const l = live[target] || { error: 'ο πάροχος δεν ρωτήθηκε για αυτόν τον στόχο' };
    return d.kind === 'indexes' ? judgeIndexes(target, d, l) : judgeRules(target, d, l);
  });
  return { verdicts, exitCode: exitCodeOf(verdicts) };
}

module.exports = {
  SYNC,
  HEALTH,
  EXIT,
  ORIGIN,
  judgeLive,
  judgeRules,
  withHistory,
  liveContent,
  judgeIndexes,
  indexIdentity,
  indexLabel,
  withImplicitName,
  healthOfState,
};
