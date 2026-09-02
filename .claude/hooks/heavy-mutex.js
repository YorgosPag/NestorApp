#!/usr/bin/env node
/**
 * Φρένο βαριών εντολών — ΕΝΑ κλειδί, μία βαριά εργασία τη φορά.
 *
 * ΓΙΑΤΙ: μετρημένο 31/08/2026 σε i5-4440S (4 πυρήνες, χωρίς hyper-threading):
 *   μία `jest` γεμίζει το CPU στο 100% μόνη της, ενώ μια συνεδρία σε αδράνεια
 *   κοστίζει ~0%. Ο περιορισμός είναι οι πυρήνες, ΟΧΙ η RAM — άρα το ταβάνι
 *   ανήκει στις ΒΑΡΙΕΣ ΕΡΓΑΣΙΕΣ, όχι στο πλήθος συνεδριών ή διεργασιών.
 *   (Ταβάνι πλήθους θα ήταν λάθος μοχλός: 25 chrome = 1,6% CPU vs 2 jest = 45%.)
 *
 * Χρήση: node heavy-mutex.js acquire   (PreToolUse)
 *        node heavy-mutex.js release   (PostToolUse)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK = path.join(os.homedir(), '.claude', 'heavy-task.lock');
/**
 * Πότε θεωρείται εγκαταλελειμμένο το κλειδί.
 *
 * ⚠️ Το `release` (PostToolUse) **δεν τρέχει** αν η συνεδρία πεθάνει στη μέση — τότε
 * το κλειδί κρατά ως εδώ. Τα 90′ ήταν **εννιαπλάσια του χειρότερου πραγματικού
 * χρόνου**: το ταβάνι του εργαλείου Bash είναι **10 λεπτά**, άρα καμία νόμιμη εντολή
 * προσκηνίου δεν ζει περισσότερο. Τα 20′ αφήνουν διπλό περιθώριο και κόβουν την
 * ομηρία στο ένα πέμπτο.
 */
const STALE_MINUTES = 20;

/** Εντολές που μονοπωλούν το μηχάνημα. */
const HEAVY = [
  /\bjest\b/,
  /\bnext\s+build\b/,
  /\btsc\b/,
  /\bssot:audit\b/,
  /\bnpm\s+(run\s+)?test\b/,
  /\bpnpm\s+(run\s+)?test\b/,
  /\bjscpd\b/,
];

/**
 * Εξαιρέσεις — ΠΟΤΕ δεν μπλοκάρονται.
 * Το `git commit` τρέχει το pre-commit hook, που τρέχει tests: αν το φρένο
 * το έπιανε, ο Giorgio δεν θα μπορούσε να κάνει commit όσο τρέχει άλλο jest.
 *
 * 🔴 ΔΙΟΡΘΩΘΗΚΕ 01/09/2026 — Η ΕΞΑΙΡΕΣΗ ΔΕΝ ΕΠΙΑΝΕ ΤΗ ΜΟΡΦΗ ΠΟΥ ΕΠΙΒΑΛΛΕΙ Ο N.16.
 * Το πρότυπο ήταν `\bgit\s+commit\b`, αλλά το `.claude/commands/commit.md` καλεί
 * `"C:\Program Files\Git\cmd\git.exe" commit …` ⇒ `git.exe" commit` **δεν ταίριαζε**.
 * Αποτέλεσμα, μετρημένο: το commit του ενός agent **κράτησε το κλειδί** και μπλόκαρε
 * τον άλλον — ακριβώς αυτό που το σχόλιο από πάνω υπόσχεται ότι δεν γίνεται.
 */
const EXEMPT = [
  /\bgit(\.exe)?["']?\s+commit\b/,
  /\bgit(\.exe)?["']?\s+push\b/,
  /heavy-mutex/,
];

/**
 * Κόβει το **ωφέλιμο φορτίο** πριν την κρίση: μήνυμα commit, σώμα heredoc, κώδικα
 * `-e`. Είναι **δεδομένα, όχι πρόγραμμα**.
 *
 * 🔴 ΓΙΑΤΙ, μετρημένο 01/09/2026: το φρένο μπλόκαρε `node -e` που **έγραφε markdown**,
 * επειδή το κείμενο περιείχε `jest-suite.yml` — και ένα `git commit` επειδή το
 * **μήνυμά** του ανέφερε `tsc`. Δηλαδή: όσο καλύτερα τεκμηριώνεις, τόσο πιο πιθανό να
 * μπλοκαριστείς. Ο ταξινομητής όφειλε να κρίνει **τι τρέχει**, όχι τι λέει.
 *
 * ⚠️ **Το `-c` ΔΕΝ κόβεται, επίτηδες**: είναι κώδικας προς εκτέλεση, όχι δεδομένα —
 * κόβοντάς το, το `bash -c "npx jest"` θα ξέφευγε. Το φρένο είναι **συνεργατικό
 * mutex** ανάμεσα σε δύο συνεδρίες του ίδιου ανθρώπου, όχι σύνορο ασφαλείας: το
 * μετρημένο κακό είναι τα **ψευδώς θετικά**, όχι η παράκαμψη.
 */
const HEREDOC_BODY = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1[\s\S]*?^\2\s*$/gm;
const FLAG_PAYLOAD = /(^|\s)(-m|--message|-e|--eval)(?:=|\s+)('[^']*'|"(?:\\.|[^"\\])*"|\S+)/g;

function stripPayload(cmd) {
  return String(cmd).replace(HEREDOC_BODY, ' ').replace(FLAG_PAYLOAD, ' ');
}

function isHeavy(cmd) {
  const program = stripPayload(cmd);
  if (EXEMPT.some((re) => re.test(program))) return false;
  return HEAVY.some((re) => re.test(program));
}

function readLock() {
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    const ageMin = (Date.now() - raw.startedAt) / 60000;
    if (ageMin > STALE_MINUTES) return null; // μπαγιάτικο -> ελεύθερο
    return { ...raw, ageMin };
  } catch {
    return null; // δεν υπάρχει ή είναι χαλασμένο -> ελεύθερο
  }
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const mode = process.argv[2];
  const input = readStdin();
  const cmd = (input.tool_input && input.tool_input.command) || '';
  const sid = input.session_id || 'unknown';

  if (!isHeavy(cmd)) return; // σιωπή: exit 0, καμία παρέμβαση

  if (mode === 'release') {
    const held = readLock();
    if (held && held.sessionId === sid) {
      try { fs.unlinkSync(LOCK); } catch {}
    }
    return;
  }

  // acquire
  const held = readLock();
  if (held && held.sessionId !== sid) {
    const mins = Math.round(held.ageMin);
    const other = String(held.command).slice(0, 90);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'ΦΡΕΝΟ ΒΑΡΙΩΝ ΕΡΓΑΣΙΩΝ: τρέχει ήδη βαριά εντολή σε άλλη συνεδρία ' +
          '(' + held.sessionId.slice(0, 8) + ', εδώ και ' + mins + ' λεπτά): ' + other +
          '. Το μηχάνημα έχει 4 πυρήνες και μία τέτοια εντολή τους γεμίζει. ' +
          'Κάνε άλλη δουλειά στο μεταξύ και ξαναδοκίμασε αργότερα — ΜΗΝ την τρέξεις ' +
          'με άλλο τρόπο για να παρακάμψεις το φρένο. ' +
          // Χωρίς αυτή τη γραμμή, ο μπλοκαρισμένος δεν ξέρει ΠΟΤΕ ελευθερώνεται και
          // ψάχνει λάθος δείκτες: το `ps` δεν βλέπει τίποτα (δεν παρακολουθούνται
          // διεργασίες) και το `.git/index.lock` δεν υπάρχει όσο τρέχουν τα hooks.
          'Ο ΜΟΝΟΣ σωστός δείκτης είναι το ίδιο το αρχείο κλειδώματος: ' + LOCK +
          ' — απουσία του, ή ηλικία >' + STALE_MINUTES + '′, σημαίνει ελεύθερο.',
      },
    }));
    return;
  }

  try {
    fs.mkdirSync(path.dirname(LOCK), { recursive: true });
    fs.writeFileSync(LOCK, JSON.stringify({
      sessionId: sid,
      command: cmd.slice(0, 200),
      startedAt: Date.now(),
    }));
  } catch {}
}

// Ο ταξινομητής εκτίθεται ώστε να τον ΕΚΤΕΛΕΙ η άγκυρα (ADR-783: πύλη χωρίς δοκιμή
// είναι πύλη που κανείς δεν εμπιστεύεται). Το `main()` τρέχει μόνο ως εντολή.
module.exports = { isHeavy, LOCK, STALE_MINUTES };

if (require.main === module) main();
