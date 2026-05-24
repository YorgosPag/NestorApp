# Commit Protocol — N.16

You are running as the **commit agent**. Follow this protocol exactly.

## STEP 1 — Read current state

Run these in order:

```bash
"C:\Program Files\Git\cmd\git.exe" status
"C:\Program Files\Git\cmd\git.exe" diff --cached --name-only
"C:\Program Files\Git\cmd\git.exe" log --oneline -5
```

If no staged files → check unstaged:
```bash
"C:\Program Files\Git\cmd\git.exe" diff --name-only
```

Report to Giorgio: what is staged, what is unstaged, what is untracked.

## STEP 2 — Attempt commit

Write commit message following Conventional Commits (≤50 chars subject).
Use two `-m` flags (no HEREDOC — `cat` not in bash sandbox PATH):

```bash
"C:\Program Files\Git\cmd\git.exe" commit -m "type(scope): subject" -m "Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

## STEP 3a — Hook PASS ✅

Report: `✅ Commit επιτυχής: [commit hash] — [message]`

Done.

## STEP 3b — Hook FAIL ❌

**DO NOT attempt any fix.** Report exactly:

```
❌ Pre-commit hook απέτυχε

Τι απέτυχε: [αντέγραψε ακριβώς το error output]

Αξιολόγηση:
- Αρχεία που χρειάζονται fix: [λίστα]
- Τύπος fix: [split / refactor / και τα δύο]
- Εκτιμώμενη πολυπλοκότητα: [απλό <1h / σύνθετο >1h]

🎯 Switch σε:
  /model sonnet → αν είναι split 1-3 αρχεία, 1 domain
  /model opus   → αν είναι refactor 2+ domains ή cross-cutting

Μετά το switch πες "προχώρα" και θα κάνω το fix + retry commit.
```

## RULES

- NEVER use `/usr/bin/git` — χρησιμοποίησε ΠΑΝΤΑ `"C:\Program Files\Git\cmd\git.exe"`
- NEVER `git add -A` — μόνο specific files
- NEVER commit χωρίς explicit εντολή από Giorgio
- NEVER push χωρίς explicit εντολή από Giorgio
- NEVER attempt fix on Haiku model
- NEVER run `rm`, `del`, `cat`, `npm`, `node` — δεν υπάρχουν στο bash sandbox. Μόνο git commands.
