# ADR-373: FileRecord ISO 19650 Metadata Enrichment (Phase 1 — Schema + AI Auto-Fill)

| Metadata | Value |
|----------|-------|
| **Status** | ✅ Phase 1 IMPLEMENTED 2026-05-24 — Schema + AI enricher + tests + post-finalize hook SSoT. Pending Γιώργος commit. Phase 2 (UI / manual override / virtual folders / backfill / concurrency token bucket / suitabilityCode field) deferred. |
| **Date** | 2026-05-24 (clarifications session 2026-05-24) |
| **Category** | File Management / Document Governance / AI Pipeline |
| **Author** | Γιώργος Παγώνης + Claude (Opus 4.7) |
| **Phase** | 1 of 3 (Schema + AI auto-fill — no UI yet) |

---

## Summary

Επέκταση του `FileRecord` (ADR-191) με 5 optional ISO 19650 / BS 1192 metadata
fields, **χωρίς αλλαγή του storage path layer** (ADR-018, ADR-054, ADR-293).

**Αρχιτεκτονική απόφαση**: **υβριδικό σύστημα δύο επιπέδων** —
- **Επίπεδο 1 (user-facing)**: οι υπάρχουσες **7 ομάδες μελετών** (study groups) και τα **211 upload entry points** παραμένουν αμετάβλητα.
- **Επίπεδο 2 (AI-driven, hidden)**: τα 5 νέα ISO πεδία γεμίζουν **πάντα από τον AI classifier** (gpt-4o-mini σήμερα, model-agnostic για το αύριο). Always-AI policy (OQ7) — max consistency. Ο χρήστης μπορεί να τα διορθώσει χειροκίνητα (Phase 2).

**Clarifications session 2026-05-24**: 13 disciplines (A/S/M/E/K/H/N/X/T/L/P/F/D), 9 document series (100-900), CDE state `SUPERSEDED`, composite buildingCode, always-AI με $0.01/file cap. Βλ. §"Resolved Decisions".

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
   * 🌐 ISO 19650-2 — Revision tag (P01/T01/C01/R01/AB01)
   * AI parses title block ή filename pattern.
   * Suitability codes (IFA/IFR/IFC/ASB) live in separate `suitabilityCode` field (Phase 2).
   */
  revisionCode?: string; // validated by REVISION_CODE_REGEX

  /**
   * 🌐 ISO 19650-1 §10.2 — Common Data Environment workflow state.
   * ΟΡΘΟΓΩΝΙΟ προς `lifecycleState` (που είναι retention state).
   * WIP = work-in-progress, SHARED = under review, PUBLISHED = authorized,
   * SUPERSEDED = replaced by newer revision (renamed από ARCHIVED στο OQ4
   * για disambiguation με `lifecycleState.archived`).
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
  // ─── Core 8 (always available) ───────────────────────────────────────────
  A: { studyGroup: 'architectural' as StudyGroup, label: 'Architectural', labelEl: 'Αρχιτεκτονικά' },
  S: { studyGroup: 'structural' as StudyGroup, label: 'Structural', labelEl: 'Στατικά' },
  M: { studyGroup: 'mechanical' as StudyGroup, label: 'Mechanical (HVAC/Plumbing)', labelEl: 'Μηχανολογικά' },
  E: { studyGroup: 'mechanical' as StudyGroup, label: 'Electrical', labelEl: 'Ηλεκτρολογικά' }, // split from M via AI
  K: { studyGroup: 'energy' as StudyGroup, label: 'KENAK (Energy)', labelEl: 'Ενεργειακά (ΚΕΝΑΚ)' },
  H: { studyGroup: 'site' as StudyGroup, label: 'HSE (Health/Safety/Environment)', labelEl: 'ΣΑΥ-ΦΑΥ / Εργοταξιακά' },
  N: { studyGroup: 'administrative' as StudyGroup, label: 'Notarial/Legal', labelEl: 'Διοικητικά/Νομικά' },
  X: { studyGroup: 'fiscal' as StudyGroup, label: 'Fiscal', labelEl: 'Φορολογικά/Ασφαλιστικά' },
  // ─── Extended 5 (OQ1 — approved 2026-05-24) ──────────────────────────────
  T: { studyGroup: 'site' as StudyGroup, label: 'Topographic', labelEl: 'Τοπογραφικά' },
  L: { studyGroup: 'mechanical' as StudyGroup, label: 'Lift / Elevator', labelEl: 'Ανελκυστήρες' },
  P: { studyGroup: 'administrative' as StudyGroup, label: 'Permits', labelEl: 'Άδειες (οικοδομική, ΤΑΥΤ, ΗΛΠΑΠ)' },
  F: { studyGroup: 'mechanical' as StudyGroup, label: 'Fire Safety', labelEl: 'Πυρασφάλεια' },
  D: { studyGroup: 'site' as StudyGroup, label: 'Demolition / AEKK', labelEl: 'Κατεδαφίσεις / ΑΕΚΚ' },
} as const;

export type DisciplineCode = keyof typeof DISCIPLINE_CODES;

// ─── Document Series ────────────────────────────────────────────────────────

export const DOCUMENT_SERIES = {
  // OQ3 — strict enum, 9 series (approved 2026-05-24)
  100: { label: 'Κατόψεις', en: 'Plans' },
  200: { label: 'Όψεις', en: 'Elevations' },
  300: { label: 'Τομές', en: 'Sections' },
  400: { label: 'Λεπτομέρειες', en: 'Details' },
  500: { label: 'Κουφώματα / Πίνακες', en: 'Schedules' },
  600: { label: 'Διαμορφώσεις', en: 'Landscape' },
  700: { label: 'Στατικά σχέδια', en: 'Structural Drawings' },
  800: { label: 'Η/Μ Schematics', en: 'MEP Schematics' },
  900: { label: 'As-Built / AIM', en: 'As-Built / AIM' },
} as const;

export type DocumentSeries = keyof typeof DOCUMENT_SERIES;

// ─── CDE States (ISO 19650-1 §10.2) ─────────────────────────────────────────

export const CDE_STATES = {
  // OQ4 — SUPERSEDED instead of ARCHIVED to disambiguate from lifecycleState.archived (approved 2026-05-24)
  WIP:        { labelEl: 'Σε εξέλιξη', labelEn: 'Work in Progress' },
  SHARED:     { labelEl: 'Σε διαβούλευση', labelEn: 'Shared for Review' },
  PUBLISHED:  { labelEl: 'Εγκεκριμένο', labelEn: 'Authorized for Use' },
  SUPERSEDED: { labelEl: 'Αντικαταστάθηκε', labelEn: 'Superseded by Newer Revision' },
} as const;

export type CdeState = keyof typeof CDE_STATES;

// ─── Validators (regex SSoT) ────────────────────────────────────────────────

/**
 * OQ2 — Revision codes (approved 2026-05-24)
 * P = Preliminary, T = Tender, C = Construction, R = Revision, AB = As-Built variant
 * Suitability tags (IFA/IFR/IFC/ASB) live separately in `suitabilityCode` field (Phase 2).
 */
export const REVISION_CODE_REGEX = /^(P|T|C|R|AB)\d{2}$/;

/**
 * OQ5 — Composite building code (approved 2026-05-24)
 * Main building (Κ1, K12, Β3) + optional suffix for wing/unit (-Α, -Β1, -A3).
 * Examples: Κ1, Κ12, Κ1-Α, Κ1-Β1, A-1
 */
export const BUILDING_CODE_REGEX = /^[Α-ΩA-Z]\d{1,2}(-[Α-ΩA-Z\d]{1,3})?$/;

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
[NEW] Fire-and-forget call to enriched classifier (ALWAYS — OQ7):
   ├─ Step 1: Derive defaults από purpose → study group → DisciplineCode
   │           (zero-cost, καμία AI κλήση, σαν fallback αν AI fails)
   ├─ Step 2: AI vision call (gpt-4o-mini) ΠΑΝΤΑ διαβάζει το αρχείο
   │           Extract: disciplineCode (override default αν χρειάζεται),
   │                    documentSeries, revisionCode, buildingCode, cdeState
   │           OQ7 decision: ΟΧΙ skip ακόμα και σε unambiguous derivation —
   │           ο Γιώργος προτιμά 100% AI verification για consistency.
   └─ Step 3: Update FileRecord με τα 5 πεδία + iso19650Source audit
```

#### D5.1.1 Trigger semantics (OQ6 — approved 2026-05-24)

| Σενάριο | Συμπεριφορά |
|---------|-------------|
| Πρώτο upload | ✅ Trigger AI enricher |
| Binary replace (νέα έκδοση πάνω από παλιά) | ✅ Re-trigger AI (νέο content = νέο classification) |
| Metadata-only change (rename, purpose update) | ❌ ΟΧΙ trigger (content unchanged) |
| Manual "Re-classify" button (Phase 2) | ✅ Trigger AI |

#### D5.1.2 Concurrency control (OQ6)

- **Max 5 concurrent AI vision calls per company** (επαναχρησιμοποιεί υπάρχον `withStandardRateLimit` infrastructure)
- Bulk upload 50 αρχείων → batches των 5 → ~2-3 λεπτά συνολικά, **fire-and-forget** (upload completes instantly, classification updates async)
- Αν OpenAI rate limit hit → exponential backoff (max 3 retries)

#### D5.1.3 Cost control (OQ6)

- **Hard budget cap: $0.01/file** (10× το standard gpt-4o-mini vision cost ~$0.001)
- Αν εκτιμώμενο cost > $0.01 (π.χ. πολυσέλιδο PDF > 50 σελίδες) → skip + log
- Log entry: `iso19650Source.aiReasoning = "Skipped: estimated cost ${X}¢ exceeds $0.01/file cap"`
- Monthly aggregate cost tracking per company → admin dashboard (Phase 2)

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

## Resolved Decisions (clarifications session 2026-05-24)

✅ Όλες οι 8 αρχικές Open Questions απαντημένες από τον Γιώργο. Industry-default
recommendations έγιναν δεκτές με τη βασική απόκλιση στο OQ7 (always-AI αντί skip-on-certainty).

### ✅ OQ1 — Discipline letters: **13 γράμματα συνολικά**
Core 8 (A/S/M/E/K/H/N/X) + Extended 5 (T/L/P/F/D). Όλα implemented στο `DISCIPLINE_CODES`.
- T (Topographic) → study group `site`
- L (Lift) → study group `mechanical`
- P (Permits) → study group `administrative`
- F (Fire safety) → study group `mechanical`
- D (Demolition/ΑΕΚΚ) → study group `site`

### ✅ OQ2 — Revision regex: `^(P|T|C|R|AB)\d{2}$`
- P = Preliminary, T = Tender, C = Construction, R = Revision, AB = As-Built variant
- 2 ψηφία (industry standard, ISO 19650-2 §5.1.7)
- Suitability tags (IFA/IFR/IFC/ASB) → **Phase 2** ως ξεχωριστό πεδίο `suitabilityCode` (BS 1192 separation pattern, Aconex/Bentley convention)

### ✅ OQ3 — Document series: **strict enum, 9 σειρές**
100 (Plans) / 200 (Elevations) / 300 (Sections) / 400 (Details) / 500 (Schedules) / 600 (Landscape) / 700 (Structural) / 800 (MEP) / 900 (As-Built). TypeScript literal union → IDE auto-complete + compile-time typo detection.

### ✅ OQ4 — CDE 4th state: **`SUPERSEDED`** (όχι `ARCHIVED`)
Disambiguation από `lifecycleState.archived`. Industry pattern (Aconex/Bentley/Bimplus). Greek label: "Αντικαταστάθηκε".

### ✅ OQ5 — Building code: **composite regex** `^[Α-ΩA-Z]\d{1,2}(-[Α-ΩA-Z\d]{1,3})?$`
Καλύπτει: `Κ1`, `Κ12`, `Κ1-Α`, `Κ1-Β1`, `A-1`. Δεν επιτρέπει multi-dash anarchy (max 1 παύλα, max 3 χαρακτήρες suffix).

### ✅ OQ6 — AI trigger semantics: **Industry Default package**
- **Re-trigger** στο binary replace (όχι σε metadata-only changes)
- **Concurrency** max 5 parallel AI calls per company (reuse `withStandardRateLimit`)
- **Budget cap** hard $0.01/file (10× standard cost — safety net για edge cases)
- **Monthly aggregate** cost tracking per company → Phase 2 admin dashboard

### ✅ OQ7 — Skip on high-confidence derivation: **ΟΧΙ skip — ΠΑΝΤΑ AI**
Ο Γιώργος προτίμησε max accuracy έναντι cost optimization. AI vision call γίνεται **πάντα** ακόμα και όταν derivation από purpose είναι unambiguous (π.χ. study-floorplan → A100). Trade-off: ~30% extra cost, **100% verification consistency**. Cheap derivation κρατείται μόνο ως fallback αν AI fails (timeout/quota).

### ✅ OQ8 — ADR-370/371 duplicates: **Pending list**
Confirmed via `Glob`: 4 αρχεία με 2 νούμερα. Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md` ως ξεχωριστή housekeeping εργασία. **Δεν blocks** την υλοποίηση του ADR-373.

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
| 2026-05-24 | **✅ P2.7 IMPLEMENTED — i18n keys για ISO labels.** `src/i18n/locales/el/iso19650.json` + `src/i18n/locales/en/iso19650.json` (NEW). Namespace `'iso19650'` added to `SUPPORTED_NAMESPACES` + loaders (el+en) in `namespace-loaders.ts`. Keys: 13 discipline codes, 9 document series, 4 CDE states, 4 suitability codes, 7 label strings. i18n audit: 0 violations. | Claude (Sonnet 4.6) |
| 2026-05-24 | **✅ P2.6 IMPLEMENTED — `suitabilityCode` field (BS 1192 OQ2 Phase 2).** Added `SuitabilityCode` type (IFA/IFR/IFC/ASB) + `SUITABILITY_CODES` const + `SUITABILITY_CODE_REGEX` + `SUITABILITY_CODE_VALUES` to `iso19650-constants.ts`. `FileRecord.suitabilityCode?: SuitabilityCode` field added after `revisionCode`. `isSuitabilityCode()` type guard + `validateSuitabilityCode()` in `validators.ts`. `iso19650-enricher.ts` schema + prompt + `buildAiResult` extended. 76 constants+enricher tests green (73 suites / 1179 total). Note: `vision-helpers.ts` SSoT found already implemented (P2.8 ✅). | Claude (Sonnet 4.6) |
| 2026-05-24 | Initial DRAFT — Phase 1 Recognition complete. Hybrid 2-layer architecture decided (7 user-facing groups + 5 AI-driven ISO 19650 fields). Implementation pending Giorgio's final clarifications (8 open questions). | Claude (Opus 4.7) + Γιώργος Παγώνης |
| 2026-05-24 | **CLARIFIED** — All 8 Open Questions resolved via interactive Q&A. Key updates: (1) **13 disciplines** (added T/L/P/F/D), (2) revisionCode regex tightened to `^(P\|T\|C\|R\|AB)\d{2}$` with suitability codes moved to Phase 2, (3) **9 document series** strict enum (added 700/800/900), (4) CDE state `ARCHIVED` → **`SUPERSEDED`** (lifecycle disambiguation), (5) composite buildingCode regex for wing/unit support, (6) industry-default AI trigger semantics (re-trigger on replace + max 5 concurrent + $0.01/file cap), (7) **always-AI** policy (no skip on certainty — max consistency), (8) ADR-370/371 duplicates → pending list. ADR ready for Plan Mode → Orchestrator implementation. | Claude (Opus 4.7) + Γιώργος Παγώνης |
| 2026-05-24 | **🔴 Build hotfix** — Next.js 15 Turbopack flagged: `useFileDownload` (client hook) → `file-mutation-gateway` → `file-record.service` → static import of `file-record-post-finalize-hooks` (which has `'server-only'`) → static import of `iso19650-enricher` → static import of `contact-document-classifier` (also `'server-only'`). Client bundle επιχείρησε να συμπεριλάβει server-only chain. **Fix**: αφαίρεση static import από `file-record.service.ts`, αντικατάσταση με `import('@/services/file-record-post-finalize-hooks').then(...)` (dynamic). Server-only chain παραμένει isolated σε ξεχωριστό chunk, ποτέ δεν μπαίνει στο client bundle. Service file size: 495 LOC (unchanged). Tests pass 61/61. **Lesson**: services που τρέχουν σε mixed client/server contexts (πχ file-record.service.ts) ΔΕΝ μπορούν να κάνουν static import server-only modules — μόνο dynamic. | Claude (Opus 4.7) |
| 2026-05-24 | **✅ Phase 1 IMPLEMENTED.** 15 files (6 NEW + 5 EDIT + 4 docs). Σύνοψη: (1) `src/config/iso19650-constants.ts` — 13 disciplines + 9 series + 4 CDE states + 2 regexes + StudyGroup→Discipline map + `ISO19650_BUDGET_CAP_USD`. (2) `src/services/iso19650/validators.ts` — type guards + regex validators + `deriveFromPurpose()` fallback. (3) `src/types/file-record.ts` — 5 optional fields + `iso19650Source` audit subobject. (4) `src/services/ai-pipeline/tools/handlers/iso19650-enricher.ts` — OpenAI vision + strict JSON schema + cost estimator + budget cap + derivation fallback (never throws). (5) `src/services/file-record-post-finalize-hooks.ts` — SSoT για post-finalize side effects (extracted DXF hook + new ISO19650 hook από `file-record.service.ts` για να μείνει <500 LOC, ADR-312 + ADR-373 unified). (6) `src/services/ai-pipeline/tools/__tests__/handlers/iso19650-enricher.test.ts` — 15 tests (preflight gates + AI success + failure paths + never-throws). (7) `src/config/__tests__/iso19650-constants.test.ts` — 46 tests (enum exhaustiveness + regex edge cases + StudyGroup mapping). **BUG FIX αν την υλοποίηση**: `BUILDING_CODE_REGEX` αρχικά `^[Α-ΩA-Z]\d{1,2}(-[Α-ΩA-Z\d]{1,3})?$` δεν δεχόταν `A-1` (που είχε αναφερθεί στο OQ5). Διορθώθηκε σε `^[Α-ΩA-Z](\d{1,2}(-[Α-ΩA-Z\d]{1,3})?|-[Α-ΩA-Z\d]{1,3})$` (επιτρέπει "letter + digits + optional dash-suffix" OR "letter + dash-suffix"). **Architectural notes**: Concurrency control (OQ6 max 5/company) deferred to Phase 2 — `withStandardRateLimit` είναι HTTP route middleware, ΟΧΙ in-process semaphore. Vercel serverless processes είναι ξεχωριστά → distributed token bucket στη Phase 2 (Firestore-backed). Phase 1 βασίζεται σε OpenAI built-in rate limits + $0.01/file budget cap. Vision helper imports (`downloadFile`, `extractOutputText`, `isImageMime`, `VisionContent`) re-used από `contact-document-classifier.ts` — extraction σε `vision-helpers.ts` SSoT queued ως Boy Scout Phase 2 small task. **Tests**: `npm run test:ai-pipeline:all` → 73 suites / 1178 tests green. `npx jest iso19650-constants` → 46/46. `npx jest iso19650-enricher` → 15/15. `npx tsc --noEmit` → exit 0. | Claude (Opus 4.7) + Γιώργος Παγώνης |
