/**
 * ΟΙ ΓΡΑΜΜΕΣ ΠΟΥ ΕΚΤΕΛΟΥΝΤΑΙ — τα κοινά εργαλεία των δύο σκελών της CHECK 3.76 (ADR-845 §8 · §7.17 Α6)
 *
 * ⚠️ **ΓΡΑΜΜΕΣ, ΟΧΙ AST** — ο λόγος είναι γραμμένος στο `gate.js`. Ζουν εδώ, χωριστά, γιατί τα
 * ρωτούν **δύο** μηχανές (`gate.js` · `material-doors.js`): δεύτερο αντίγραφο του «τι είναι
 * σχόλιο;» θα σήμαινε δύο πύλες που διαφωνούν για το ίδιο αρχείο.
 *
 * @module scripts/lib/listing-model-custody/lines
 */

/** Οι γραμμές που **εκτελούνται** — χωρίς σχόλια. Δες το δηλωμένο όριο στην κεφαλίδα του `gate.js`. */
function executableLines(source) {
  return source.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return t !== '' && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
  });
}

/** Καλεί αυτό το αρχείο το σύμβολο — σε γραμμή που **εκτελείται**; */
function callsSymbol(lines, symbol) {
  const call = new RegExp(`\\b${symbol}\\s*\\(`);
  return lines.some((line) => call.test(line));
}

/** Ορίζει αυτό το αρχείο το σύμβολο; */
function definesSymbol(lines, symbol) {
  const def = new RegExp(`\\b(?:function|const|let)\\s+${symbol}\\b`);
  return lines.some((line) => def.test(line));
}

module.exports = { callsSymbol, definesSymbol, executableLines };
