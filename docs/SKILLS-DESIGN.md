# Nestor App — Claude Code Skills Design

> **Status**: DRAFT — Προς έγκριση από τον Γιώργο
>
> **Σκοπός**: Σχεδιασμός επαναχρησιμοποιήσιμων slash commands για το Claude Code.
> Κάθε skill αυτοματοποιεί μια επαναλαμβανόμενη ροή εργασίας, μειώνοντας λάθη
> και εξασφαλίζοντας ότι κάθε Claude agent ακολουθεί τα ίδια enterprise standards.
>
> **Εγκατάσταση**: `.claude/skills/<skill-name>/SKILL.md` (project-scoped)
>
> **ΚΑΝΕΝΑ skill δεν είναι ενεργοποιημένο ακόμα.** Αυτό είναι μόνο η τεκμηρίωση.

---

## Αρχιτεκτονική Επισκόπηση

```
.claude/skills/
├── adr/SKILL.md              # /adr — Δημιουργία/ενημέρωση ADR
├── i18n/SKILL.md             # /i18n — Προσθήκη μεταφράσεων (ICU format)
├── commit/SKILL.md           # /commit — Git commit με convention
├── deploy/SKILL.md           # /deploy — Commit + push + Vercel
├── backup/SKILL.md           # /backup — Full backup workflow
├── tsc/SKILL.md              # /tsc — TypeScript check
└── search-first/SKILL.md     # (auto) — Αναζήτηση πριν γράψεις κώδικα
```

| Skill | Τρόπος κλήσης | Γράφει κώδικα; | Κίνδυνος |
|-------|---------------|----------------|----------|
| `/adr` | Μόνο χρήστης | Ναι (docs) | Χαμηλός |
| `/i18n` | Μόνο χρήστης | Ναι (JSON) | Χαμηλός |
| `/commit` | Μόνο χρήστης | Όχι (git) | Μέτριος |
| `/deploy` | Μόνο χρήστης | Όχι (git) | Υψηλός |
| `/backup` | Μόνο χρήστης | Ναι (JSON) | Χαμηλός |
| `/tsc` | Μόνο χρήστης | Όχι | Κανένας |
| `search-first` | Αυτόματο Claude | Όχι | Κανένας |

---

## Skill 1: `/adr` — Δημιουργία/Ενημέρωση ADR

**Πρόβλημα που λύνει**: Κάθε φορά δημιουργούμε ADR χειροκίνητα — ξεχνάμε metadata, numbering, ή αναγέννηση index.

### SKILL.md

```yaml
---
name: adr
description: Δημιούργησε ή ενημέρωσε ένα ADR (Architectural Decision Record)
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: "[create|update] [ID ή τίτλος]"
---

# ADR Management

## Εντολή
$ARGUMENTS

## Κανόνες

### Numbering (ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ)
1. Διαθέσιμα IDs: `145` (χρησιμοποίησε ΠΡΩΤΑ)
2. Αν δεν υπάρχουν → συνέχισε από ADR-167+
3. Ψάξε στο `docs/centralized-systems/reference/adr-index.md` τα τελευταία IDs

### Create Flow
1. Βρες επόμενο ID (Grep adr-index.md)
2. Δημιούργησε: `docs/centralized-systems/reference/adrs/ADR-{ID}-{slug}.md`
3. Πρότυπο:
   ```markdown
   # ADR-{ID}: {Τίτλος}

   ## Status
   ✅ **IMPLEMENTED** — {ημερομηνία}

   ## Context
   {Γιατί χρειάστηκε αυτή η απόφαση}

   ## Decision
   {Τι αποφασίστηκε — interfaces, patterns, locations}

   ## Files Changed
   | File | Action |
   |------|--------|
   | `path/to/file` | Description |

   ## Changelog
   - **{date}**: Initial implementation
   ```
4. Αναγέννηση index:
   ```bash
   node docs/centralized-systems/reference/scripts/generate-adr-index.cjs
   ```

### Update Flow
1. Διάβασε τρέχον ADR
2. Πρόσθεσε/ενημέρωσε sections
3. Πρόσθεσε entry στο Changelog
4. Αναγέννηση index:
   ```bash
   node docs/centralized-systems/reference/scripts/generate-adr-index.cjs
   ```

### ΚΡΙΣΙΜΟ
- Ο ΚΩΔΙΚΑΣ = SOURCE OF TRUTH. Αν ADR ≠ κώδικας → ενημέρωσε το ADR.
- ΠΟΤΕ μην κάνεις commit κώδικα χωρίς ADR update στο ΙΔΙΟ commit.
```

### Παράδειγμα χρήσης
```
/adr create Webhook Rate Limiting
/adr update 236 — Phase 4 upload flow
```

---

## Skill 2: `/i18n` — Προσθήκη Μεταφράσεων

**Πρόβλημα που λύνει**: Λάθος σύνταξη interpolation (ICU = `{name}`, ΟΧΙ `{{name}}`), ξεχασμένα namespaces, ελλιπείς μεταφράσεις.

### SKILL.md

```yaml
---
name: i18n
description: Πρόσθεσε ή ενημέρωσε i18n μεταφράσεις (ICU format)
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: "[namespace] [key.path] [el] [en]"
---

# i18n Translation Management

## Εντολή
$ARGUMENTS

## ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ: ICU FORMAT
Το project χρησιμοποιεί `i18next-icu` (src/i18n/config.ts line 46).

✅ ΣΩΣΤΟ: `"greeting": "Γειά σου {name}"`  (single braces)
❌ ΛΑΘΟΣ: `"greeting": "Γειά σου {{name}}"` (double braces — ΔΕΝ ΔΟΥΛΕΥΕΙ)

## Αρχεία
- Ελληνικά: `src/i18n/locales/el/{namespace}.json`
- Αγγλικά: `src/i18n/locales/en/{namespace}.json`

## Namespaces (υπάρχοντα)
common, filters, dxf-viewer, geo-canvas, forms, toasts, errors,
properties, crm, navigation, auth, dashboard, projects, obligations,
toolbars, compositions, tasks, users, building, contacts, units,
landing, telegram, files, storage, parking, admin, tool-hints,
accounting, banking, addresses, payments

## Flow
1. Βρες το σωστό namespace (Grep αν δεν είσαι σίγουρος)
2. Διάβασε ΚΑΙ ΤΑ ΔΥΟ αρχεία (el + en)
3. Πρόσθεσε key στο ΙΔΙΟ path και στα δύο
4. Interpolation: ΜΟΝΟ single braces `{variable}`
5. Plurals (ICU): `{count, plural, one {# αρχείο} other {# αρχεία}}`

## Χρήση στον κώδικα
```tsx
// Namespace prefix
t('properties:viewer.media.floorplanLevel', { name: level.name })

// Default namespace
const { t } = useTranslation('properties');
t('viewer.media.floorplanLevel', { name: level.name })
```
```

### Παράδειγμα χρήσης
```
/i18n properties viewer.media.newTab "Νέα Καρτέλα" "New Tab"
/i18n units multiLevel.levelCount "Επίπεδα: {count}" "Levels: {count}"
```

---

## Skill 3: `/commit` — Git Commit με Convention

**Πρόβλημα που λύνει**: Ασυνεπή commit messages, ξεχασμένο Co-Authored-By.

### SKILL.md

```yaml
---
name: commit
description: Δημιούργησε git commit με enterprise convention
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
argument-hint: "[μήνυμα ή κενό για auto-detect]"
---

# Git Commit Convention

## Convention
```
{type}({scope}): {description}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Types
| Type | Πότε |
|------|------|
| `feat` | Νέο feature |
| `fix` | Bug fix |
| `docs` | Τεκμηρίωση μόνο |
| `refactor` | Αναδιάρθρωση χωρίς αλλαγή behavior |
| `test` | Tests |
| `perf` | Performance |
| `chore` | Εργαλεία, config |

## Scopes
- `ADR-XXX` — ADR αλλαγές
- `SPEC-XXX` — Specification αλλαγές
- `enterprise` — Cross-cutting
- `i18n` — Μεταφράσεις
- Module name (π.χ. `dxf-viewer`, `accounting`)

## Flow
1. `git status` — δες τι άλλαξε
2. `git diff --staged` + `git diff` — κατανόηση αλλαγών
3. Αν ο χρήστης έδωσε μήνυμα → χρησιμοποίησέ το
4. Αν όχι → ανάλυσε τις αλλαγές και πρότεινε
5. Stage ΜΟΝΟ σχετικά αρχεία (ΟΧΙ git add -A)
6. Commit με HEREDOC format

## ΑΠΑΓΟΡΕΥΕΤΑΙ
- ❌ `git add -A` (μπορεί να πιάσει .env, credentials)
- ❌ `--no-verify` (μην σκιπάρεις hooks)
- ❌ `--amend` (εκτός αν ζητηθεί ρητά)
- ❌ Push χωρίς ρητή εντολή από τον Γιώργο
```

### Παράδειγμα χρήσης
```
/commit
/commit fix zoom-to-cursor calculation
```

---

## Skill 4: `/deploy` — Commit + Push + Vercel

**Πρόβλημα που λύνει**: Ξεχασμένα push, ή push χωρίς εντολή.

### SKILL.md

```yaml
---
name: deploy
description: Commit + push στο Vercel (ΜΟΝΟ με ρητή εντολή Γιώργου)
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
argument-hint: "[commit message]"
---

# Deploy to Vercel

## ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟΣ ΚΑΝΟΝΑΣ
Αυτό το skill κάνει `git push origin main`.
Χρησιμοποίησέ το ΜΟΝΟ αν ο Γιώργος το ζήτησε ρητά.

## Pre-flight Checks
1. `git status` — τίποτα unstaged που πρέπει να μπει;
2. `git log -1` — το τελευταίο commit είναι σωστό;
3. Αν υπάρχουν unstaged αλλαγές → commit πρώτα (χρησιμοποίησε /commit)

## Deploy Flow
1. `git push origin main`
2. Αναμονή confirmation
3. Report: commit hash + Vercel dashboard link

## ΣΤΑΜΑΤΑ ΑΝ
- Vercel deploy limit (100/day) — δούλεψε σε localhost
- Υπάρχουν TypeScript errors σε κρίσιμα αρχεία
- Ο Γιώργος δεν ζήτησε push

## Emergency Rollback
```bash
git revert HEAD
git push origin main
```
```

### Παράδειγμα χρήσης
```
/deploy
/deploy feat(ADR-236): per-level unit floorplan tabs
```

---

## Skill 5: `/backup` — Full Backup Workflow

**Πρόβλημα που λύνει**: BACKUP_SUMMARY.json ξεχνιέται ή γεμίζεται λάθος.

### SKILL.md

```yaml
---
name: backup
description: Δημιούργησε BACKUP_SUMMARY.json + τρέξε enterprise-backup.ps1
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep
argument-hint: "[CATEGORY] [description]"
---

# Enterprise Backup

## Flow
1. Ανάλυσε τι έγινε (git log, git diff)
2. Δημιούργησε BACKUP_SUMMARY.json:

```json
{
  "category": "$0",
  "shortDescription": "$1",
  "problem": "",
  "cause": "",
  "filesChanged": [],
  "solution": "",
  "testing": "",
  "notes": "",
  "contributors": {
    "user": "Γιώργος Παγώνης",
    "assistant": "Claude Opus 4.6",
    "sessionDate": "YYYY-MM-DD"
  },
  "relatedBackups": [],
  "commits": []
}
```

3. Γέμισε ΟΛΑ τα πεδία (ΟΧΙ κενά strings)
4. `filesChanged`: Κάθε αρχείο με format `"path (NEW|MODIFIED — description)"`
5. `commits`: Κάθε commit hash + message
6. Τρέξε backup:
```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Nestor_Pagonis\enterprise-backup.ps1"
```
7. Επιβεβαίωση: ZIP path + size

## Categories
FEATURE, FIX, REFACTOR, STABLE, WIP, CLEANUP, DOCS

## ΚΑΝΟΝΑΣ
- ❌ ΠΟΤΕ backup αν η εργασία ΑΠΕΤΥΧΕ
- ❌ ΠΟΤΕ backup χωρίς πρώτα git push
- ✅ ΜΟΝΟ μετά από επιτυχημένη εργασία + push
```

### Παράδειγμα χρήσης
```
/backup FEATURE per-level unit floorplan tabs
/backup FIX ICU interpolation syntax
```

---

## Skill 6: `/tsc` — TypeScript Check

**Πρόβλημα που λύνει**: Αναμονή 60-90sec για tsc, blocking workflow.

### SKILL.md

```yaml
---
name: tsc
description: TypeScript check στο background
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[files to filter ή κενό για full check]"
---

# TypeScript Check

## Κανόνας: ΠΟΤΕ blocking wait

## Flow
1. Αν δόθηκαν αρχεία:
   ```bash
   npx tsc --noEmit 2>&1 | grep -E "$ARGUMENTS"
   ```
2. Αν δεν δόθηκαν:
   ```bash
   npx tsc --noEmit
   ```
3. Τρέξε ΠΑΝΤΑ στο background (run_in_background: true)
4. Ο χρήστης ΔΕΝ περιμένει
5. Αν βρεθούν errors → αναφορά + fix αμέσως

## Γνωστά pre-existing errors (ΑΓΝΟΗΣΕ)
- `FloorplanGallery.tsx(727)` — RefObject null
- `ParkingHistoryTab.tsx(121,172)` — unknown toDate
- `LayerCanvas.tsx(220)` — arg type '5' vs '4'
```

### Παράδειγμα χρήσης
```
/tsc
/tsc ReadOnlyMediaViewer.tsx useEntityFiles.ts
```

---

## Skill 7: `search-first` — Αναζήτηση Πριν Γράψεις (Αυτόματο)

**Πρόβλημα που λύνει**: Duplicates, ξανά-ανακαλύψεις τροχού, παράβαση CLAUDE.md κανόνα N.1.

### SKILL.md

```yaml
---
name: search-first
description: >
  Πριν γράψεις ΟΠΟΙΟΔΗΠΟΤΕ νέο κώδικα, component, ή service, ΠΡΩΤΑ ψάξε αν υπάρχει
  ήδη κάτι παρόμοιο στο codebase. Χρησιμοποίησε αυτό το skill κάθε φορά που πρόκειται
  να δημιουργήσεις νέο αρχείο ή νέο component.
user-invocable: false
allowed-tools: Grep, Glob, Read
---

# Search-First Protocol

## ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟΣ ΚΑΝΟΝΑΣ (CLAUDE.md N.1)
Πριν γράψεις ΜΙΑ γραμμή κώδικα:

1. **Grep** για existing κώδικα (function names, class names, patterns)
2. **Glob** για existing αρχεία (similar names, paths)
3. **Read** centralized systems: `docs/centralized-systems/README.md`
4. Αν βρεθεί existing → **ΕΠΕΚΤΕΙΝΕ**, μη δημιουργήσεις νέο
5. Αν βρεθεί duplicate → **ΚΕΝΤΡΙΚΟΠΟΙΗΣΕ**

## Τι ψάχνεις
- Component name variations (PascalCase, kebab-case, camelCase)
- Service/hook name
- Similar business logic
- Centralized system που καλύπτει αυτή τη λειτουργία

## Αν δεν βρεθεί τίποτα → προχώρα ελεύθερα
```

---

## Σύγκριση: Πριν και Μετά τα Skills

| Ροή εργασίας | Χωρίς Skills | Με Skills |
|---|---|---|
| Commit | Ξεχνάω convention, Co-Authored-By | `/commit` → τέλειο format |
| i18n | `{{name}}` αντί `{name}` — σπάει | `/i18n` → ICU σωστά |
| ADR | Ξεχνάω numbering, αναγέννηση | `/adr` → αυτόματο |
| Deploy | Push χωρίς εντολή | `/deploy` → ρητή ενέργεια |
| Backup | Ατελές JSON | `/backup` → πλήρες |
| TSC | Blocking 90sec | `/tsc` → background |
| Νέος κώδικας | Duplicates | `search-first` → αυτόματο |

---

## Ενεργοποίηση (ΜΕΤΑ ΤΗΝ ΕΓΚΡΙΣΗ)

Μόλις ο Γιώργος εγκρίνει, δημιουργούμε τα αρχεία:

```bash
# Δομή
mkdir -p .claude/skills/{adr,i18n,commit,deploy,backup,tsc,search-first}

# Κάθε φάκελος παίρνει SKILL.md
# Τα skills γίνονται αμέσως διαθέσιμα στο Claude Code
```

**ΣΗΜΕΙΩΣΗ**: Δεν χρειάζεται restart. Τα skills φορτώνονται αυτόματα.

---

## Ανοιχτές Ερωτήσεις για τον Γιώργο

1. **Θέλεις ξεχωριστό `/safety-checkpoint`?** (commit + push μόνο, χωρίς backup)
2. **Θέλεις `/new-feature` skill?** (Plan mode → ADR → Implement → ADR update → Commit)
3. **Θέλεις skills σε project-level (`.claude/`) ή personal (`~/.claude/`)?**
4. **Ποια skills θέλεις αυτόματα (Claude καλεί μόνο του) και ποια μόνο `/command`?**
