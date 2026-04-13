# Git Workflow & Commit/Push Protocol

**Status:** Active
**Owner:** Γιώργος Παγώνης
**Last updated:** 2026-04-13
**Referenced from:** `CLAUDE.md` SOS N.(-1)

---

## 🚨 Core Rule: Commit αυτόνομα, push ΜΟΝΟ με ρητή εντολή

- Μετά από κάθε **επιτυχημένη προσπάθεια** → `git commit` αυτόνομα
- Μετά το commit → **ΣΤΑΜΑΤΑ** και **ΠΕΡΙΜΕΝΕ** εντολή Γιώργου
- Push triggers: "push", "στείλε", "ανέβασε", "πήγαινε Vercel"
- **ΓΙΑΤΙ**: Κάθε push = Vercel build = κατανάλωση credits. Ο Γιώργος πληρώνει.

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
→ Αυτόματο: GitHub Actions validation → Vercel build & deploy → Production live.

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

## 💰 Vercel Build Cost Optimization (`vercel.json`)

- **`autoCancel: true`** — Πολλά pushes σερί → ακυρώνει παλιά builds, χτίζει μόνο το τελευταίο
- **`ignoreCommand: bash scripts/ignore-build.sh`** — Push με ΜΟΝΟ μη-app αλλαγές (`.md`, `docs/`, `scripts/`) → build **skip εντελώς** (0 κόστος)
- **App αρχεία που πυροδοτούν build:** `src/`, `public/`, `packages/`, `next.config.*`, `package.json`, `package-lock.json`, `tsconfig.*`, `vercel.json`, `.env*`
- **Αρχεία που ΔΕΝ πυροδοτούν build:** `*.md`, `docs/`, `scripts/`, `adrs/`, `CLAUDE.md`, `BACKUP_SUMMARY.json`, `recovery/`

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

- **Production URL**: https://nestor-app.vercel.app
- **Vercel Dashboard**: deployment logs + build history
- **Typical build time**: 2-3 λεπτά για full deploy
