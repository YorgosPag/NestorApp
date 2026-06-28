# 🤝 Fleet Coordination — συντονισμός πολλαπλών Claude Code terminals

Σύστημα που επιτρέπει σε **πολλούς πράκτορες (terminals) να δουλεύουν παράλληλα
στο ίδιο repo για μέρες**, χωρίς να πατάει ο ένας τον άλλον — με **ελάχιστη
παρέμβαση** από τον Giorgio.

Ο συντονισμός γίνεται μέσω **Claude Code hooks**: τρέχει ο harness αυτόματα (όχι
ο πράκτορας), άρα δεν εξαρτάται από το αν «θυμήθηκε» ο agent να ενημερώσει.

## Τι λύνει

| Πρόβλημα | Μηχανισμός |
|---|---|
| 2 terminals γράφουν το ίδιο αρχείο → git conflict | **File lock** (auto-claim στο πρώτο Edit/Write) |
| 2 terminals στην ίδια αρχιτεκτονική περιοχή | **Folder lane** (προαιρετικό, χειροκίνητο claim) |
| 2 `tsc`/typecheck μαζί → ο υπολογιστής παγώνει (N.17) | **tsc-gate** (live process scan + lock) |
| Νέο terminal δεν ξέρει τι τρέχει | **SessionStart snapshot** στο context του agent |
| Crashed terminal κρατάει locks για πάντα | **TTL** 3h αδράνειας + SessionEnd release |

## Αρχιτεκτονική

```
.claude-rules/fleet/
├── fleet-store.cjs        # κοινός πυρήνας: state I/O, mutex, TTL, labels
├── lock-guard.cjs         # PreToolUse(Edit|Write|MultiEdit|NotebookEdit) → claim/block
├── tsc-gate.cjs           # PreToolUse(Bash) → ΕΝΑΣ tsc τη φορά (N.17)
├── post-bash.cjs          # PostToolUse(Bash) → release tsc slot (foreground)
├── on-session-start.cjs   # SessionStart → snapshot + register + clean stale
├── on-session-end.cjs     # SessionEnd → release locks της session
├── fleet.cjs              # CLI: status / lanes / release / reset
├── locks.json             # STATE (gitignored — κοινό μέσω filesystem)
└── README.md
```

**State (`locks.json`)** = single source of truth, κοινό σε όλα τα terminals
γιατί μοιράζονται το ίδιο filesystem path. **Δεν** μπαίνει στο git (volatile).

## Πώς δουλεύει ο κάθε πράκτορας

1. **SessionStart** → παίρνει label (A1, A2, …) + βλέπει στο context ποιος
   κρατάει τι.
2. **Πρώτο Edit/Write σε αρχείο** → ο hook το κλειδώνει αυτόματα στο όνομά του.
3. **Άλλος πράκτορας** που προσπαθεί το ίδιο αρχείο → **exit 2, BLOCK** με μήνυμα.
4. **tsc/typecheck** → ο hook ελέγχει αν τρέχει ήδη άλλος· αν ναι → BLOCK.
5. **SessionEnd** → ελευθερώνει όλα τα locks του.

## CLI

```bash
node .claude-rules/fleet/fleet.cjs status                       # ποιος κρατάει τι
node .claude-rules/fleet/fleet.cjs claim-lane "src/subapps/dxf-viewer/grips/" A2
node .claude-rules/fleet/fleet.cjs unclaim-lane "src/subapps/dxf-viewer/grips/"
node .claude-rules/fleet/fleet.cjs release "src/foo/bar.ts"     # ελευθέρωσε 1 αρχείο
node .claude-rules/fleet/fleet.cjs free-tsc                     # ξεκόλλησε tsc slot
node .claude-rules/fleet/fleet.cjs reset                        # μηδένισε τα πάντα
```

## Εγκατάσταση hooks (`.claude/settings.json`)

⚠️ Το `.claude/settings.json` πρέπει να περιέχει το παρακάτω `hooks` block.
Επειδή τα hooks εκτελούν scripts σε κάθε tool use, το auto-mode του Claude Code
ΔΕΝ επιτρέπει σε agent να το γράψει μόνος — πρέπει να το προσθέσει ο Giorgio:

```json
{
  "model": "opus",
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node .claude-rules/fleet/on-session-start.cjs" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node .claude-rules/fleet/on-session-end.cjs" }] }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write|MultiEdit|NotebookEdit", "hooks": [{ "type": "command", "command": "node .claude-rules/fleet/lock-guard.cjs" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node .claude-rules/fleet/tsc-gate.cjs" }] }
    ],
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node .claude-rules/fleet/post-bash.cjs" }] }
    ]
  }
}
```

Μετά την προσθήκη: **restart όλα τα terminals** (τα hooks φορτώνονται στο
SessionStart). Κάθε νέο terminal που ανοίγει στο repo τα παίρνει αυτόματα.

## Όρια (100% ειλικρίνεια)

- Τα terminals **δεν** ανταλλάσσουν *δουλειές* μεταξύ τους — δεν υπάρχει
  cross-terminal messaging στο CLI. Το αρχικό task σε κάθε terminal το δίνει ο
  Giorgio. Αυτό που γίνεται αυτόματο είναι ο **συντονισμός** (μη-σύγκρουση).
- File-lock granularity = **ανά αρχείο** by default. Για κλείδωμα ολόκληρης
  αρχιτεκτονικής περιοχής → χειροκίνητο `claim-lane`.
- Το tsc-gate κάνει live process scan μέσω PowerShell· αν το PowerShell αποτύχει
  → fail-open (επιτρέπει), με δεύτερη γραμμή άμυνας το lock+TTL.

## Tunables (`fleet-store.cjs`)

- `SESSION_TTL_MS` — πόση αδράνεια μέχρι να θεωρηθεί νεκρό ένα session (3h).
- `TSC_TTL_MS` — όριο ζωής tsc lock (6min).
