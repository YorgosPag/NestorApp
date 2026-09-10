#!/usr/bin/env node
/**
 * Φρένο μήκους εντολής Bash — «αυτό είναι ΠΕΡΙΕΧΟΜΕΝΟ ΑΡΧΕΙΟΥ, όχι εντολή».
 *
 * ΓΙΑΤΙ — μετρημένο 10/09/2026 σε 45.253 εντολές Bash από τα transcripts του έργου:
 *   το εργαλείο Bash του Claude Code στα Windows (2.1.267 · Git Bash 5.3.9) ΣΠΑΕΙ
 *   εντολές πάνω από ~7.000 χαρακτήρες με το ΨΕΥΔΕΣ
 *     /usr/bin/bash: -c: line N: unexpected EOF while looking for matching `''
 *
 *     | μήκος εντολής | πέτυχαν | έσπασαν                                    |
 *     |---------------|---------|--------------------------------------------|
 *     | 0 – 7.000     | 45.025  | 19 (άλλη αιτία: πραγματικά λάθη quoting)   |
 *     | 7.000 – 8.000 |     34  | 17                                         |
 *     | 8.000+        |      2  | 163                                        |
 *
 *   176/177 heredoc που «έσπασαν» περνούν `bash -n` αυτούσια ⇒ η εντολή ήταν ΣΩΣΤΗ·
 *   τη χαλά το περιτύλιγμα του εργαλείου. Αναπαραγωγή: heredoc 9.200 χαρακτήρων ΜΟΝΟ
 *   με ψηφία ⇒ ίδιο σφάλμα. ΔΕΝ φταίνε ελληνικά ούτε απόστροφοι — φταίει το ΜΗΚΟΣ.
 *
 * Το μήνυμα για απόστροφο έστελνε τους πράκτορες σε ΛΑΘΟΣ διάγνωση («το heredoc
 * σκοντάφτει στα ελληνικά») και σε επαναλήψεις με «διορθώσεις» εισαγωγικών. Ο γραπτός
 * κανόνας (`.claude-rules/feedback_write_tool_not_heredoc.md`, 04/09) δεν το σταμάτησε:
 * 53 αποτυχίες σε 47 συνεδρίες ΜΕΤΑ από αυτόν. Εδώ η εντολή κόβεται ΠΡΙΝ τρέξει, με
 * τη ΣΩΣΤΗ αιτία και τη ΣΩΣΤΗ διέξοδο.
 *
 * Χρήση: node bash-length-guard.js   (PreToolUse, matcher Bash)
 */
'use strict';
const fs = require('fs');

/**
 * Το όριο — ΜΟΝΑΔΙΚΗ πηγή· το διαβάζει και το `heavy-mutex.js`.
 *
 * Η πρώτη μετρημένη αποτυχία λόγω μήκους είναι στις ~7.000, αλλά το σημείο θραύσης
 * μετακινείται με το πλήθος των εισαγωγικών (το περιτύλιγμα τα φουσκώνει) ⇒ περιθώριο
 * 1.000. Κόστος στα ιστορικά δεδομένα: 116 επιτυχημένες εντολές στις 45.253 (0,26%) θα
 * στέλνονταν στο `Write` — που ήταν ούτως ή άλλως το σωστό εργαλείο για τέτοιο όγκο.
 */
const MAX_COMMAND_CHARS = 6000;

function exceedsLimit(cmd) {
  return typeof cmd === 'string' && cmd.length > MAX_COMMAND_CHARS;
}

function denyReason(length) {
  return (
    'ΦΡΕΝΟ ΜΗΚΟΥΣ: η εντολή έχει ' + length + ' χαρακτήρες (όριο ' + MAX_COMMAND_CHARS + '). ' +
    'Το εργαλείο Bash στα Windows σπάει πάνω από ~7.000 χαρακτήρες με ΨΕΥΔΕΣ ' +
    "«unexpected EOF while looking for matching `''» — ΔΕΝ φταίνε ελληνικά ή απόστροφοι, " +
    'φταίει το ΜΗΚΟΣ. Διέξοδος: περιεχόμενο αρχείου → `Write` (προσωρινό → στον scratchpad) ' +
    'και μετά μικρή εντολή πάνω στο αρχείο· αλλαγή σε υπάρχον αρχείο → `Edit`· ' +
    'μήνυμα commit → `Write` + `git commit -F <αρχείο>`. ' +
    'ΜΗΝ κόψεις την ίδια εντολή σε κομμάτια μέσω shell — το `Write` είναι το σωστό εργαλείο.'
  );
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const input = readStdin();
  const cmd = (input.tool_input && input.tool_input.command) || '';
  if (!exceedsLimit(cmd)) return; // σιωπή: exit 0, καμία παρέμβαση

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: denyReason(cmd.length),
    },
  }));
}

// Εκτίθεται ώστε να το ΕΚΤΕΛΕΙ η άγκυρα (ADR-783) και να το ρωτά το `heavy-mutex.js`.
module.exports = { MAX_COMMAND_CHARS, exceedsLimit, denyReason };

if (require.main === module) main();
