---
name: backup
description: Δημιούργησε BACKUP_SUMMARY.json + τρέξε enterprise-backup.ps1
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep
argument-hint: "[CATEGORY] [description]"
---

# Enterprise Backup

## Εντολή
$ARGUMENTS

## Flow

### 1. Ανάλυση αλλαγών
- `git log --oneline -10` — τι commits έγιναν
- `git diff HEAD~N --stat` — ποια αρχεία άλλαξαν

### 2. Δημιούργηση BACKUP_SUMMARY.json
Γέμισε ΟΛΟΚΛΗΡΟ — κανένα κενό πεδίο:

```json
{
  "category": "FEATURE|FIX|REFACTOR|STABLE|WIP|CLEANUP|DOCS",
  "shortDescription": "Σύντομη περιγραφή (1 γραμμή)",
  "problem": "Τι ήταν το πρόβλημα/requirement",
  "cause": "Γιατί συνέβη ή γιατί χρειάστηκε",
  "filesChanged": [
    "src/path/file.ts (NEW — ~lines: description)",
    "src/path/other.ts (MODIFIED — description)"
  ],
  "solution": "Πώς λύθηκε (λεπτομερής περιγραφή)",
  "testing": "Τι testing έγινε",
  "notes": "Κρίσιμες παρατηρήσεις",
  "contributors": {
    "user": "Γιώργος Παγώνης",
    "assistant": "Claude Opus 4.6",
    "sessionDate": "YYYY-MM-DD"
  },
  "relatedBackups": [],
  "commits": [
    { "hash": "abc1234", "message": "commit message" }
  ]
}
```

### 3. Εκτέλεση backup
```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Nestor_Pagonis\enterprise-backup.ps1"
```

### 4. Επιβεβαίωση
Report: ZIP path + size + περιεχόμενα

## ΚΑΝΟΝΕΣ
- ❌ ΠΟΤΕ backup αν η εργασία ΑΠΕΤΥΧΕ
- ❌ ΠΟΤΕ backup χωρίς πρώτα git push
- ✅ ΜΟΝΟ μετά από επιτυχημένη εργασία + push
