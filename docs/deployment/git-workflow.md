# Git Workflow & Commit/Push Protocol

**Status:** Active
**Owner:** Γιώργος Παγώνης
**Last updated:** 2026-04-13
**Referenced from:** `CLAUDE.md` SOS N.(-1)

---

## 🚨 Core Rule: Commit αυτόνομα, push ΜΟΝΟ με ρητή εντολή

- Μετά από κάθε **επιτυχημένη προσπάθεια** → `git commit` αυτόνομα
- Μετά το commit → **ΣΤΑΜΑΤΑ** και **ΠΕΡΙΜΕΝΕ** εντολή Γιώργου
- Push triggers: "push", "στείλε", "ανέβασε"
- **ΓΙΑΤΙ**: Κάθε push → GitHub Actions → **Netcup** → **ζωντανά στο
  nestorconstruct.gr**. Ο Γιώργος αποφασίζει πότε αλλάζει η παραγωγή.

⚠️ **ΟΧΙ Vercel.** Το Vercel είναι **παγωμένο από 2026-05-09**: free tier, χωρίς
build credits, μηδενικό κόστος ανά push. **Μην** επικαλείσαι «Vercel build» ή
«credits» ως συνέπεια του push, και **μην** προτείνεις ενέργειες Vercel. Οι
αποτυχίες του CI (GitHub Actions) **δεν** μπλοκάρουν το deploy στο Netcup —
είναι ξεχωριστά συστήματα.

---

## 📋 Full sequence (Google-style ordered flow)

### ✅ ΒΗΜΑ 1: GIT COMMIT (αυτόνομα)
```bash
git add [specific files]  # όχι -A / .
git commit -m "..."
```

Στο background mode (`run_in_background: true`) για να μην μπλοκάρει το conversation.

### ⏸️ ΒΗΜΑ 2: ΠΕΡΙΜΕΝΕ ΕΝΤΟΛΗ PUSH
**Stop.** Περίμενε τον Γιώργο.

### ✅ ΒΗΜΑ 3 (όταν ζητηθεί): git push
```bash
git push origin main
```
→ Αυτόματο: `docker-build.yml` χτίζει το standalone → GHCR → trigger redeploy στο
**Coolify** (Netcup) → production live στο **https://nestorconstruct.gr**.

### ✅ ΒΗΜΑ 4 (optional, on request): BACKUP_SUMMARY.json
Δημιουργείται **ΜΟΝΟ** αν ο Γιώργος ζητήσει πλήρες backup ZIP. Schema:
- `category`: FIX / FEATURE / REFACTOR / STABLE / WIP / CLEANUP
- `shortDescription`: 1-line
- `problem`, `cause`, `filesChanged`, `solution`, `testing`, `notes`
- `contributors`: { user, assistant, sessionDate }
- `commits`: array of { hash, message }

### ✅ ΒΗΜΑ 5 (optional): Enterprise Backup ZIP
Δες `docs/deployment/enterprise-backup.md` για το full PS1 script protocol.

---

## 🚫 ΑΠΑΓΟΡΕΥΣΕΙΣ

- ❌ Backup αν η προσπάθεια **απέτυχε**
- ❌ Push χωρίς ρητή εντολή
- ❌ `git add -A` / `git add .` — staging μόνο συγκεκριμένων αρχείων (αποφυγή sensitive files)
- ❌ `--no-verify` / `--no-gpg-sign` — ΠΟΤΕ skip hooks
- ❌ `git amend` σε published commit — πάντα νέο commit
- ❌ `--force-push` σε main/master χωρίς ρητή εντολή

---

## 🔄 "Safety checkpoint" convention

Όταν ο Γιώργος λέει **"safety checkpoint"**:
- **Σημαίνει**: commit + push (μόνο αυτό)
- **ΔΕΝ σημαίνει**: BACKUP_SUMMARY.json
- **ΔΕΝ σημαίνει**: enterprise-backup.ps1 ZIP

Απλά: `git add [files]` → `git commit -m "..."` → `git push origin main`.

---

## 🗄️ `vercel.json` — αδρανές, διατηρείται ως ρύθμιση

Το αρχείο **δεν εκτελείται**: το Vercel είναι παγωμένο. Τα `autoCancel` /
`ignoreCommand` θα ίσχυαν μόνο αν το ξεπάγωνε ο Γιώργος.

⚠️ **Το μπλοκ `crons` αφαιρέθηκε 2026-07-31 (ADR-740).** Ήταν το **μοναδικό**
μέρος όπου ζούσε το πρόγραμμα των προγραμματισμένων εργασιών — και επειδή κανείς
δεν το διάβαζε, **καμία εργασία δεν έτρεξε επί τρεις μήνες** (ούτε ένα αντίγραφο
ασφαλείας). Το πρόγραμμα ζει πλέον στο **`src/config/cron-schedule.ts`**.

**ΜΗΝ ξαναβάλεις `crons` εδώ** — απαγορεύεται από το module `cron-schedule` του
`.ssot-registry.json`.

---

## 🚨 Emergency Rollback

Αν production σπάσει, **ΖΗΤΑ ΕΝΤΟΛΗ ΓΙΩΡΓΟΥ** πρώτα:
```bash
git revert HEAD              # δημιουργεί νέο commit που ακυρώνει το τελευταίο
# Περίμενε εντολή:
git push origin main
```

**ΠΟΤΕ** `git reset --hard` σε published commit χωρίς ρητή εντολή.

---

## 📊 Production Monitoring

- **Production URL**: **https://nestorconstruct.gr** (Netcup/Coolify).
  ⚠️ Το παλιό `nestor-app.vercel.app` είναι **νεκρό/legacy** — μην το επικαλείσαι.
- **Deploy logs**: GitHub Actions (`docker-build.yml`) + πίνακας Coolify
- **Ειδοποίηση**: Telegram στο τέλος κάθε build (επιτυχία **και** αποτυχία)
- **Προγραμματισμένες εργασίες**: Sentry Crons — χαμένο check-in ⇒ issue.
  Το πρόγραμμα: `src/config/cron-schedule.ts` (ADR-740)
