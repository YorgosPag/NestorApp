# ADR-373: FileRecord ISO 19650 Metadata Enrichment (Phase 1 — Schema + AI Auto-Fill)

| Metadata | Value |
|----------|-------|
| **Status** | 🟡 DRAFT — Phase 1 Recognition complete, awaiting final clarifications before implementation |
| **Date** | 2026-05-24 |
| **Category** | File Management / Document Governance / AI Pipeline |
| **Author** | Γιώργος Παγώνης + Claude (Opus 4.7) |
| **Phase** | 1 of 3 (Schema + AI auto-fill — no UI yet) |

---

## Summary

Επέκταση του `FileRecord` (ADR-191) με 5 optional ISO 19650 / BS 1192 metadata
fields, **χωρίς αλλαγή του storage path layer** (ADR-018, ADR-054, ADR-293).

**Αρχιτεκτονική απόφαση**: **υβριδικό σύστημα δύο επιπέδων** —
- **Επίπεδο 1 (user-facing)**: οι υπάρχουσες **7 ομάδες μελετών** (study groups) και τα **211 upload entry points** παραμένουν αμετάβλητα.
- **Επίπεδο 2 (AI-driven, hidden)**: τα 5 νέα ISO πεδία γεμίζουν **αυτόματα από τον AI classifier** (gpt-4o-mini σήμερα, model-agnostic για το αύριο). Ο χρήστης μπορεί να τα διορθώσει χειροκίνητα.

Backward-compatible: όλα τα νέα fields optional, υπάρχοντα αρχεία = `undefined`/`null` (Firestore rule `?? null`).

---

## Related ADRs

| ADR | Σχέση | Πώς συνδέονται |
|-----|-------|----------------|
| **ADR-191** Enterprise Document Management | **Parent** | Master FileRecord model — αυτό το ADR επεκτείνει το schema |
| **ADR-018** Unified Upload Service | Foundation | Gateway/Strategy pattern — αμετάβλητο |
| **ADR-054** Enterprise Upload Consolidation | Foundation | `buildStoragePath()` SSoT — αμετάβλητο |
| **ADR-293** File Naming/Path SSoT Audit | Audit reference | Επιβεβαιώνει zero impact στο path layer |
| **ADR-080** Universal AI Pipeline | Consumer dependency | Ο classifier θα γεμίζει τα νέα πεδία |
| **ADR-189** §B98 ISO 19650 grid templates | Sibling | Άλλη όψη του standard (structural grids), zero overlap |
| **ADR-296** File-Type Classification SSoT | Reuse | Pattern για registry + ratchet enforcement |

---

## Context & Problem

### Τι ζήτησε ο Γιώργος (24/05/2026)

Έχει οργανώσει το τοπικό filesystem (`F:\ΘΕΡΜΗ_ΝΕΟΔΜΗΤΑ`) σε enterprise ISO 19650 structure:
```
PROJECT → DISCIPLINE (10_ΑΔΕΙΟΔΟΤΗΣΗ, 20_ΑΡΧΙΤΕΚΤΟΝΙΚΑ, 30_ΣΤΑΤΙΚΑ, …)
        → STATUS (WIP / ΕΓΚΕΚΡΙΜΕΝΑ / ΑΡΧΕΙΟ)
        → FORMAT (PDF / DWG / DXF)
        → CONTROLLED_FILENAME (Α-101_…_R01.pdf)
```

Reference docs: `ENTERPRISE_DOCUMENT_CONTROL_GUIDE.pdf` (12 sections), `LEGENDA.txt`,
`DOCUMENT_CODES_REGISTER.xlsx`.

**Στόχος**: η εφαρμογή Nestor να μπορεί να αναπαραστήσει το ίδιο semantic
information μέσω metadata, **χωρίς να σπάσει το SaaS storage SSoT** που είναι
ήδη 100% κεντρικοποιημένο (ADR-293).

### Phase 1 Recognition — τι βρέθηκε στον υπάρχοντα κώδικα

| Εύρημα | Τιμή | Επίπτωση στο ADR |
|--------|------|------------------|
| **Upload entry points** (`src/config/upload-entry-points/entries-*.ts`) | **211 σε 8 αρχεία** | Δεν εφευρίσκουμε νέα schemas — επεκτείνουμε τα υπάρχοντα |
| **Study groups** (`src/config/study-groups-config.ts`) | **7 ομάδες** (administrative, fiscal, architectural, structural, mechanical, energy, site) | Αυτές είναι ήδη πιο πλούσιες από τα 8 ISO 19650 letters — δεν τις αντικαθιστούμε, τις **εμπλουτίζουμε** |
| **AI classifier** (`contact-document-classifier.ts`) | OpenAI vision + 117 contact purposes | Pattern αναπαράγεται για study/project/building/property → νέοι classifiers per entity domain |
| **FileRecord existing fields** σχετικά | `purpose`, `revision`, `lifecycleState`, `buildingLabel`, `domain`, `category`, `classification` | Όλα τα νέα πεδία ορθογώνια — zero conflict (βλ. §Decision D2-D5) |
| **Storage path layer** | 100% κεντρικοποιημένο (ADR-293), `buildStoragePath()` SSoT | **Zero changes** — όλα τα νέα fields ζουν μόνο στο Firestore document |
| **CLAUDE.md "ADR-370 next free"** | ΛΑΘΟΣ — υπάρχουν ήδη ADR-370/371/372 | Νέο ADR = **373** (επόμενο διαθέσιμο verified από Glob) |

### ADR vs Code drift report

- **ADR-191**: ✅ structural match. Λέει "FileRecord = 586 lines" — τώρα 809 (μη-structural prosth: type guards/queries). Καμία ζημιά, μόνο count refresh στο changelog μετά την υλοποίηση.
- **ADR-293**: ✅ 100% match. Centralization 100%, legacy pipeline deleted.
- **ADR-018 / ADR-054**: ✅ Foundation stable, αμετάβλητο.

**Συμπέρασμα Phase 1**: zero structural drift. Phase 1 = pure additive enrichment.

---

## Decision

### D1. Νέα FileRecord fields (όλα optional, AI-fillable, manually-overridable)

```typescript
// src/types/file-record.ts — additions
export interface FileRecord {
  // ... existing fields ...

  /**
   * 🌐 ISO 19650-2 §5.1.7 — Discipline code (single letter)
   * Αυτόματα γεμίζεται από τον AI classifier ή derived από το `purpose` → `group` mapping.
   * Manual override μέσω file detail dialog.
   * @see ADR-373
   */
  disciplineCode?: DisciplineCode;

  /**
   * 🌐 ISO 19650 — Document series (100=κατόψεις, 200=όψεις, …)
   * Auto-detected από AI ή entry point purpose.
   */
  documentSeries?: DocumentSeries;

  /**
   * 🌐 ISO 19650-2 — Revision tag (P01/R01/IFA/IFR/IFC/ASB)
   * AI parses title block ή filename pattern.
   */
  revisionCode?: string; // validated by REVISION_CODE_REGEX

  /**
   * 🌐 ISO 19650-1 §10.2 — Common Data Environment workflow state.
   * ΟΡΘΟΓΩΝΙΟ προς `lifecycleState` (που είναι retention state).
   * WIP = work-in-progress, SHARED = under review, PUBLISHED = authorized,
   * ARCHIVED = superseded.
   */
  cdeState?: CdeState;

  /**
   * 🌐 ISO 19650 — Building short code (Κ1, Κ2, B3, …)
   * Διαφορετικό από `buildingLabel` (UI display).
   */
  buildingCode?: string; // validated by BUILDING_CODE_REGEX

  /**
   * 🤖 ISO 19650 metadata source audit
   * Καταγράφει αν τα παραπάνω fields γέμισαν από AI ή χρήστη.
   */
  iso19650Source?: {
    filledBy: 'ai' | 'user' | 'derived';
    aiProvider?: string;        // π.χ. 'openai-gpt-4o-mini'
    aiConfidence?: number;       // 0..1
    aiReasoning?: string;        // 1-sentence Greek
    filledAt: Date | string;
    overriddenBy?: string;       // userId αν ο χρήστης άλλαξε AI suggestion
    overriddenAt?: Date | string;
  };
}
```

### D2. Νέο config module: `src/config/iso19650-constants.ts`

```typescript
/**
 * ISO 19650 metadata constants — SSoT.
 * Mapping από τις 7 υπάρχουσες study groups (study-groups-config.ts).
 *
 * @see ADR-373
 */

import type { StudyGroup } from './study-groups-config';

// ─── Discipline Codes ───────────────────────────────────────────────────────

export const DISCIPLINE_CODES = {
  A: { studyGroup: 'architectural' as StudyGroup, label: 'Architectural', labelEl: 'Αρχιτεκτονικά' },
  S: { studyGroup: 'structural' as StudyGroup, label: 'Structural', labelEl: 'Στατικά' },
  M: { studyGroup: 'mechanical' as StudyGroup, label: 'Mechanical (HVAC/Plumbing)', labelEl: 'Μηχανολογικά' },
  E: { studyGroup: 'mechanical' as StudyGroup, label: 'Electrical', labelEl: 'Ηλεκτρολογικά' }, // split from mechanical via AI
  K: { studyGroup: 'energy' as StudyGroup, label: 'KENAK (Energy)', labelEl: 'Ενεργειακά (ΚΕΝΑΚ)' },
  H: { studyGroup: 'site' as StudyGroup, label: 'HSE (Health/Safety/Environment)', labelEl: 'ΣΑΥ-ΦΑΥ / Εργοταξιακά' },
  N: { studyGroup: 'administrative' as StudyGroup, label: 'Notarial/Legal', labelEl: 'Διοικητικά/Νομικά' },
  X: { studyGroup: 'fiscal' as StudyGroup, label: 'Fiscal', labelEl: 'Φορολογικά/Ασφαλιστικά' },
  // Optional letters TBD in next session (see Open Questions)
  // T: Topographic, L: Lift, P: Permits, F: Fire safety, D: ΑΕΚΚ demolition waste
} as const;

export type DisciplineCode = keyof typeof DISCIPLINE_CODES;

// ─── Document Series ────────────────────────────────────────────────────────

export const DOCUMENT_SERIES = {
  100: { label: 'Κατόψεις', en: 'Plans' },
  200: { label: 'Όψεις', en: 'Elevations' },
  300: { label: 'Τομές', en: 'Sections' },
  400: { label: 'Λεπτομέρειες', en: 'Details' },
  500: { label: 'Κουφώματα / Πίνακες', en: 'Schedules' },
  600: { label: 'Διαμορφώσεις', en: 'Landscape' },
} as const;

export type DocumentSeries = keyof typeof DOCUMENT_SERIES;

// ─── CDE States (ISO 19650-1 §10.2) ─────────────────────────────────────────

export const CDE_STATES = {
  WIP:       { labelEl: 'Σε εξέλιξη', labelEn: 'Work in Progress' },
  SHARED:    { labelEl: 'Σε διαβούλευση', labelEn: 'Shared for Review' },
  PUBLISHED: { labelEl: 'Εγκεκριμένο', labelEn: 'Authorized for Use' },
  ARCHIVED:  { labelEl: 'Αρχειοθετημένο (ISO)', labelEn: 'Superseded (ISO archive)' },
} as const;

export type CdeState = keyof typeof CDE_STATES;

// ─── Validators (regex SSoT) ────────────────────────────────────────────────

/** P01-P99 (preliminary), R01-R99 (revision), IFA/IFR/IFC/ASB (ISO stage tags) */
export const REVISION_CODE_REGEX = /^(?:[PR]\d{2}|IFA|IFR|IFC|ASB)$/;

/** Κ1, K12, Β3, B12 — Greek/Latin uppercase letter + 1-2 digits */
export const BUILDING_CODE_REGEX = /^[Α-ΩA-Z]\d{1,2}$/;

// ─── Reverse Mapping ────────────────────────────────────────────────────────

/**
 * StudyGroup → default DisciplineCode (one-to-one for unambiguous groups,
 * AI required to disambiguate 'mechanical' → M vs E based on content).
 */
export const STUDY_GROUP_TO_DEFAULT_DISCIPLINE: Record<StudyGroup, DisciplineCode> = {
  administrative: 'N',
  fiscal: 'X',
  architectural: 'A',
  structural: 'S',
  mechanical: 'M',  // AI may override to 'E' based on content
  energy: 'K',
  site: 'H',
};
```

### D3. Orthogonality rationale (γιατί τα νέα πεδία ΔΕΝ συγκρούονται με υπάρχοντα)

| Υπάρχον πεδίο | Νέο πεδίο | Γιατί συνυπάρχουν |
|----------------|-----------|--------------------|
| `lifecycleState` (active/trashed/archived/purged) | `cdeState` (WIP/SHARED/PUBLISHED/ARCHIVED) | Διαφορετικά state machines: lifecycle = data retention, cde = workflow. Ένα PUBLISHED αρχείο στο CDE μπορεί να γίνει `trashed` στην app (κατά λάθος delete) ή `archived` (lifecycle archive ≠ CDE archive=superseded). |
| `domain` (admin/construction/sales/accounting/legal) | `disciplineCode` (A/S/M/E/K/H/N/X) | Domain = business area, discipline = engineering/permit specialty. Ένα `construction × S` ≠ `construction × M`. |
| `revision?: number` | `revisionCode?: string` | Internal counter (1,2,3…) vs ISO tag (P01/R01/IFC). Coexist χωρίς redundancy. |
| `buildingLabel?: string` ("Κτίριο Α") | `buildingCode?: string` ("Κ1") | Label = UI display, code = sortable/exportable identifier. |
| `purpose: string` (από entry point, 211 τιμές) | `disciplineCode + documentSeries` | Purpose = WHAT (functional intent), discipline+series = WHERE in ISO taxonomy. Purpose ΔΕΝ αντικαθίσταται. |

### D4. Storage path — ZERO impact

`buildStoragePath()` δεν αλλάζει. Pattern παραμένει:
```
companies/{cid}/entities/{type}/{id}/domains/{domain}/categories/{cat}/files/{fid}.ext
```

Όλα τα νέα fields ζουν **μόνο στο Firestore document**. Δεν μπαίνουν στο storage path.

**Γιατί**: ADR-293 audit (100% canonical) δεν πρέπει να σπάσει. Επιπλέον, αν αλλάζαμε path layer, όλα τα υπάρχοντα uploads θα έπρεπε να γίνουν re-pathed.

### D5. AI Auto-Fill Architecture

#### D5.1 Πώς γεμίζουν τα πεδία

```
Upload από user
   │
   ▼
[Existing pipeline] FileRecord created με purpose από entry point
   │
   ▼
[NEW] Fire-and-forget call to enriched classifier:
   ├─ Step 1: Derive defaults από purpose → study group → DisciplineCode
   │           (zero-cost, καμία AI κλήση)
   ├─ Step 2: AI vision call (gpt-4o-mini) διαβάζει το αρχείο
   │           Extract: disciplineCode (override default αν χρειάζεται),
   │                    documentSeries, revisionCode, buildingCode, cdeState
   └─ Step 3: Update FileRecord με τα 5 πεδία + iso19650Source audit
```

#### D5.2 Model-agnostic design

Ο classifier χρησιμοποιεί το υπάρχον pattern `AI_ANALYSIS_DEFAULTS`
(`src/config/ai-analysis-config.ts`). Αλλαγή από gpt-4o-mini σε Claude/άλλο
μοντέλο = αλλαγή σε ΕΝΑ config — μηδέν επιπτώσεις στον classifier κώδικα.

#### D5.3 Manual override

Στο file detail dialog (Phase 2 scope, όχι Phase 1), ο χρήστης μπορεί να
αλλάξει οποιοδήποτε από τα 5 πεδία. Όταν το κάνει, καταγράφεται στο
`iso19650Source.overriddenBy` + `overriddenAt`.

#### D5.4 Νέοι classifiers (Phase 1.5 — μετά το schema)

| Νέο αρχείο | Σκοπός | Αντιγράφει pattern από |
|------------|--------|------------------------|
| `src/services/ai-pipeline/tools/handlers/iso19650-enricher.ts` | Universal enricher — δέχεται οποιοδήποτε FileRecord, βγάζει 5 ISO πεδία | `contact-document-classifier.ts` |
| (Optional, Phase 2) `study-document-classifier.ts` | Αντίστοιχο του contact-document-classifier αλλά για study purposes | `contact-document-classifier.ts` |

---

## Migration Strategy

| Σενάριο | Συμπεριφορά |
|---------|-------------|
| **Υπάρχοντα FileRecords** (πριν την υλοποίηση) | Όλα τα νέα fields = `undefined`. Καμία ζημιά. |
| **Backfill υπαρχόντων** | Optional batch script (Phase 2 scope, όχι τώρα). Θα τρέξει `iso19650-enricher` ασύγχρονα για το backlog. |
| **Νέα uploads μετά την υλοποίηση** | Auto-filled από AI εντός 3-10 δευτερολέπτων μετά το upload (fire-and-forget). |
| **Firestore indexes** | **Καμία αλλαγή στην Phase 1** — όλα optional, no queries by these fields. Όταν χρειαστεί filter (Phase 2) → composite indexes per query pattern. |
| **Backward-compat queries** | Όλες οι υπάρχουσες queries συνεχίζουν αμετάβλητες. |

---

## Phase Roadmap

```
Phase 1 (αυτό το ADR): SCHEMA + AI AUTO-FILL
  ├─ FileRecord fields (5 optional + iso19650Source audit)
  ├─ iso19650-constants.ts (enums + regex)
  ├─ iso19650-enricher.ts (AI classifier extension)
  ├─ Unit tests (validators, mapping, AI fallback)
  └─ Zero UI changes, zero storage path changes

Phase 2 (μελλοντικό ADR): UI + MANUAL OVERRIDE + VIRTUAL FOLDERS
  ├─ File detail dialog για manual edit
  ├─ Virtual ISO 19650 folder view στο file manager
  │   (filter by disciplineCode/documentSeries/cdeState)
  ├─ Badge "🤖 AI: A-100-R02" στο FileCard
  └─ Backfill script για existing files

Phase 3 (μελλοντικό ADR): ZIP EXPORT + ISO COMPLIANCE
  ├─ Controlled filename generator (Α-101-R02.pdf)
  ├─ ZIP με ISO 19650 hierarchy
  │   (DISCIPLINE/STATUS/FORMAT/CONTROLLED_FILENAME)
  ├─ Export προς ΥΔΟΜ/πελάτες/συνεργάτες
  └─ Compliance report PDF
```

---

## Implementation Outline (Phase 1 only — pending Giorgio's final approvals)

| # | Αρχείο | Δράση | Εκτ. LOC |
|---|--------|-------|----------|
| 1 | `src/config/iso19650-constants.ts` | **NEW** — enums + regex + StudyGroup mapping | ~120 |
| 2 | `src/types/file-record.ts` | EDIT — add 5 optional fields + `iso19650Source` audit | +50 |
| 3 | `src/services/iso19650/validators.ts` | **NEW** — type guards, regex validators, deriveFromPurpose() | ~80 |
| 4 | `src/services/ai-pipeline/tools/handlers/iso19650-enricher.ts` | **NEW** — AI vision call + parse + update FileRecord | ~250 |
| 5 | `src/services/ai-pipeline/tools/handlers/__tests__/iso19650-enricher.test.ts` | **NEW** — Jest tests (mock AI, fallback, manual override) | ~150 |
| 6 | `src/config/__tests__/iso19650-constants.test.ts` | **NEW** — regex edge cases, enum exhaustive, mapping | ~100 |
| 7 | Hook στο upload finalize pipeline | EDIT — fire-and-forget call στον enricher | +15 |
| 8 | `docs/centralized-systems/reference/adrs/ADR-373-iso19650-metadata-enrichment.md` | **THIS FILE** | ~350 |
| 9 | `docs/centralized-systems/reference/adrs/ADR-191-enterprise-document-management.md` | EDIT — changelog entry + cross-link | +5 |
| 10 | `docs/centralized-systems/reference/adrs/ADR-293-file-naming-storage-path-ssot-audit.md` | EDIT — changelog "ADR-373 metadata-only" | +3 |
| 11 | `docs/centralized-systems/reference/adr-index.md` | EDIT — auto-regen script | auto |
| 12 | `local_ΑΝΑΦΟΡΑ_2.txt` | EDIT — add ADR-373 status entry | +1 row |

**Σύνολο Phase 1**: 6 new + 4 edits + 1 auto + 1 ADR file = **~12 files**, **~715 LOC νέου κώδικα + 350 LOC docs**.

**Domain**: single (FileRecord schema + AI classifier extension). **Πολυπλοκότητα**: cross-cutting (touches schema + AI pipeline + tests). Per N.8 → Orchestrator territory. Decision: **plan-mode-then-orchestrator** sequence.

**ΟΧΙ Phase 1 scope**:
- UI components (κουμπιά, badges, dialogs)
- Manual override flow
- Virtual ISO 19650 folder view
- Firestore indexes (όχι ακόμα queries)
- AI auto-classification for the full 117 contact purposes (αυτό υπάρχει ήδη — ADR-191 §2.2)
- Backfill scripts
- ZIP export με ISO hierarchy

---

## Architectural Prohibitions (κληρονομούνται)

| Κανόνας | Πηγή |
|---------|------|
| ❌ Hardcoded Greek/English strings → όλα μέσω i18n (`t('key')`) | CLAUDE.md N.11 |
| ❌ `any`, `as any`, `@ts-ignore` → discriminated unions/generics | CLAUDE.md N.2 |
| ❌ `addDoc()`, inline IDs → `enterprise-id.service.ts` | CLAUDE.md N.6 |
| ❌ Hardcoded paths → πάντα `buildStoragePath()` | ADR-293 |
| ❌ `undefined` σε Firestore → `?? null` | ADR-191 |
| ❌ `disciplineCode`/`cdeState` δεν επηρεάζουν storage path | This ADR D4 |
| ❌ AI classifier ΔΕΝ blocking για το upload (πάντα fire-and-forget) | ADR-191 §2.2 pattern |

---

## Open Questions για επόμενη session (καθαρό context)

⚠️ **ΠΡΟΣΟΧΗ**: αυτές δεν έχουν απαντηθεί ακόμα. Πριν προχωρήσει η υλοποίηση,
ο Γιώργος θα δώσει διευκρινίσεις σε νέα session.

### OQ1 — Optional discipline letters
Πέρα από τα 8 βασικά (A/S/M/E/K/H/N/X), προτάθηκαν αρχικά: **T** (Topographic),
**L** (Lift), **P** (Permits), **F** (Fire safety), **D** (ΑΕΚΚ demolition).
- Αυτά τα 5 είναι κατά τη συζήτηση **υπό απόφαση**.
- Παρατήρηση: T/P/F/D ίσως καλύπτονται από την ομάδα `administrative` ή `site`. Μήπως αρκούν τα 8;
- L (ανελκυστήρες) ξεχωριστή ειδικότητα → ίσως αξίζει separate letter.

### OQ2 — Revision code regex
Σήμερα: `^(P[0-9]{2}|R[0-9]{2}|IFA|IFR|IFC|ASB)$`.
- Να επεκταθεί σε `T01` (tender), `C01` (construction), `AB01` (as-built variant);
- Να επιτραπεί 3 ψηφία (R001-R999) για πολύ μεγάλα έργα;

### OQ3 — Document series strictness
Σήμερα: literal union `100|200|300|400|500|600`.
- Strict (type safety) ή ευέλικτο (`number` με runtime check) για επεκτασιμότητα;
- Να προστεθούν: 700 (στατικά plans), 800 (Η/Μ schematics), 900 (as-built);

### OQ4 — CDE state naming
Σήμερα: `WIP / SHARED / PUBLISHED / ARCHIVED`.
- Το `ARCHIVED` συγκρούεται **σε string τιμή** με το `lifecycleState: 'archived'`
  (lowercase). Πρόταση: keep uppercase distinction.
- Εναλλακτικά: rename σε `SUPERSEDED` (πιο σαφές ISO).

### OQ5 — Building code regex
Σήμερα: `^[Α-ΩA-Z][0-9]{1,2}$` (π.χ. Κ1, B12).
- Να επιτραπεί composite codes τύπου `Κ1-Α` (κτίριο + πτέρυγα);
- Να αλλάξει σε `^[Α-ΩA-Z]+[0-9]{1,3}$` (πιο ελαστικό);

### OQ6 — AI enricher trigger
Σήμερα: fire-and-forget μετά το upload finalize.
- Πότε ξανατρέχει αν το αρχείο τροποποιηθεί (replaced binary);
- Throttling — αν 100 αρχεία ανέβουν μαζί, όλα asynchronously;
- Budget limit — μέγιστο cost ανά αρχείο (gpt-4o-mini = ~$0.001/file vision call);

### OQ7 — Auto-derivation από purpose
Πριν τρέξει AI, θα γίνει "cheap" derivation από `purpose → study group → DisciplineCode`.
- Αν `confidence === 1.0` (unambiguous mapping), να SKIP-άρουμε το AI call για cost?
- Π.χ. το purpose `'study-floorplan'` → `architectural` → `'A'` — δεν χρειάζεται AI.

### OQ8 — ADR-370/371 duplicates cleanup
Filesystem έχει `ADR-370-bim-readonly-visualization.md` ΚΑΙ `ADR-370-bim-corner-snap-system.md`
+ `ADR-371-bim-3d-readonly-viewer.md` ΚΑΙ `ADR-371-bim-corner-snap-system.md`.
- Ξεχωριστή εργασία — όχι μέρος του ADR-373, αλλά να καταγραφεί στο `pending-ratchet-work.md`.

---

## Industry References

| Standard | §  | Σχέση |
|----------|---|-------|
| ISO 19650-1:2018 | §10.2 | Common Data Environment states (WIP/Shared/Published/Archived) |
| ISO 19650-2:2018 | §5.1.7 | Naming Conventions — discipline + type + role + revision |
| ISO 19650-2:2018 | §5.4 | Information Container metadata fields |
| BS 1192:2007+A2:2016 | All | Predecessor schema (still common in UK practice — backward read compat) |
| **Industry implementations**: Autodesk Construction Cloud, Trimble Connect, Bentley ProjectWise, Bimplus, BIM 360 Docs | — | Όλα συγκλίνουν στο pattern "user-friendly category + ISO metadata layer" |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-05-24 | Initial DRAFT — Phase 1 Recognition complete. Hybrid 2-layer architecture decided (7 user-facing groups + 5 AI-driven ISO 19650 fields). Implementation pending Giorgio's final clarifications (8 open questions). | Claude (Opus 4.7) + Γιώργος Παγώνης |
