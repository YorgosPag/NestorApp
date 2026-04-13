# Enterprise Backup System

**Status:** Active
**Owner:** Γιώργος Παγώνης
**Last updated:** 2026-04-13
**Referenced from:** `CLAUDE.md` Enterprise Backup section

---

## 🚀 Command

Όταν ο Γιώργος ζητήσει **"κάνε backup zip"**, τρέξε **ΠΑΝΤΑ**:

```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Nestor_Pagonis\enterprise-backup.ps1"
```

**ΠΟΤΕ** μη χρησιμοποιείς το παλιό `auto-backup.ps1` — ΜΟΝΟ `enterprise-backup.ps1`.

---

## ✅ Τι κάνει το `enterprise-backup.ps1`

1. **📋 Διαβάζει `BACKUP_SUMMARY.json`** — Παίρνει category + description
2. **📁 Αντιγράφει ΟΛΟΚΛΗΡΟ το project tree** — όλα εκτός `node_modules`
3. **🗜️ Δημιουργεί ZIP** — με αυτόματο timestamp και smart naming
4. **📍 Αποθηκεύει στο**: `C:\Users\user\Downloads\BuckUps\Zip_BuckUps-2\`
5. **✅ Επαληθεύει** — έλεγχος ότι περιλαμβάνει `src/`, `packages/`, `public/`
6. **📄 Ενσωματώνει `BACKUP_SUMMARY.json`** μέσα στο ZIP

---

## 📁 Περιεχόμενα ZIP

### ✅ Περιλαμβάνονται
- `src/` — όλος ο source code
- `packages/` — core packages
- `public/` — static assets
- `scripts/` — build scripts
- Configuration files (`.env`, `package.json`, tsconfig, κλπ)
- Documentation (`*.md` files)
- `BACKUP_SUMMARY.json` — metadata

### ❌ Εξαιρούνται
- `node_modules/`
- `.next/`, `.git/`, `dist/`, `build/`
- `*.log` files, temp files

---

## 🎯 Αποτέλεσμα

- **Reliable 11–15 MB ZIP** με όλο το project
- **Smart filename**: `YYYYMMDD_HHMM - [CATEGORY] - Complete Project Backup.zip`
- Ready για restore από οποιονδήποτε Claude agent

---

## 🚫 Πότε ΔΕΝ κάνεις backup

- Όταν η προσπάθεια **απέτυχε** (code broken, tests failing)
- Όταν ο Γιώργος δεν το ζήτησε ρητά
- Όταν ζήτησε απλό "safety checkpoint" (= commit + push μόνο, δες `git-workflow.md`)
