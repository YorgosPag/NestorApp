# ADR-925 — Ένα worktree ανά πράκτορα: η ρίζα του χάσματος «δίσκος ≠ commit»

| | |
|---|---|
| **Status** | 📝 **ΠΡΟΤΕΙΝΟΜΕΝΟ (2026-10-30)** — απόφαση Giorgio για τη Φάση 1 (§6). Τίποτα δεν αλλάζει στη ροή εργασίας πριν από αυτήν. |
| **Date** | 2026-10-30 |
| **Category** | Tooling / Multi-agent workflow |
| **Canonical Location** | *(προτεινόμενο)* `.claude/worktrees/<όνομα>/` · `.worktreeinclude` · `.claude/settings.json` (`worktree.baseRef`) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-924 (οι πύλες κρίνουν το commit — η **άμυνα**, αυτό εδώ η **θεραπεία**) · `.claude-rules/fleet/` (κλειδώματα αρχείων/λωρίδων) · `heavy-mutex` (ένα βαρύ έργο τη φορά) · ADR-800 (μία έκδοση πακέτου) |

---

## 1. Το ερώτημα

> **«Γιατί δύο πράκτορες μοιράζονται ΕΝΑ working tree και ΕΝΑ ευρετήριο, όταν το git δίνει δωρεάν ένα ανά πράκτορα;»**

## 2. Το πρόβλημα (μετρημένο, όχι θεωρητικό)

Το ADR-924 έλυσε τη **μία** όψη: οι πύλες κρίνουν πλέον το commit, όχι τον δίσκο (ratchet της CHECK 3.107: 84 → 2). Η **ρίζα** μένει:
όλοι οι πράκτορες γράφουν στο ίδιο δέντρο **και** σταδιοποιούν στο ίδιο ευρετήριο. Μετρημένες συνέπειες, όλες από αυτό το repo:

| Συνέπεια | Πού καταγράφηκε |
|---|---|
| Commit 4 αρχείων απέτυχε **3 φορές σε 3 πύλες** για ξένη αστάδιοποίητη δουλειά | ADR-924 §2 |
| Πράκτορας έκανε commit τη **δική μου** WIP (κοινό ευρετήριο) — «`git log`, όχι μόνο `status`» | MEMORY: multi-agent hub |
| Απαγόρευση `stash` / `checkout` / `git add -A` — καθολικές εντολές πάνω σε ξένη δουλειά | κανόνες κάθε handoff |
| Σταδιοποίηση **μόνο των δικών μου γραμμών** με `readIndexText` + `writeIndexBlob` σε αρχεία με ξένες αλλαγές | handoff ADR-924 §0 |
| Η παγίδα της Φ4 βρήκε **19 untracked + 3 αρχεία με ξένες αστάδιοποίητες αλλαγές** στο ίδιο τρέξιμο | ADR-924 §8.10–§8.11 |
| `fleet/lock-guard`: ένα αρχείο, ένας κάτοχος — αλλιώς **μπλοκ** στο Edit | `.claude-rules/fleet/README.md` |

Κάθε ένα από αυτά είναι **μπάλωμα** πάνω στο ίδιο ελάττωμα: δύο ανεξάρτητες εργασίες σε μία κατάσταση.

## 3. Τι κάνουν οι μεγάλοι (έρευνα, 2026-10-30)

| Παίκτης | Πρακτική |
|---|---|
| **Google** (CitC / Piper) | κάθε αλλαγή σε **δικό της** χώρο εργασίας· το presubmit κρίνει στιγμιότυπα — το χάσμα «δίσκος ≠ commit» δεν υπάρχει (ADR-924 §8.2) |
| **Meta** (Sapling / EdenFS) | εικονικό σύστημα αρχείων ανά checkout· πολλά ταυτόχρονα checkouts χωρίς αντιγραφή |
| **Bazel** | κάθε ενέργεια σε **sandbox** με ακριβώς τις δηλωμένες εισόδους — ποτέ «ό,τι τύχει στον δίσκο» |
| **Claude Code** (επίσημα) | `claude --worktree <όνομα>` ⇒ `.claude/worktrees/<όνομα>/` σε κλάδο `worktree-<όνομα>`· `isolation: worktree` για subagents· `.worktreeinclude` για gitignored αρχεία (`.env`)· αυτόματος καθαρισμός όταν δεν υπάρχει δουλειά· **επιβολή** απομόνωσης (Edit/Bash/`GIT_DIR` προς το κύριο checkout ⇒ άρνηση) — [docs](https://code.claude.com/docs/en/worktrees.md) |
| **pnpm** | ένα worktree ανά πράκτορα· ένα κοινό content-addressable store· `enableGlobalVirtualStore` (≥10.12.1, πειραματικό) / `virtualStoreType: global` (11.23) ⇒ σχεδόν ακαριαίο install — [pnpm git-worktrees](https://pnpm.io/git-worktrees) |
| Κοινότητα (agentree · agent-worktree) | ομοφωνία: ένας πράκτορας, ένα worktree· **όχι** κοινό `node_modules` μέσω symlink (σπάει την απομόνωση)· τα worktrees απομονώνουν αρχεία, **όχι** θύρες/βάσεις |

## 4. Δεδομένα αυτού του repo (μετρημένα 2026-10-30)

| | |
|---|---|
| tracked αρχεία | **37.763** |
| `node_modules` | **2,7 GB**· pnpm **9.14.0** (καρφωμένο στο `packageManager`) ⇒ **ΟΧΙ** global virtual store (θέλει ≥10.12.1) |
| `core.longpaths` | **μη ορισμένο** — σε Windows, `.claude/worktrees/<όνομα>/node_modules/.pnpm/…` μπορεί να ξεπεράσει τα 260 |
| hooks | `core.hooksPath = scripts/git-hooks` (σχετικό ⇒ κάθε worktree τρέχει τα **δικά του** hooks — σωστό) |
| `.env*` | 10 αρχεία στη ρίζα, gitignored ⇒ χρειάζονται `.worktreeinclude` |
| ανάπτυξη | push του `main` ⇒ Netcup· commits/push **μόνο** με εντολή Giorgio |
| μηχάνημα | 4 πυρήνες· `heavy-mutex` = ένα βαρύ έργο τη φορά (ισχύει ΚΑΙ με worktrees: η CPU μένει κοινή) |

## 5. Απόφαση (προτεινόμενη)

**Κάθε πράκτορας σε δικό του worktree. Το κύριο checkout γίνεται χώρος ΕΝΣΩΜΑΤΩΣΗΣ — κανείς δεν γράφει εκεί κώδικα.**

### 5.1 Το μοντέλο

| | |
|---|---|
| **Δημιουργία** | `claude --worktree <θέμα>` (ή `EnterWorktree`) ⇒ `.claude/worktrees/<θέμα>/`, κλάδος `worktree-<θέμα>` |
| **Βάση** | `worktree.baseRef: "head"` στο `.claude/settings.json` — 🔴 **όχι** η προεπιλογή `"fresh"`: εκείνη ξεκινά από το `origin/main`, ενώ εδώ τα commits ζουν τοπικά στο `main` για μέρες πριν το push ⇒ ο πράκτορας θα ξεκινούσε από **παλιό** κώδικα |
| **Περιβάλλον** | `.worktreeinclude` (`.env` · `.env.local`)· `pnpm install --offline` (hard links από το store — ίδιος τόμος C:)· `PORT` ανά worktree για dev server |
| **Commit** | με εντολή Giorgio, **στον κλάδο του worktree** (ο hook τρέχει τα scripts του worktree — κρίνει **μόνο** αυτή τη δουλειά: ούτε ξένη αστάδιοποίητη, ούτε ξένο ευρετήριο) |
| **Ενσωμάτωση** | `git rebase main` στο worktree ⇒ `git merge --ff-only worktree-<θέμα>` στο κύριο checkout· σύγκρουση = στο worktree, ποτέ στο `main` |
| **Push** | από το `main`, μόνο με εντολή Giorgio (αμετάβλητο) |
| **Καθαρισμός** | αυτόματος από το Claude Code όταν δεν υπάρχει δουλειά· αλλιώς ερώτηση |

### 5.2 Τι αλλάζει στους υπάρχοντες μηχανισμούς

| Μηχανισμός | Μετά |
|---|---|
| ADR-924 (όψη του commit) | **μένει** — ζώνη ασφαλείας: η δική σου αστάδιοποίητη δουλειά απέναντι στη σταδιοποιημένη· και ό,τι τρέξει ακόμη στο κοινό checkout |
| `fleet/lock-guard` (κλείδωμα αρχείου) | ⬇ περιττό για συγκρούσεις **αρχείων** (κάθε worktree έχει δικά του)· οι **λωρίδες** μένουν χρήσιμες για σημασιολογικές συγκρούσεις (δύο πράκτορες στην ίδια περιοχή ⇒ δύσκολο rebase) |
| `heavy-mutex` | **μένει** — η CPU είναι κοινή |
| κανόνες «ποτέ `stash`/`checkout`/`add -A`» | ισχύουν **στο κύριο checkout**· μέσα στο δικό σου worktree, το δέντρο είναι δικό σου |
| `readIndexText` + `writeIndexBlob` για «μόνο τις δικές μου γραμμές» | περιττό — το ευρετήριο είναι δικό σου |

## 6. Φάσεις

| Φάση | Περιεχόμενο | Ποιος |
|---|---|---|
| **1 — ενεργοποίηση** | `.claude/worktrees/` στο `.gitignore` · `.worktreeinclude` · `worktree.baseRef: "head"` · `git config core.longpaths true` · **μέτρηση** του `pnpm install --offline` σε worktree (χρόνος + δίσκος) | Giorgio εγκρίνει· τα δύο πρώτα μπορεί ο πράκτορας, τα `settings.json` / `git config` ο Giorgio |
| **2 — πιλότος** | ένας πράκτορας σε worktree για μία εργασία· μέτρηση: χρόνος εκκίνησης · rebase · ο hook στο worktree · `.env` · θύρα | πράκτορας + Giorgio |
| **3 — κανόνας** | `.claude-rules/`: «νέα εργασία ⇒ νέο worktree»· το κύριο checkout μόνο για ενσωμάτωση· ενημέρωση του multi-agent hub | μετά τον πιλότο |
| **4 — pnpm** | αναβάθμιση σε pnpm ≥10.12.1 και `enableGlobalVirtualStore` **αν** η μέτρηση της Φάσης 1 δείξει ακριβό install — ξεχωριστή απόφαση (ADR-800, CHECK 3.65· σπάει το `packageManager`) | Giorgio |

## 7. Δηλωμένα όρια και κίνδυνοι

1. **Δίσκος**: 37.763 αρχεία ανά worktree + `node_modules` (hard links ⇒ κυρίως εγγραφές καταλόγου, όχι 2,7 GB). Να μετρηθεί (Φάση 1).
2. **Windows `MAX_PATH`**: χωρίς `core.longpaths` τα βαθιά μονοπάτια του `.pnpm` μέσα σε `.claude/worktrees/<όνομα>/` μπορεί να αποτύχουν.
3. **Θύρες / emulators / βάσεις** δεν απομονώνονται — ένας dev server ανά worktree με δική του `PORT`· ένας Firestore emulator κοινός.
4. **Γεννημένα αρχεία που δεν είναι tracked** (π.χ. `.next/`, cache του 3.70) ξαναχτίζονται ανά worktree — πρώτη εκτέλεση πιο αργή.
5. **Μακροχρόνιοι κλάδοι** = δύσκολα rebase. Κανόνας: μικρά worktrees, ενσωμάτωση συχνά.
6. Οι hooks του Claude Code με `${CLAUDE_PROJECT_DIR}` δείχνουν **στο κύριο checkout** (τεκμηριωμένο)· τα `fleet` hooks γράφουν κοινό `locks.json` — σωστό για λωρίδες.

## 8. Απορριφθείσες εναλλακτικές

- **Κοινό `node_modules` με junction/symlink** σε όλα τα worktrees: γρήγορο, αλλά σπάει την απομόνωση στην πρώτη αλλαγή εξάρτησης (η κοινότητα το αποθαρρύνει ρητά). Μένει **μόνο** ως μετρημένη εφεδρεία αν η Φάση 1 βγάλει απαγορευτικό install.
- **Πλήρες δεύτερο clone ανά πράκτορα**: διπλό `.git`, χωρίς κοινά refs — κάθε ενσωμάτωση γίνεται push/pull. Το worktree μοιράζεται το `.git` δωρεάν.
- **Συνέχεια με κοινό δέντρο + ADR-924**: λύνει τις πύλες, όχι το κοινό ευρετήριο (commit ξένης WIP) ούτε τις απαγορεύσεις `stash`/`checkout`.
- **`git stash --keep-index` πριν τις πύλες**: καθολικό, αγγίζει ξένη δουλειά (ADR-924 §5).

## 9. Changelog

| ημερομηνία | αλλαγή |
|---|---|
| 2026-10-30 | Αρχική πρόταση. Έρευνα: Claude Code worktrees (`--worktree` · `isolation: worktree` · `.worktreeinclude` · επιβολή απομόνωσης) · pnpm git-worktrees (`enableGlobalVirtualStore` ≥10.12.1, `virtualStoreType` 11.23) · Google CitC · Meta EdenFS · Bazel sandboxes. Μετρημένα: 37.763 tracked · `node_modules` 2,7 GB · pnpm 9.14.0 · `core.longpaths` μη ορισμένο. Απόφαση Φάσης 1: εκκρεμεί (Giorgio). |
