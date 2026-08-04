'use strict';

/**
 * ADR-757 — Ο πυρήνας του πίνακα κατάστασης CI. ΚΑΘΑΡΕΣ συναρτήσεις: καμία κλήση δικτύου,
 * καμία ώρα από το ρολόι (όλα τα timestamps έρχονται ως όρισμα — ίδιος λόγος με το ADR-727:
 * ρολόι μέσα σε παραγόμενο περιεχόμενο απαγορεύει δομικά κάθε σύγκριση).
 *
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΤΑΙ ΕΔΩ: ο προηγούμενος συγκεντρωτής έκανε `createComment` σε
 * ΚΑΘΕ αποτυχία, χωρίς καμία κατάσταση. Με 8 μόνιμα κόκκινες πύλες αυτό σημαίνει 8 νέα
 * σχόλια σε κάθε push — η ίδια πλημμύρα, μετακομισμένη από το inbox στο Issue. Δεν ήταν
 * συγκέντρωση· ήταν ημερολόγιο.
 *
 * Η αρχή εδώ: **προβολή, όχι συσσώρευση.** Η κατάσταση ΞΑΝΑΫΠΟΛΟΓΙΖΕΤΑΙ από το API σε κάθε
 * πέρασμα, άρα δεν μπορεί να αποκλίνει· το σχόλιο (= η ειδοποίηση) γράφεται ΜΟΝΟ σε
 * ΜΕΤΑΒΑΣΗ. Σταθερή κατάσταση ⇒ μηδέν σχόλια ⇒ μηδέν email.
 */

const STATE_OPEN = '<!-- ci-health-state';
const STATE_CLOSE = '-->';
const STATE_VERSION = 1;

/** @typedef {{tier:number,file:string,conclusion:string,runNumber?:number,runUrl?:string,sha?:string,actor?:string,at?:string,sinceSha?:string,sinceAt?:string,sinceRunUrl?:string}} GateStatus */

/**
 * Διαβάζει την αποθηκευμένη κατάσταση από το σώμα του issue. Άγνωστο/κατεστραμμένο σώμα ⇒
 * κενή κατάσταση (η επόμενη προβολή θα την ξαναχτίσει ολόκληρη — δεν χάνεται τίποτα πέρα
 * από την ανίχνευση μετάβασης του τρέχοντος περάσματος).
 * @param {string} body
 * @returns {{version:number, gates:Record<string,GateStatus>}}
 */
function parseState(body) {
  const empty = { version: STATE_VERSION, gates: {} };
  if (typeof body !== 'string') return empty;
  const start = body.indexOf(STATE_OPEN);
  if (start === -1) return empty;
  const end = body.indexOf(STATE_CLOSE, start);
  if (end === -1) return empty;
  try {
    const parsed = JSON.parse(body.slice(start + STATE_OPEN.length, end));
    return parsed && parsed.gates ? parsed : empty;
  } catch {
    return empty;
  }
}

/**
 * Η κατάσταση μιας πύλης από τα ΤΡΕΞΙΜΑΤΑ της, νεότερο πρώτο.
 * Όταν είναι κόκκινη, ανεβαίνει προς τα πίσω όσο τα τρεξίματα είναι συνεχόμενα αποτυχημένα
 * και επιστρέφει το ΠΡΩΤΟ — δηλαδή το commit που την έσπασε (culprit attribution, Google TAP).
 * Χωρίς αυτό η πύλη λέει «43 νέα ευρήματα» και κανείς δεν ξέρει από ποιο από τα ~100 commits.
 * @param {{conclusion:string, run_number:number, html_url:string, head_sha:string, updated_at:string, actor?:{login?:string}}[]} runs
 * @returns {Partial<GateStatus>}
 */
function projectGateStatus(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return { conclusion: 'unknown' };
  const latest = runs[0];
  const base = {
    conclusion: latest.conclusion || 'unknown',
    runNumber: latest.run_number,
    runUrl: latest.html_url,
    sha: (latest.head_sha || '').slice(0, 8),
    actor: (latest.actor && latest.actor.login) || undefined,
    at: latest.updated_at,
  };
  if (base.conclusion !== 'failure') return base;

  let first = latest;
  for (const run of runs) {
    if (run.conclusion !== 'failure') break;
    first = run;
  }
  return { ...base, sinceSha: (first.head_sha || '').slice(0, 8), sinceAt: first.updated_at, sinceRunUrl: first.html_url };
}

/**
 * Μεταβάσεις μεταξύ δύο καταστάσεων. ΜΟΝΟ αυτές δικαιολογούν σχόλιο.
 * Πύλη που εμφανίζεται για πρώτη φορά κόκκινη μετράει ως «έσπασε» (δεν υπήρχε προηγούμενη
 * γνώση· η εναλλακτική — σιωπή — είναι ακριβώς η αόρατη αποτυχία που καταργείται).
 * @param {{gates:Record<string,GateStatus>}} previous
 * @param {{gates:Record<string,GateStatus>}} next
 */
function diffState(previous, next) {
  const before = (previous && previous.gates) || {};
  const broke = [];
  const fixed = [];

  for (const [name, status] of Object.entries(next.gates)) {
    const was = before[name] ? before[name].conclusion : undefined;
    if (status.conclusion === 'failure' && was !== 'failure') broke.push({ name, ...status });
    if (status.conclusion === 'success' && was === 'failure') fixed.push({ name, ...status });
  }
  return { broke, fixed };
}

const ICON = { success: '✅', failure: '❌', cancelled: '🚫', skipped: '⏭️', unknown: '❔' };

function row(name, status) {
  const icon = ICON[status.conclusion] || ICON.unknown;
  const run = status.runUrl ? `[#${status.runNumber}](${status.runUrl})` : '—';
  const since =
    status.conclusion === 'failure' && status.sinceSha
      ? `\`${status.sinceSha}\`${status.sinceAt ? ` · ${status.sinceAt.slice(0, 10)}` : ''}`
      : '—';
  return `| ${icon} | ${name} | ${run} | ${since} | ${status.actor || '—'} |`;
}

function tierSection(tierKey, tierMeta, entries) {
  const failing = entries.filter(([, s]) => s.conclusion === 'failure').length;
  const head = `### Tier ${tierKey} — ${tierMeta.label} (${failing}/${entries.length} κόκκινες)`;
  if (entries.length === 0) return `${head}\n\n_καμία πύλη_\n`;
  return [
    head,
    '',
    `> ${tierMeta.meaning}`,
    '',
    '| | Πύλη | Τελευταίο | Κόκκινη από | Ποιος |',
    '|---|---|---|---|---|',
    ...entries.map(([name, status]) => row(name, status)),
    '',
  ].join('\n');
}

/**
 * Το σώμα του issue = ο πίνακας κατάστασης + η σειριοποιημένη κατάσταση σε σχόλιο HTML.
 * ⚠️ Η ενημέρωση ΣΩΜΑΤΟΣ δεν στέλνει ειδοποίηση στο GitHub — μόνο τα σχόλια στέλνουν.
 * Αυτό ΕΙΝΑΙ ο μηχανισμός της σιωπής των Tier 2/3, όχι παρενέργεια.
 * @param {{version:number, updatedAt:string, gates:Record<string,GateStatus>}} state
 * @param {{tiers:Record<string,{label:string,meaning:string}>}} registry
 */
function renderBody(state, registry) {
  const sections = Object.entries(registry.tiers).map(([tierKey, tierMeta]) =>
    tierSection(
      tierKey,
      tierMeta,
      Object.entries(state.gates)
        .filter(([, status]) => String(status.tier) === tierKey)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  );

  return [
    '# 🚑 Κατάσταση πυλών CI (ADR-757)',
    '',
    'Αυτό το σώμα **ξαναγράφεται** σε κάθε πέρασμα — είναι προβολή του GitHub Actions API, όχι ημερολόγιο.',
    'Τα **σχόλια** παρακάτω γράφονται μόνο σε **μετάβαση** (έσπασε / αποκαταστάθηκε): σταθερό κόκκινο = σιωπή.',
    '',
    `_Τελευταία ενημέρωση: ${state.updatedAt}_`,
    '',
    ...sections,
    '',
    `${STATE_OPEN}`,
    JSON.stringify({ version: STATE_VERSION, updatedAt: state.updatedAt, gates: state.gates }),
    STATE_CLOSE,
  ].join('\n');
}

module.exports = { parseState, projectGateStatus, diffState, renderBody, STATE_VERSION, STATE_OPEN };
