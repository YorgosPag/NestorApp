'use strict';

/**
 * Ο πελάτης του φύλλου διαλογής (ADR-775 §15) — καθαρή λογική **παρουσίασης**.
 *
 * ⚠️ Καμία ετυμηγορία εδώ. Οι μετρήσεις και οι προειδοποιήσεις έρχονται **έτοιμες** από το
 * `png-stats.js` μέσω του ενσωματωμένου `ITEMS`. Αν ο πελάτης ξανα-υπολόγιζε «κενό» ή
 * «ταυτόσημο», θα ήταν δεύτερη μηχανή που μπορεί να διαφωνήσει με την πύλη — και ο άνθρωπος θα
 * ενέκρινε με βάση έναν αριθμό που κανείς άλλος δεν βλέπει.
 *
 * Οι αποφάσεις επιβιώνουν σε `localStorage`: η διαλογή 43 εικόνων δεν είναι μία συνεδρία, και
 * μια σελίδα που ξεχνά αναγκάζει σε βιαστική μαζική έγκριση — ακριβώς ό,τι κατέστρεψε τα golden.
 */
const SHEET_JS = String.raw`
const KEY = 'adr775-golden-decisions-v1';
const state = { i: 0, decisions: JSON.parse(localStorage.getItem(KEY) || '{}') };

const $ = (sel) => document.querySelector(sel);
const save = () => localStorage.setItem(KEY, JSON.stringify(state.decisions));

function counts() {
  let yes = 0, no = 0;
  for (const item of ITEMS) {
    if (state.decisions[item.name] === 'yes') yes += 1;
    if (state.decisions[item.name] === 'no') no += 1;
  }
  return { yes, no, left: ITEMS.length - yes - no };
}

function paintCounts() {
  const c = counts();
  $('#c-yes').textContent = c.yes;
  $('#c-no').textContent = c.no;
  $('#c-left').textContent = c.left;
  $('#btn-save').disabled = c.left === ITEMS.length;
}

function paintGrid() {
  $('#grid').innerHTML = ITEMS.map((it, idx) => {
    const d = state.decisions[it.name] || '';
    const mark = d === 'yes' ? '✅' : d === 'no' ? '❌' : '·';
    return '<article class="cell" data-decision="' + d + '" data-idx="' + idx + '">' +
      '<img loading="lazy" src="' + it.candidateSrc + '" alt="' + it.name + '">' +
      '<div class="name"><span>' + it.name + '</span><em>' + mark + '</em></div></article>';
  }).join('');
  for (const cell of document.querySelectorAll('.cell')) {
    cell.addEventListener('click', () => { state.i = Number(cell.dataset.idx); show('one'); });
  }
}

function alertsHtml(it) {
  return it.alerts.map((a) =>
    '<p class="alert ' + (a.severity === 'bad' ? 'bad' : '') + '">' + a.text + '</p>'
  ).join('');
}

function paintOne() {
  const it = ITEMS[state.i];
  $('#one-title').textContent = it.name;
  $('#one-sub').textContent = it.title;
  $('#one-pos').textContent = (state.i + 1) + ' / ' + ITEMS.length;
  $('#cand').src = it.candidateSrc;
  $('#cand-cap').textContent = it.candidateFacts;
  const g = $('#gold-fig');
  if (it.goldenSrc) { g.classList.remove('hidden'); $('#gold').src = it.goldenSrc;
                      $('#gold-cap').textContent = it.goldenFacts; }
  else { g.classList.add('hidden'); }
  $('#facts').innerHTML = it.facts;
  $('#alerts').innerHTML = alertsHtml(it);
  const d = state.decisions[it.name];
  const stab = it.stability === 'identical' ? '<span class="pill yes">ΣΤΑΘΕΡΟ</span>'
    : it.stability === 'stable' ? '<span class="pill warn">ΣΧΕΔΟΝ ΣΤΑΘΕΡΟ</span>'
    : it.stability === 'unstable' || it.stability === 'size-mismatch'
      ? '<span class="pill no">ΑΣΤΑΘΕΣ</span>'
      : '<span class="pill">σταθερότητα άγνωστη</span>';
  $('#verdict').innerHTML = (d === 'yes' ? '<span class="pill yes">ΕΓΚΡΙΘΗΚΕ</span>'
    : d === 'no' ? '<span class="pill no">ΑΠΟΡΡΙΦΘΗΚΕ</span>'
    : '<span class="pill">χωρίς απόφαση</span>') + ' ' + stab;
  paintCounts();
}

function decide(value) {
  const it = ITEMS[state.i];
  if (value === null) delete state.decisions[it.name]; else state.decisions[it.name] = value;
  save();
  if (state.i < ITEMS.length - 1) { state.i += 1; paintOne(); } else { paintOne(); }
  paintGrid();
}

function show(view) {
  $('#view-grid').classList.toggle('hidden', view !== 'grid');
  $('#view-one').classList.toggle('hidden', view !== 'one');
  $('#tab-grid').setAttribute('aria-selected', String(view === 'grid'));
  $('#tab-one').setAttribute('aria-selected', String(view === 'one'));
  if (view === 'grid') paintGrid(); else paintOne();
}

function download() {
  const payload = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    decisions: ITEMS.map((it) => ({ name: it.name, arg: it.arg, title: it.title,
                                    decision: state.decisions[it.name] || 'pending' })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'golden-decisions.json';
  a.click();
}

document.addEventListener('keydown', (e) => {
  if ($('#view-one').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight' || e.key === 'Enter') { decide('yes'); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'x') { decide('no'); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { decide(null); e.preventDefault(); }
  else if (e.key === 'PageDown' && state.i < ITEMS.length - 1) { state.i += 1; paintOne(); }
  else if (e.key === 'PageUp' && state.i > 0) { state.i -= 1; paintOne(); }
});

$('#tab-grid').addEventListener('click', () => show('grid'));
$('#tab-one').addEventListener('click', () => show('one'));
$('#btn-yes').addEventListener('click', () => decide('yes'));
$('#btn-no').addEventListener('click', () => decide('no'));
$('#btn-skip').addEventListener('click', () => {
  if (state.i < ITEMS.length - 1) { state.i += 1; paintOne(); }
});
$('#btn-prev').addEventListener('click', () => { if (state.i > 0) { state.i -= 1; paintOne(); } });
$('#btn-save').addEventListener('click', download);
$('#btn-reset').addEventListener('click', () => {
  if (confirm('Διαγραφή ΟΛΩΝ των αποφάσεων;')) { state.decisions = {}; save(); show('one'); }
});

show('one');
`;

module.exports = { SHEET_JS };
